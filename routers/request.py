# request.py
from fastapi import Request, Form, UploadFile, File, Depends, BackgroundTasks, APIRouter
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic_core.core_schema import none_schema
from sqlmodel import Session, select, or_, desc, delete, func
from typing import List, Optional
from starlette.responses import RedirectResponse
from collections import defaultdict
import pandas as pd
import io
import os
from datetime import datetime


from database import engine
from models import InventoryItem, HistoryLog, OutboundRequest, AssetRequest, AssetItem, AssetLog
from dependencies import get_current_user, require_admin
from core import templates, t_lang
from utils import update_single_usage

router = APIRouter(tags=['Request'])
# -----------------------------申请队列--------------------------#

@router.get("/request_queue", response_class=HTMLResponse)
async def view_request_queue(request: Request, error: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') not in ['superadmin', 'admin']:
        return RedirectResponse(url= "/all", status_code=303)

    with Session(engine) as session:
        statement = select(OutboundRequest).where(OutboundRequest.status == 'Pending').order_by(OutboundRequest.created_at)
        requests = session.exec(statement).all()
        req_data = []
        for req in requests:
            item = session.get(InventoryItem, req.item_id)
            req_data.append({'req': req, 'item': item})

    with Session(engine) as session:
        statement = select(AssetRequest).where(AssetRequest.status == 'Pending').order_by(AssetRequest.created_at)
        requests = session.exec(statement).all()
        asset_req_data = []
        for req in requests:
            asset = None
            asset = session.exec(select(AssetItem).where(AssetItem.ctrl_no == req.ctrl_no)).first()
            asset_req_data.append({'req': req, 'asset': asset})
    return templates.TemplateResponse(request, 'request_queue.html', {'req_data': req_data, 'asset_req_data': asset_req_data, 'user': current_user, 'active_page': 'request_queue', 'error': error})

@router.post("/api/request_item/{item_id}")
async def submit_outbound_request(
        request: Request,
        item_id: int,
        req_qty: int = Form(...),
        department: str = Form(...),
        note: str = Form(""),
        current_user: dict = Depends(get_current_user),
):
    lang = request.state.lang
    with Session(engine) as session:
        item = session.get(InventoryItem, item_id)
        if not item:
            return {'status': 'error', 'message': t_lang("do.not_exist", lang)}

        if req_qty < 0:
            return {'status': 'error', 'message': t_lang("do.illegal_number_1", lang)}
        if req_qty > (item.stock or 0):
            return {'status': 'error', 'message': t_lang("do.illegal_number_2", lang)}

        real_applicant = current_user.get('full_name') or current_user.get('username')
        new_request = OutboundRequest(
            item_id=item_id,
            pn_1=item.pn_1,
            item_name=item.name,
            req_qty=req_qty,
            applicant=real_applicant,
            applicant_username=current_user.get('username'),
            department=department.strip(),
            note=note.strip()
        )

        session.add(new_request)
        session.commit()

    return {'status': 'success', 'message': t_lang("do.success", lang)}

@router.post("/api/request_asset/{ctrl_no}")
async def submit_asset_request(
        request: Request,
        ctrl_no: str,
        matter: str = Form(...),
        department: str = Form(...),
        note: str = Form(""),
        current_user: dict = Depends(get_current_user)
):
    lang = request.state.lang
    with Session(engine) as session:
        asset = session.exec(select(AssetItem).where(AssetItem.ctrl_no == ctrl_no)).first()
        if not asset:
            return {'status': 'error', 'message': t_lang("do.not_exist", lang)}
        if not matter:
            return {'status': 'error', 'message': "Illegal matter"}
        real_applicant = current_user.get('full_name') or current_user.get('username')
        new_request = AssetRequest(
            ctrl_no=ctrl_no,
            pn_1=asset.pn_1,
            asset_name=asset.name,
            matter=matter,
            req_qty=1,
            applicant=real_applicant,
            applicant_username=current_user.get('username'),
            department=department.strip(),
            note=note.strip()
        )
        session.add(new_request)
        session.commit()
    return {'status': 'success', 'message': t_lang("do.success", lang)}

@router.post("/api/request_asset_by_pn/{pn_1}")
async def submit_asset_request_pn(
        request: Request,
        pn_1: str,
        matter: str=Form(...),
        req_qty: int=Form(...),
        department: str=Form(...),
        note: str=Form(""),
        current_user: dict = Depends(get_current_user)
):
    lang = request.state.lang
    with Session(engine) as session:
        statement = select(AssetItem).where(AssetItem.pn_1 == pn_1)
        assets = session.exec(statement).all()
        if not assets:
            return {'status': 'error', 'message': t_lang("do.not_exist", lang)}
        if not matter:
            return {'status': 'error', 'message': "Illegal matter"}
        if req_qty < 0:
            return {'status': 'error', 'message': t_lang("do.illegal_number_1", lang)}
        stock = []
        for a in assets:
            if a.is_stock:
                stock.append(a)
        if req_qty > len(stock):
            return {'status': 'error', 'message': t_lang("do.illegal_number_2", lang)}
        real_applicant = current_user.get('full_name') or current_user.get('username')
        new_request = AssetRequest(
            pn_1=assets[0].pn_1,
            asset_name=assets[0].name,
            matter=matter,
            req_qty=req_qty,
            applicant=real_applicant,
            applicant_username=current_user.get('username'),
            department=department.strip(),
            note=note.strip()
        )
        session.add(new_request)
        session.commit()
    return {'status': 'success', 'message': t_lang("do.success", lang)}

@router.post('/request_queue/approve/{req_id}')
async def approve_request(
        req_id: int,
        real_stock: int = Form(...),
        current_user: dict = Depends(get_current_user),
):
    with Session(engine) as session:
        req = session.get(OutboundRequest, req_id)
        if not req or req.status != 'Pending':
            return RedirectResponse(url= "/request_queue", status_code=303)

        item = session.get(InventoryItem, req.item_id)
        if not item:
            return RedirectResponse(url= "/request_queue", status_code=303)

        if item.stock != real_stock:
            diff = real_stock - item.stock
            item.stock = real_stock
            session.add(item)

            log_adjust = HistoryLog(
                pn_1=item.pn_1,
                pn_2=item.pn_2,
                change_qty=diff,
                applicant='System',
                department='-',
                note='Stock Correction'
            )
            session.add(log_adjust)

        if item and item.stock >= req.req_qty > 0:
            item.stock -= req.req_qty
            item.total_in = (item.total_out or 0) + req.req_qty
            session.add(item)

        log = HistoryLog(
            pn_1=item.pn_1,
            pn_2=item.pn_2,
            change_qty=-req.req_qty,
            applicant=req.applicant,
            department=req.department,
            note=req.note or ''
        )
        session.add(log)

        req.status = 'Approved'
        session.add(req)

        update_single_usage(session,item.pn_1)
        session.commit()

    return RedirectResponse(url= "/request_queue", status_code=303)

@router.post("/request_queue/asset_approve/{req_id}")
async def approve_asset_request(request: Request, req_id: int, target_location: str = Form(None), ctrl_nos: str=Form(None), current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        req = session.get(AssetRequest, req_id)
        if not req or req.status != 'Pending':
            return {'status': 'error', 'message': "Request invalid or already processed"}
        asset = session.exec(select(AssetItem).where(AssetItem.ctrl_no == req.ctrl_no)).first() if req.ctrl_no else None
        if req.matter in ['return', 'broken'] and not asset:
            return {'status': 'error', 'message': 'Target asset not found in database'}
        if req.matter == 'return':
            conditions = [AssetItem.pn_1 == asset.pn_1]
            sibling = session.exec(select(AssetItem).where(AssetItem.is_stock == True, AssetItem.id != asset.id, or_(*conditions))).first()
            origin = str(sibling.location).strip() if sibling else ''
            asset.is_stock = True
            asset.location = target_location.strip() if target_location else origin
            log = AssetLog(
                ctrl_no=asset.ctrl_no,
                pn_1=asset.pn_1,
                pn_2=asset.pn_2,
                name=asset.name,
                status=asset.is_stock,
                target_loc=asset.location,
                note=f"Return Approved. Prev User: {req.applicant}"
            )
            session.add(log)
        elif req.matter == 'broken':
            asset.location = 'NG Area'
            asset.is_stock = True
            asset.is_stop = True
            log = AssetLog(
                ctrl_no=asset.ctrl_no,
                pn_1=asset.pn_1,
                pn_2=asset.pn_2,
                name=asset.name,
                status=asset.is_stock,
                target_loc=asset.location,
                note=f"Broken Approved. Prev User: {req.applicant}"
            )
            session.add(log)
        elif req.matter == 'require':
            if not ctrl_nos:
                return {'status': 'error', 'message': 'Please scan at least one SN'}
            ctrl_no_list = [c.strip() for c in ctrl_nos.split(',') if c.strip()]
            if len(set(ctrl_no_list)) != len(ctrl_no_list):
                return {'status': 'error', 'message': 'Security Reject: Duplicate SNs detected'}
            if len(ctrl_no_list) != req.req_qty:
                return {'status': 'error', 'message': 'Security Reject: Qty mismatch'}
            assets_to_dispatch = []
            for c in ctrl_no_list:
                ast = session.exec(select(AssetItem).where(AssetItem.ctrl_no == c)).first()
                if not ast:
                    return {'status': 'error', 'message': t_lang("queue.check_not_found", lang, c=c)}
                if ast.pn_1 != req.pn_1:
                    return {'status': 'error', 'message': t_lang("queue.check_wrong_pn", lang, c=c, pn=req.pn_1)}
                if not ast.is_stock:
                    return {'status': 'error', 'message': t_lang("queue.check_illegal", lang, c=c)}
                if ast.is_stop:
                    return {'status': 'error', 'message': t_lang("queue.check_stop", lang, c=c)}
                assets_to_dispatch.append(ast)

            for ast in assets_to_dispatch:
                ast.is_stock = False
                ast.location = req.department

                log = AssetLog(
                    ctrl_no=ast.ctrl_no,
                    pn_1=ast.pn_1,
                    pn_2=ast.pn_2,
                    name=ast.name,
                    target_loc=ast.location,
                    note=f"Dispatch Approved. Req ID: {req.id}. Applicant: {req.applicant}"
                )
                session.add(log)
                session.add(ast)

        req.status = 'Approved'
        session.add(req)
        session.commit()
    return {'status': 'success', 'message': t_lang("do.success", lang)}


@router.post('/request_queue/reject/{req_id}')
async def reject_request(request: Request, req_id: int, current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        req = session.get(OutboundRequest, req_id)
        if req and req.status == 'Pending':
            req.status = 'Rejected'
            session.add(req)
            session.commit()
    return {'status': 'success', 'message': t_lang("do.success", lang)}

@router.post("/request_queue/asset_reject/{req_id}")
async def reject_asset_request(request: Request, req_id: int, current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        req = session.get(AssetRequest, req_id)
        if req and req.status == 'Pending':
            req.status = 'Rejected'
            session.add(req)
            session.commit()
    return {'status': 'success', 'message': t_lang("do.success", lang)}

@router.get("/request_log", response_class=HTMLResponse)
async def view_request_log(request: Request, current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        real_applicant = current_user.get('full_name') or current_user.get('username')

        if current_user.get('role') not in ['superadmin', 'admin']:
            statement_inv = select(OutboundRequest).where(OutboundRequest.applicant == real_applicant).order_by(desc(OutboundRequest.id))
        else:
            statement_inv = select(OutboundRequest).order_by(desc(OutboundRequest.id))
        req_log = session.exec(statement_inv).all()

        if current_user.get('role') not in ['superadmin', 'admin']:
            statement_ast = select(AssetRequest).where(AssetRequest.applicant == real_applicant).order_by(desc(AssetRequest.id))
        else:
            statement_ast = select(AssetRequest).order_by(desc(AssetRequest.id))
        asset_req_log = session.exec(statement_ast).all()

        processed_count = session.exec(select(func.count(OutboundRequest.id)).where(OutboundRequest.status != 'Pending')).one()
        processed_count += session.exec(select(func.count(AssetRequest.id)).where(AssetRequest.status != 'Pending')).one()
    return templates.TemplateResponse(request, 'request_log.html', {'req_log': req_log, 'asset_req_log': asset_req_log, 'user': current_user, 'active_page': 'request_log', 'processed_count': processed_count})

@router.get("/request_log/export")
def request_log_export(request: Request, current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        if current_user.get('role') in ['superadmin', 'admin']:
            real_applicant = current_user.get('full_name') or current_user.get('username')
            statement = select(OutboundRequest).where(OutboundRequest.applicant == real_applicant).order_by(desc(OutboundRequest.id))
        else:
            statement = select(OutboundRequest).order_by(desc(OutboundRequest.id))
        contents = session.exec(statement).all()
        data = []
        for c in contents:
            data.append({
                t_lang("inv.created_at", lang): c.created_at,
                'PN1': c.pn_1,
                'PN2': c.pn_2,
                t_lang("inv.name", lang): c.item_name,
                t_lang("inv.req_qty", lang): c.req_qty,
                t_lang("inv.applicant", lang): c.applicant,
                t_lang("inv.department", lang): c.department,
                t_lang("inv.remarks", lang): c.note,
                t_lang("inv.status", lang): c.status,
            })
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)

        headers = {
            'Content-Disposition': f'attachment; filename="Request Logs {datetime.now().strftime("%Y%m%d")}.xlsx"',
        }
        return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
