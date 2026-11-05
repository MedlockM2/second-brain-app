"""Public origin validation shared by the extension delivery scripts."""

from urllib.parse import urlsplit


def origin(value: str, purpose: str) -> str:
    parsed = urlsplit(value)
    if (
        parsed.scheme not in ("http", "https")
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.path not in ("", "/")
        or parsed.query
        or parsed.fragment
        or value != value.strip()
    ):
        raise ValueError("Expected an http(s) origin without credentials, path, query or fragment")
    host = parsed.hostname.lower()
    reserved = (
        host == "localhost"
        or host.startswith("127.")
        or host == "::1"
        or any(
            host == suffix or host.endswith("." + suffix)
            for suffix in ("invalid", "test", "example", "localhost", "example.com", "example.net", "example.org")
        )
    )
    if purpose == "distribution" and (parsed.scheme != "https" or reserved):
        raise ValueError("Distribution requires the owner's public HTTPS origins, never loopback/example names")
    # Match the URL constructor used by WXT/runtime (default ports are omitted).
    port = parsed.port
    default = 443 if parsed.scheme == "https" else 80
    hostname = f"[{host}]" if ":" in host else host
    return f"{parsed.scheme}://{hostname}" + (f":{port}" if port and port != default else "")
