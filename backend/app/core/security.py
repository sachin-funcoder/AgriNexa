"""Security utilities, password hashing, and JWT token management."""

import os
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
import jwt
from fastapi import Header, HTTPException, status, Depends
from app.core.config import settings

# JWT configuration
JWT_SECRET_KEY = os.environ.get("AGRINEXA_JWT_SECRET", "agrinexa-super-secure-secret-key-karnataka-2026")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days for farmer convenience


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """
    Hashes a password using PBKDF2-HMAC-SHA256 with 600,000 iterations.
    Returns (hex_hash, hex_salt).
    """
    if not salt:
        salt = secrets.token_hex(16)
    
    salt_bytes = bytes.fromhex(salt)
    pw_bytes = password.encode("utf-8")
    
    derived = hashlib.pbkdf2_hmac(
        hash_name="sha256",
        password=pw_bytes,
        salt=salt_bytes,
        iterations=600_000,
        dklen=32
    )
    return derived.hex(), salt


def verify_password(plain_password: str, password_hash: str, salt: str) -> bool:
    """Verifies a plain password against the stored hash and salt."""
    computed_hash, _ = hash_password(plain_password, salt)
    return secrets.compare_digest(computed_hash, password_hash)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decodes and validates a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token has expired. Please log in again."
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token."
        )


async def get_current_user_token(
    authorization: Optional[str] = Header(None)
) -> Optional[str]:
    """Extracts Bearer token from Authorization header."""
    if not authorization:
        return None
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected 'Bearer <token>'"
        )
    return parts[1]


async def get_current_user(
    token: Optional[str] = Depends(get_current_user_token)
) -> Dict[str, Any]:
    """
    FastAPI dependency requiring an authenticated user.
    Fetches full user profile from the database.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in."
        )
    
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing subject identifier."
        )

    # Fetch user from db
    from app.db.database import get_connection
    conn = get_connection()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found."
        )
    
    return dict(user)


async def get_optional_current_user(
    token: Optional[str] = Depends(get_current_user_token)
) -> Optional[Dict[str, Any]]:
    """
    Optional user dependency: returns user dict if valid token is provided,
    or None if no token or expired. Never raises 401.
    """
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            return None
        from app.db.database import get_connection
        conn = get_connection()
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
        return dict(user) if user else None
    except Exception:
        return None


async def require_reviewer_or_admin(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    FastAPI dependency ensuring the user has a reviewer or admin role.
    Prevents regular farmers from reviewing or approving claims.
    """
    role = current_user.get("role", "farmer").lower()
    if role not in ["admin", "reviewer", "moderator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: Reviewer or Administrator privileges required."
        )
    return current_user
