# /routers/functions.py
from fastapi import Request, Form, UploadFile, File, Depends, BackgroundTasks, APIRouter, HTTPException, status
from fastapi.responses import HTMLResponse
from starlette.responses import RedirectResponse
from sqlmodel import Session, select, or_, desc
from typing import Optional
from collections import defaultdict
import socket
import os
from datetime import datetime, timedelta
import json
import uuid
import utils

from database import engine
from models import User, ChatMessage, InventoryItem, AssetItem, OutboundRequest, AuditRecord, AssetAuditRecord
from dependencies import get_current_user, require_admin
from core import templates, t_lang

router = APIRouter(tags=['Functions'])

# -----------------------------全局功能--------------------------#


@router.get("/api/switch_lang/{lang}")
async def switch_lang(lang: str, request: Request):
    if lang in ['zh', 'en', 'jp', 'vn']:
        request.session["lang"] = lang
    referer = request.headers.get("Referer", '/')
    return RedirectResponse(url=referer, status_code=303)

@router.get("/api/item/{pn_or_loc}", response_model=None)
def get_item_api(request: Request, pn_or_loc: str, current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        pn_or_loc = pn_or_loc.strip().upper()

        def build_response(item_obj, match_type):
            return {
                'id': item_obj.id,
                'pn_1': item_obj.pn_1,
                'pn_2': item_obj.pn_2,
                'name': item_obj.name,
                'description_1': getattr(item_obj, 'description_1', ''),
                'description_2': getattr(item_obj, 'description_2', ''),
                'location': getattr(item_obj, 'location', ''),
                'remarks': getattr(item_obj, 'remarks', ''),
                'match_type': match_type,
                'has_image': item_obj.has_image
            }
        item = session.exec(select(InventoryItem).where(InventoryItem.pn_1 == pn_or_loc)).first()
        if item: return build_response(item, 'pn_1')
        item = session.exec(select(InventoryItem).where(InventoryItem.pn_2 == pn_or_loc)).first()
        if item: return build_response(item, 'pn_2')
        item = session.exec(select(InventoryItem).where(InventoryItem.location == pn_or_loc)).first()
        if item: return build_response(item, 'location')

        item = session.exec(select(AssetItem).where(AssetItem.pn_1 == pn_or_loc)).first()
        if item: return build_response(item, 'pn_1')
        item = session.exec(select(AssetItem).where(AssetItem.pn_2 == pn_or_loc)).first()
        if item: return build_response(item, 'pn_2')
        item = session.exec(select(AssetItem).where(AssetItem.location == pn_or_loc)).first()
        if item: return build_response(item, 'location')

        item = session.exec(select(InventoryItem).where(InventoryItem.pn_1.like(f'%{pn_or_loc}%'))).first()
        if item: return build_response(item, 'pn_1_Fuzzy')
        item = session.exec(select(AssetItem).where(AssetItem.pn_1.like(f'%{pn_or_loc}%'))).first()
        if item: return build_response(item, 'pn_1_Fuzzy')

        return {'error': t_lang("do.not_exist", lang)}

@router.get("/api/layout")
async def get_layout():
    try:
        if os.path.exists('layout.json'):
            with open('layout.json', 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    except Exception as e:
        return {'error': str(e)}

@router.post("/api/layout")
async def save_layout(request: Request, current_user: dict = Depends(require_admin)):
    lang = request.state.lang
    try:
        data = await request.json()
        with open('layout.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {'status': 'success', 'message': t_lang("do.saved_success", lang)}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}

def require_mobile_auth(request: Request):
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=status.HTTP_303_SEE_OTHER, headers={"Location": "/mobile/login"})
    return user

MOBILE_AUTH_TOKENS = {}
@router.post("/api/generate_mobile_token")
async def generate_mobile_token(current_user: dict = Depends(get_current_user)):
    token = str(uuid.uuid4())
    MOBILE_AUTH_TOKENS[token] = {
        'username': current_user['username'],
        'expires': datetime.now() + timedelta(minutes=10),
    }
    return {'status': 'success', 'token': token}

@router.get("/mobile/login", response_class=HTMLResponse)
async def mobile_login_page(request: Request, token: Optional[str] = None):
    lang = request.state.lang

    if request.session.get("user"):
        return RedirectResponse(url="/mobile/approve", status_code=303)

    if token:
        if token not in MOBILE_AUTH_TOKENS:
            return HTMLResponse(t_lang("do.qr_timeout", lang), status_code=403)

        token_data = MOBILE_AUTH_TOKENS[token]
        if datetime.now() > token_data['expires']:
            del MOBILE_AUTH_TOKENS[token]
            return HTMLResponse(t_lang("do.qr_timeout", lang), status_code=403)

        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == token_data['username'])).first()
            if user:
                request.session["user"] = {
                    "username": user.username,
                    "full_name": user.full_name,
                    "role": user.role
                }
                del MOBILE_AUTH_TOKENS[token]
                return RedirectResponse(url="/mobile/approve", status_code=303)

            return HTMLResponse(t_lang("settings.user_error", lang), status_code=404)

    return templates.TemplateResponse(request, "mobile_login.html", {"request": request})

@router.get("/mobile/approve", response_class=HTMLResponse)
async def mobile_approve_page(request: Request, current_user: dict = Depends(require_mobile_auth)):
    with Session(engine) as session:
        statement = select(OutboundRequest).where(OutboundRequest.status == 'Pending').order_by(OutboundRequest.created_at)
        requests = session.exec(statement).all()

        req_data = []
        for req in requests:
            item = session.get(InventoryItem, req.item_id)
            if item:
                req_data.append({'req': req, 'item': item})

    return templates.TemplateResponse(request, "mobile_approve.html", {
        "request": request,
        "user": current_user,
        "req_data": req_data
    })

