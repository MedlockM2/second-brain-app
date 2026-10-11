"""
JWT token utilities for authentication.
"""
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from media_summarizer.core.models.auth import LineageKind

# Configure logging
logger = logging.getLogger(__name__)

# JWT configuration (standardized)
# Prefer JWT_* variables with backward-compatible fallbacks
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or os.environ.get("SECRET_KEY", "your-secret-key-change-this-in-production")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
# 60 minutes by default. Revocation does not ride on this duration: get_current_user
# re-reads the user from DynamoDB on every request, so a deleted account is rejected
# immediately whatever the JWT still says (api/dependencies/auth.py).
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
# Optional seconds override (useful for short-lived dev tokens)
JWT_ACCESS_TOKEN_EXPIRE_SECONDS = int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRE_SECONDS", "0"))

# Backward-compat constants (for existing imports in tests)
SECRET_KEY = JWT_SECRET_KEY
ALGORITHM = JWT_ALGORITHM
# Derive hours from minutes if not explicitly provided
try:
    if os.environ.get("ACCESS_TOKEN_EXPIRE_HOURS"):
        ACCESS_TOKEN_EXPIRE_HOURS = int(os.environ.get("ACCESS_TOKEN_EXPIRE_HOURS"))
    else:
        ACCESS_TOKEN_EXPIRE_HOURS = max(1, (JWT_ACCESS_TOKEN_EXPIRE_MINUTES + 59) // 60)
except Exception:
    ACCESS_TOKEN_EXPIRE_HOURS = 24

# Refresh token lifetime of a *mobile* lineage (defaults to days, but can be overridden in
# minutes/seconds for dev). One year, and *sliding*: every rotation recomputes the expiry
# from now, so there is no absolute session cap. An active user never signs in again; an
# abandoned device stops being refreshable a year after its last use.
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "365"))
REFRESH_TOKEN_EXPIRE_MINUTES = int(os.environ.get("REFRESH_TOKEN_EXPIRE_MINUTES", "0"))
REFRESH_TOKEN_EXPIRE_SECONDS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_SECONDS", "0"))

# Rotation grace window: a refresh token consumed less than this many seconds ago replays
# the pair it was exchanged for instead of answering 401. Rotation is single-use, so
# without this window two concurrent refreshes sign the user out.
REFRESH_ROTATION_GRACE_SECONDS = 60

# Refresh token lifetime of a *browser* lineage (task-473). A browser is a shared, less
# guarded place than a phone's secure store, so its session is bounded twice: it dies
# after BROWSER_REFRESH_IDLE_DAYS without a /refresh, and in any case
# BROWSER_REFRESH_MAX_DAYS after the sign-in that opened it. Rotation never pushes the
# expiry past that absolute cap (RFC 10017 §6.3.2.3).
BROWSER_REFRESH_IDLE_DAYS = 7
BROWSER_REFRESH_MAX_DAYS = 30

# Refresh token lifetime of a *browser_extension* lineage (task-485, owner decision of
# 2026-10-11): renewed at every use, dead after 90 days without one, and a year after
# the pairing at the latest — then the extension asks to be paired again.
EXTENSION_REFRESH_IDLE_DAYS = 90
EXTENSION_REFRESH_MAX_DAYS = 365

# (idle days, absolute cap in days) of the lineage kinds that have a cap.
_CAPPED_LINEAGES = {
    LineageKind.BROWSER: (BROWSER_REFRESH_IDLE_DAYS, BROWSER_REFRESH_MAX_DAYS),
    LineageKind.BROWSER_EXTENSION: (EXTENSION_REFRESH_IDLE_DAYS, EXTENSION_REFRESH_MAX_DAYS),
}

# The `scope` claim of an access token minted for a browser extension lineage. The
# authentication dependency confines such a token to the few routes the extension
# needs (api/dependencies/auth.py, EXTENSION_ROUTES).
ACCESS_SCOPE_EXTENSION = "extension"


def get_access_token_expires_seconds() -> int:
    if JWT_ACCESS_TOKEN_EXPIRE_SECONDS > 0:
        return JWT_ACCESS_TOKEN_EXPIRE_SECONDS
    return max(1, JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60)


