"""Cognito session contracts and independently scoped extension credentials."""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import TYPE_CHECKING, Any, Dict, Optional

from pydantic import BaseModel, Field, field_validator

if TYPE_CHECKING:
    from .user import User


class TokenType(str, Enum):
    ACCESS_TOKEN = "access_token"
    REFRESH_TOKEN = "refresh_token"
    EXTENSION_PAIRING_CODE = "extension_pairing_code"


class LineageKind(str, Enum):
    BROWSER_EXTENSION = "browser_extension"


class AuthToken(BaseModel):
    """Only extension grants and pairing codes live in DynamoDB; user sessions live in Cognito."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    email: str
    token: str = Field(default_factory=lambda: secrets.token_urlsafe(32))
    token_type: TokenType
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_used_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    lineage_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lineage_kind: LineageKind = LineageKind.BROWSER_EXTENSION
    lineage_started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    client_label: Optional[str] = None
    failed_attempts: int = 0

    @classmethod
    def create_refresh_token(
        cls, *, user_id: str, email: str, expires_at: datetime, lineage_kind: LineageKind, client_label: Optional[str] = None
    ) -> "AuthToken":
        identity = str(uuid.uuid4())
        return cls(
            id=identity,
            lineage_id=identity,
            user_id=user_id,
            email=email,
            token="ext_r_" + secrets.token_urlsafe(32),
            token_type=TokenType.REFRESH_TOKEN,
            expires_at=expires_at,
            lineage_kind=lineage_kind,
            client_label=client_label,
        )

    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) >= self.expires_at

    def is_valid(self) -> bool:
        return self.is_active and not self.is_expired()

    def revoke(self) -> None:
        self.is_active = False

    def to_dynamodb_item(self) -> Dict[str, Any]:
        item = self.model_dump(mode="json", exclude_none=True)
        if self.token.startswith(("ext_r_", "ext_a_")):
            item["token"] = hashlib.sha256(self.token.encode()).hexdigest()
        item["expire_at"] = int((self.expires_at + timedelta(days=7)).timestamp())
        return item

    @classmethod
    def from_dynamodb_item(cls, item: Dict[str, Any]) -> "AuthToken":
        return cls.model_validate(item)


class TokenVerificationResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: Dict[str, Any]


class WebSessionResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: Dict[str, Any]


class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = None


class LogoutRequest(RefreshRequest):
    pass


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=256)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value:
            raise ValueError("Invalid email")
        return value


class RegisterRequest(LoginRequest):
    pass


class AuthUser(BaseModel):
    """Simplified user model for authentication responses (post-credits removal)."""

    id: str = Field(..., description="User ID")
    email: str = Field(..., description="User email")
    reading_language: Optional[str] = Field(default=None, description="Preferred reading language (ISO 639-1)")
    reading_language_change_available_at: Optional[str] = Field(
        default=None,
        description=(
            "ISO 8601 instant at which the reading language may be changed again, "
            "when a change is currently barred by the once-a-month guard-rail. "
            "Null means a change is possible now — which is the answer for every "
            "account that has never changed its language."
        ),
    )
    iana_timezone: Optional[str] = Field(
        default=None,
        description=(
            "IANA zone name of the user's device (e.g. 'Europe/Paris'), never a UTC offset. Absent until the app has reported one."
        ),
    )

    @classmethod
    def from_user(cls, user: "User") -> "AuthUser":
        """Project a stored user onto the profile a session response carries.

        Login, refresh and the OAuth exchange project the same application
        preferences, independent of the Cognito authentication method.

        The availability date is computed here rather than stored: what the row
        holds is when the language last moved, and every client only ever needs
        the one date it would derive from it.
        """
        available_at = user.reading_language_change_available_at()
        return cls(
            id=user.id,
            email=user.email,
            reading_language=user.reading_language,
            reading_language_change_available_at=(available_at.isoformat() if available_at is not None else None),
            iana_timezone=user.iana_timezone,
        )