@router.get("/mobile/upload", response_class=HTMLResponse)
async def mobile_upload_page(request: Request, current_user: dict = Depends(require_mobile_auth)):
    return templates.TemplateResponse(request, "mobile_upload.html", {
        "request": request,
        "user": current_user
    })

@router.get("/mobile/audit_asset", response_class=HTMLResponse)
async def mobile_audit_asset_page(request: Request, current_user: dict = Depends(require_mobile_auth)):
    lang = request.state.lang

    with Session(engine) as session:
        statement = select(AssetAuditRecord).order_by(AssetAuditRecord.expected_location)
        records = session.exec(statement).all()

        grouped = defaultdict(list)
        for r in records:
            loc = r.actual_location or r.expected_location or t_lang("asset_audit.unassigned_init_loc", lang)
            grouped[loc].append(r)

    return templates.TemplateResponse(request, "mobile_audit_asset.html", {
        "request": request,
        "user": current_user,
        "grouped": grouped,
        "lang": lang
    })

@router.get("/mobile/audit_inventory", response_class=HTMLResponse)
async def mobile_audit_inventory_page(request: Request, current_user: dict = Depends(require_mobile_auth)):
    lang = request.state.lang

    with Session(engine) as session:
        statement = select(AuditRecord).order_by(AuditRecord.expected_location)
        records = session.exec(statement).all()

        grouped = defaultdict(list)
        for r in records:
            loc = r.actual_location or r.expected_location or 'Unallocated'
            grouped[loc].append(r)

    return templates.TemplateResponse(request, "mobile_audit_inventory.html", {
        "request": request,
        "user": current_user,
        "grouped": grouped,
        "lang": lang
    })

@router.post("/api/mobile_upload_image")
async def mobile_upload_image(
        request: Request,
        pn: str = Form(...),
        file: UploadFile = File(...),
        current_user: dict = Depends(get_current_user)
):
    lang = request.state.lang
    if not pn or not file:
        return {"status": "error", "message": t_lang("do.req_not_met", lang)}
    with Session(engine) as session:
        statement_inv = select(InventoryItem).where(or_(InventoryItem.pn_1 == pn , InventoryItem.pn_2 == pn))
        inv_item = session.exec(statement_inv).first()
        statement_ass = select(AssetItem).where(or_(AssetItem.pn_1 == pn , AssetItem.pn_2 == pn))
        ass_items = session.exec(statement_ass).all()
        file_path = ""
        if inv_item:
            file_path = f'static/item_images/{inv_item.id}.jpg'
            inv_item.has_image = True
            session.add(inv_item)
        elif ass_items:
            file_path = f'static/asset_images/{ass_items[0].pn_1}.jpg'
            for item in ass_items:
                item.has_image = True
                session.add(item)
        else:
            return {"status": "error", "message": t_lang("do.not_exist", lang)}

        with open(file_path, 'wb') as f:
            f.write(await file.read())
        session.commit()
    return {'status': 'success', 'url': f'/{file_path}?t={datetime.now().timestamp()}'}

@router.get("/api/printer_status")
async def get_printer_status():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1.5)
            s.connect((utils.CURRENT_PRINTER_CONFIG['ip'], utils.CURRENT_PRINTER_CONFIG['port']))
        return {"status": "online"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@router.get("/reprint", response_class=HTMLResponse)
async def view_reprint_page(request: Request, current_user: dict = Depends(get_current_user)):
    return templates.TemplateResponse(request, "reprint.html", {"user": current_user, "active_page": "reprint"})

@router.post("/api/update_printer_config")
async def update_printer_config(request: Request, ip: str = Form(...), port: int = Form(...), current_user: dict = Depends(require_admin)):
    lang = request.state.lang
    utils.save_printer_config(ip, port)
    utils.CURRENT_PRINTER_CONFIG = {'ip': ip, 'port': port}
    return {'status': 'success', 'message': t_lang("do.success", lang)}

@router.post("/api/trigger_print")
async def trigger_print(
        request: Request,
        left_text: str = Form(""),
        right_barcode:str = Form(...),
        background_tasks: BackgroundTasks = BackgroundTasks(),
        current_user: dict = Depends(get_current_user)
):
    lang = request.state.lang
    background_tasks.add_task(utils.zpl_print_task, left_text, right_barcode)
    return {'status': 'success', 'message': t_lang("do.mission_sent", lang)}

@router.get("/api/asset_info/{ctrl_no}")
def get_asset_info_api(request: Request, ctrl_no: str, current: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        statement = select(AssetItem).where(AssetItem.ctrl_no == ctrl_no.strip())
        item = session.exec(statement).first()
        if not item:
            return {"error": t_lang("do.not_exist", lang)}
        return {"ctrl_no": item.ctrl_no, "pn_1": item.pn_1, "pn_2": item.pn_2, "name": item.name, "has_image": item.has_image}

# -----------------------------全局即时通信--------------------------#

@router.get("/api/chat/history")
async def get_chat_history(current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        statement = select(ChatMessage).order_by(desc(ChatMessage.id)).limit(200)
        messages = session.exec(statement).all()
        messages.reverse()
    return messages

@router.post("/api/chat/send")
async def send_chat_message(
        request: Request,
        message: str = Form(...),
        current_user: dict = Depends(get_current_user)
):
    lang = request.state.lang
    if not message.strip():
        return {"status": "error", "message": t_lang("chat.null_error", lang)}

    with Session(engine) as session:
        new_msg = ChatMessage(
            sender=current_user['username'],
            sender_full_name=current_user.get('full_name', current_user['username']),
            role=current_user['role'],
            message=message.strip(),
        )
        session.add(new_msg)
        session.commit()
    return {"status": "success"}