def get_access_token_expires_timedelta() -> timedelta:
    if JWT_ACCESS_TOKEN_EXPIRE_SECONDS > 0:
        return timedelta(seconds=JWT_ACCESS_TOKEN_EXPIRE_SECONDS)
    return timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)


def get_refresh_token_expires_at(
    kind: LineageKind = LineageKind.MOBILE,
    lineage_started_at: Optional[datetime] = None,
    now: Optional[datetime] = None,
) -> datetime:
    """Expiry of a refresh token minted now in a lineage of ``kind``.

    ``lineage_started_at`` is the sign-in (or pairing) that opened the lineage; it
    only matters for a capped kind, whose expiry never passes it plus the cap.
    """
    now = now or datetime.now(timezone.utc)
    capped = _CAPPED_LINEAGES.get(kind)
    if capped:
        idle_days, max_days = capped
        cap = (lineage_started_at or now) + timedelta(days=max_days)
        return min(now + timedelta(days=idle_days), cap)
    if REFRESH_TOKEN_EXPIRE_SECONDS > 0:
        return now + timedelta(seconds=REFRESH_TOKEN_EXPIRE_SECONDS)
    if REFRESH_TOKEN_EXPIRE_MINUTES > 0:
        return now + timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)
    return now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

# Password hashing context (for future use if needed)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.

    Args:
        data: The data to encode in the token
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + get_access_token_expires_timedelta()

    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})

    try:
        encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        logger.info(f"Access token created for user: {data.get('sub', 'unknown')}")
        return encoded_jwt
    except Exception as e:
        logger.error(f"Error creating access token: {str(e)}")
        raise


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify and decode a JWT token.

    Args:
        token: The JWT token to verify

    Returns:
        Decoded token payload or None if invalid
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

        # Check if token is expired
        exp = payload.get("exp")
        if exp:
            exp_datetime = datetime.fromtimestamp(exp, tz=timezone.utc)
            if datetime.now(timezone.utc) > exp_datetime:
                logger.warning("Token has expired")
                return None

        # Validate required fields
        user_id = payload.get("sub")
        if not user_id:
            logger.warning("Token missing 'sub' (user_id) field")
            return None

        logger.debug(f"Token verified for user: {user_id}")
        return payload

    except JWTError as e:
        logger.warning(f"JWT verification failed: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error verifying token: {str(e)}")
        return None


def get_user_id_from_token(token: str) -> Optional[str]:
    """
    Extract user ID from a JWT token.

    Args:
        token: The JWT token

    Returns:
        User ID or None if token is invalid
    """
    payload = verify_token(token)
    if payload:
        return payload.get("sub")
    return None


def create_token_payload(user_id: str, email: str, additional_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Create a standardized token payload.

    Args:
        user_id: The user ID
        email: The user email
        additional_data: Optional additional data to include

    Returns:
        Token payload dictionary
    """
    payload = {
        "sub": user_id,  # Subject (user ID)
        "email": email,
        "type": "access_token"
    }

    if additional_data:
        payload.update(additional_data)

    return payload


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.

    Args:
        password: Plain text password

    Returns:
        Hashed password
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.

    Args:
        plain_password: Plain text password
        hashed_password: Hashed password to verify against

    Returns:
        True if password matches, False otherwise
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def is_token_expired(token: str) -> bool:
    """
    Check if a token is expired without fully validating it.

    Args:
        token: The JWT token to check

    Returns:
        True if expired, False if valid or if cannot determine
    """
    try:
        # Decode without verification to check expiration
        payload = jwt.decode(token, key="", options={"verify_signature": False, "verify_exp": False})
        exp = payload.get("exp")
        if exp:
            exp_datetime = datetime.fromtimestamp(exp, tz=timezone.utc)
            return datetime.now(timezone.utc) >= exp_datetime
        return False
    except Exception:
        return True  # Assume expired if we can't decode


def access_token_payload(user_id: str, email: str, kind: LineageKind = LineageKind.MOBILE) -> Dict[str, Any]:
    """Claims of an access token minted in a lineage of ``kind``.

    A browser extension lineage carries ``scope: extension``, which confines the
    token to the extension's routes; every other kind is a full session.
    """
    extra = {"scope": ACCESS_SCOPE_EXTENSION} if kind == LineageKind.BROWSER_EXTENSION else None
    return create_token_payload(user_id=user_id, email=email, additional_data=extra)
