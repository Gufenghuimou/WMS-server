# /routers/users.py
from fastapi import Request, Form, UploadFile, File, Depends, APIRouter
from fastapi.responses import HTMLResponse
from pygments.lexers import verification
from sqlmodel import Session, select
from starlette.responses import RedirectResponse
import os
import hashlib
from database import engine
from models import User, UserBookmark
from dependencies import get_current_user, require_admin, require_superadmin
from core import templates, t_lang

router = APIRouter(tags=['Functions'])

#----------------------- 用户管理 -------------------------#

@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    user_agent = request.headers.get('User-Agent', '').lower()
    mobile_keywords = ["android", "iphone", "ipad", "ipod", "windows phone", "mobile"]
    is_mobile = any(keyword in user_agent for keyword in mobile_keywords)
    if is_mobile:
        return RedirectResponse(url="/mobile/login")
    return templates.TemplateResponse(request, "login.html", {})

@router.get("/mobile/login", response_class=HTMLResponse)
async def mobile_login(request: Request):
    return templates.TemplateResponse(request, "mobile_login.html", {})

@router.post("/login")
async def process_login(request: Request, username: str = Form(...), password: str = Form(...)):
    lang = request.state.lang
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username, User.password_hash == password_hash)).first()
        if user:
            request.session["user"] = {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role
            }
            return RedirectResponse(url="/all", status_code=303)
        else:
            error_msg = t_lang("login.error", lang)
            return templates.TemplateResponse(request, "login.html", {"error": error_msg ,"lang": lang})

@router.get("/backend", response_class=HTMLResponse)
async def admin_dashboard(request: Request, current_user:dict = Depends(require_superadmin)):
    with Session(engine) as session:
        user_list = []
        users = session.exec(select(User)).all()
        for user in users:
            user_list.append(user)
    return templates.TemplateResponse(request, "admin.html", {"user": current_user, 'users': users, 'users_list': user_list, "active_page": "backend"})

@router.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=303)

@router.get("/settings", response_class=HTMLResponse)
async def get_settings_page(request: Request, current_user:dict = Depends(get_current_user)):
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == current_user["username"])).first()
        if not user:
            return RedirectResponse(url="/login", status_code=303)

        return templates.TemplateResponse(
            request,
            "settings.html",
            {'user': user, 'active_page': 'settings'},
        )

@router.post("/user/update_settings")
async def update_user_settings(
        request: Request,
        new_full_name: str = Form(None),
        old_password: str = Form(...),
        new_password: str = Form(None),
        confirm_password: str = Form(None),
        avatar: UploadFile = File(None),
        current_user:dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == current_user['username'])).first()
        if not user:
            return {"status": "error", "message": t_lang("settings.user_error", lang)}

        old_password_hash = hashlib.sha256(old_password.encode()).hexdigest()
        if user.password_hash != old_password_hash:
            return {"status": "error", "message": t_lang("settings.wrong_old_password", lang)}

        if new_full_name and new_full_name.strip():
            user.full_name = new_full_name.strip()

        if new_password:
            if new_password != confirm_password:
                return {"status": "error", "message": t_lang("settings.password_mismatch", lang)}
            user.password_hash = hashlib.sha256(new_password.encode()).hexdigest()

        if avatar and avatar.filename:
            avatar_path = f'static/avatars/{user.username}.jpg'
            content = await avatar.read()
            with open(avatar_path, "wb") as f:
                f.write(content)

        session.add(user)
        session.commit()

        if new_password:
            request.session.clear()
            return {"status": "success", "message": t_lang("settings.password_success", lang), "action": "logout"}

        return {"status": "success", "message": t_lang("settings.update_success", lang), "action": "reload"}


@router.post("/delete_user/{user_id}")
async def delete_user(request: Request, user_id: int, username: str = Form(...), current_user: dict = Depends(require_admin)):
    lang = request.state.lang
    with Session(engine) as session:
        user_to_delete = session.get(User, user_id)
        if user_to_delete:
            image_path = f'static/avatars/{username}.jpg'
            try:
                if os.path.exists(image_path):
                    os.remove(image_path)
            except Exception as e:
                print(f'Error deleting image file: {e}')
            session.delete(user_to_delete)
            session.commit()
    return {"status": "success", "message": t_lang("admin.user_deleted", lang, username=username)}

@router.post("/api/bookmark/toggle/{item_id}")
async def toggle_bookmark(item_id: int, current_user: dict = Depends(get_current_user)):
    username = current_user.get("username")

    with Session(engine) as session:
        statement = select(UserBookmark).where(UserBookmark.username == username, UserBookmark.item_id == item_id)
        bookmark = session.exec(statement).first()

        if bookmark:
            session.delete(bookmark)
            session.commit()
            return {'status': 'removed'}
        else:
            new_bookmark = UserBookmark(username=username, item_id=item_id)
            session.add(new_bookmark)
            session.commit()
            return {'status': 'added'}

@router.post("/add_user")
async def add_user(
        request: Request,
        new_username: str = Form(...),
        new_full_name: str = Form(...),
        new_role: str = Form(...),
        current_user: dict = Depends(require_admin),
):
    lang = request.state.lang
    with Session(engine) as session:
        existing = session.exec(select(User).where(User.username == new_username)).first()
        if existing:
            return {"status": "error", "message": t_lang("admin.add_user_fail", lang, new_username=new_username)}

        password_hash = hashlib.sha256('123456'.encode()).hexdigest()
        new_account = User(
            username=new_username.strip(),
            password_hash=password_hash,
            full_name=new_full_name.strip(),
            role=new_role,
        )
        session.add(new_account)
        session.commit()
    return {"status": "success", "message": t_lang("admin.add_user_success", lang, new_username=new_username)}

@router.post("/admin/reset_password")
async def reset_password(request: Request, target_username: str = Form(...), current_user:dict = Depends(require_admin)):
    lang = request.state.lang
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == target_username.strip())).first()
        if not user:
            return {"status": "error", "message": t_lang("settings.user_error", lang)}
        new_password_hash = hashlib.sha256('123456'.encode()).hexdigest()
        user.password_hash = new_password_hash
        session.add(user)
        session.commit()
    return {"status": "success", "message": t_lang("admin.reset_password_success", lang, target_username=target_username)}

