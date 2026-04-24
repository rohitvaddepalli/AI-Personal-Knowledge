from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.utils.auth import (
    ACCESS_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    ensure_default_local_user,
    get_refresh_subject,
    hash_password,
    issue_auth_cookies,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)


def _set_auth_cookies(response: Response, username: str) -> dict[str, str]:
    cookies = issue_auth_cookies(username)
    response.set_cookie(ACCESS_COOKIE_NAME, cookies[ACCESS_COOKIE_NAME], httponly=True, secure=settings.auth_cookie_secure, samesite="lax")
    response.set_cookie(REFRESH_COOKIE_NAME, cookies[REFRESH_COOKIE_NAME], httponly=True, secure=settings.auth_cookie_secure, samesite="lax")
    response.set_cookie(settings.csrf_cookie_name, cookies[settings.csrf_cookie_name], httponly=False, secure=settings.auth_cookie_secure, samesite="lax")
    return cookies


@router.get("/mode")
def auth_mode(db: Session = Depends(get_db)):
    ensure_default_local_user(db)
    return {"mode": settings.auth_mode}


@router.post("/register")
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if settings.auth_mode != "multi_user":
        raise HTTPException(status_code=400, detail="Registration is only available in multi-user mode")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    user = User(username=body.username, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    return {"ok": True}


@router.post("/login")
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    ensure_default_local_user(db)
    if settings.auth_mode != "multi_user":
        return {"ok": True, "mode": settings.auth_mode}
    user = db.query(User).filter(User.username == body.username, User.is_active == True).first()  # noqa: E712
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    _set_auth_cookies(response, user.username)
    return {"ok": True, "username": user.username, "csrfCookieName": settings.csrf_cookie_name}


@router.post("/refresh")
def refresh(response: Response, refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE_NAME)):
    if settings.auth_mode != "multi_user":
        return {"ok": True, "mode": settings.auth_mode}
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    username = get_refresh_subject(refresh_token)
    _set_auth_cookies(response, username)
    return {"ok": True}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(ACCESS_COOKIE_NAME)
    response.delete_cookie(REFRESH_COOKIE_NAME)
    response.delete_cookie(settings.csrf_cookie_name)
    return {"ok": True}
