# dependencies.py
from fastapi import Request, Depends, HTTPException, status

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

def require_superadmin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="权限不足")
    return current_user