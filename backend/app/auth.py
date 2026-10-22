"""Authentication, secure password hashing, and session management for SpeakSense AI."""
import hashlib
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
from fastapi import Header, HTTPException, Depends

from app.database import get_db_connection

# Session expiration: 14 days
SESSION_LIFETIME_DAYS = 14

def hash_password(password: str) -> Tuple[str, str]:
    """Hashes a password using PBKDF2-HMAC-SHA256 with a unique random salt."""
    salt = secrets.token_bytes(16)
    salt_hex = salt.hex()
    pwd_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    hash_hex = pwd_hash.hex()
    return hash_hex, salt_hex

def verify_password(password: str, salt_hex: str, expected_hash_hex: str) -> bool:
    """Verifies a plain-text password against stored PBKDF2 hash and salt."""
    salt = bytes.fromhex(salt_hex)
    computed_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return secrets.compare_digest(computed_hash.hex(), expected_hash_hex)

def create_user_session(user_id: str) -> str:
    """Generates a secure cryptographically random session token and stores it in SQLite."""
    token = secrets.token_urlsafe(32)
    created_at = datetime.utcnow().isoformat()
    expires_at = (datetime.utcnow() + timedelta(days=SESSION_LIFETIME_DAYS)).isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO sessions (token, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
    """, (token, user_id, created_at, expires_at))
    conn.commit()
    conn.close()
    return token

def get_user_from_session(token: str) -> Optional[Dict[str, Any]]:
    """Retrieves authenticated user record for a valid active session token."""
    if not token:
        return None

    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.utcnow().isoformat()

    cursor.execute("""
    SELECT u.id, u.full_name, u.email, u.mobile, u.avatar_color, u.created_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > ?
    """, (token, now_iso))
    row = cursor.fetchone()
    conn.close()

    if row:
        return dict(row)
    return None

def delete_user_session(token: str):
    """Deletes a session token on logout."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()

def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    """FastAPI dependency to extract optional current user from Bearer header."""
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    return get_user_from_session(token)

def get_current_user_required(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """FastAPI dependency that enforces authentication."""
    user = get_current_user_optional(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required. Please log in.")
    return user
