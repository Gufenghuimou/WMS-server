# dependencies.py
from fastapi import Request, Depends, HTTPException, status
import logging
from logging.handlers import RotatingFileHandler

from pygments.lexers import actionscript

# superadmin 本地日志

superadmin_logger = logging.getLogger("superadmin_audit")
superadmin_logger.setLevel(logging.INFO)

# log 文件大小限制5M，3个备份
handler = RotatingFileHandler("superadmin_audit.log", maxBytes=5*1024*1024, backupCount=3)
formatter = logging.Formatter('%(asctime)s - [IP: %(client_ip)s] - [User: %(username)s] - %(message)s')
handler.setFormatter(formatter)
superadmin_logger.addHandler(handler)

class RequiresLoginException(Exception):
    pass

def get_current_user(request: Request):
    lang = request.state.lang
    user = request.session.get("user")
    if not user:
        raise RequiresLoginException()
    return user

def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["superadmin", "admin"]:
        raise HTTPException(status_code=403, detail="权限不足")
    return current_user

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get('X-Forwarded-For')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.client.host

def require_superadmin(request: Request, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="权限不足")

    client_ip = get_client_ip(request)
    action_info = f"Accessed: {request.method} {request.url.path}"
    superadmin_logger.info(action_info, extra={"client_ip": client_ip, "username": current_user["username"]})
    return current_user