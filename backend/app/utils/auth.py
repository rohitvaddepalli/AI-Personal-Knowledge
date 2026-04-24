from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from fastapi import Cookie, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User

ACCESS_COOKIE_NAME = "sb_access"
REFRESH_COOKIE_NAME = "sb_refresh"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return base64.b64encode(salt + digest).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    raw = base64.b64decode(password_hash.encode("ascii"))
    salt, digest = raw[:16], raw[16:]
    check = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return hmac.compare_digest(digest, check)


def create_token(subject: str, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    return jwt.encode(payload, settings.auth_secret_key, algorithm="HS256")


def decode_token(token: str, expected_type: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.auth_secret_key, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc
    if payload.get("type") != expected_type:
        raise HTTPException(status_code=401, detail="Invalid token type")
    return payload


def issue_auth_cookies(username: str) -> dict[str, str]:
    return {
        ACCESS_COOKIE_NAME: create_token(username, "access", timedelta(minutes=settings.auth_access_token_minutes)),
        REFRESH_COOKIE_NAME: create_token(username, "refresh", timedelta(days=settings.auth_refresh_token_days)),
        settings.csrf_cookie_name: secrets.token_urlsafe(24),
    }


def ensure_default_local_user(db: Session) -> None:
    if settings.auth_mode != "multi_user":
        return
    if db.query(User).count() == 0:
        db.add(User(username="admin", password_hash=hash_password("admin"), role="admin"))
        db.commit()


def require_csrf(request: Request) -> None:
    if request.method in {"GET", "HEAD", "OPTIONS"} or settings.auth_mode != "multi_user":
        return
    expected = request.cookies.get(settings.csrf_cookie_name, "")
    provided = request.headers.get("x-csrf-token", "")
    if not expected or not provided or not secrets.compare_digest(expected, provided):
        raise HTTPException(status_code=403, detail="Missing or invalid CSRF token")


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    access_token: str | None = Cookie(default=None, alias=ACCESS_COOKIE_NAME),
) -> User | None:
    if settings.auth_mode != "multi_user":
        return None
    require_csrf(request)
    if not access_token:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = decode_token(access_token, "access")
    user = db.query(User).filter(User.username == payload["sub"], User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    return user


def get_refresh_subject(refresh_token: str) -> str:
    return decode_token(refresh_token, "refresh")["sub"]
