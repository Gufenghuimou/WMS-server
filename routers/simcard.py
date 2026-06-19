# /routers/simcard.py
from fastapi import Request, Form, UploadFile, File, Depends, APIRouter
from fastapi.responses import HTMLResponse
from sqlmodel import Session, select, or_, desc, delete
from typing import Optional, List
from starlette.responses import RedirectResponse, StreamingResponse
from collections import defaultdict
import pandas as pd
import io
import os
from datetime import datetime

from database import engine
from models import PhysicalSimCard, PhysicalSimCardLog
from dependencies import get_current_user, require_admin
from core import templates, t_lang

router = APIRouter(tags=["Simcard"])


@router.get("/simcard", response_class=HTMLResponse)
async def get_simcard(request: Request, query: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        statement = select(PhysicalSimCard)

        if query:
            statement = statement.where(
                or_(
                    PhysicalSimCard.icc_id.like(f'%{query}%'),
                    PhysicalSimCard.carrier.like(f'%{query}%'),
                    PhysicalSimCard.phone_number.like(f'%{query}%'),
                    PhysicalSimCard.location.like(f'%{query}%'),
                    PhysicalSimCard.direct_user.like(f'%{query}%'),
                    PhysicalSimCard.project.like(f'%{query}%'),
                    PhysicalSimCard.note.like(f'%{query}%')
                )
            )
        else:
            statement = statement.order_by(PhysicalSimCard.project)
        items = session.exec(statement).all()
        total = len(items)

    return templates.TemplateResponse(request, "simcard.html", {"request": request, "items": items, 'query': query, 'user': current_user, 'active_page': 'simcard', 'simcard_total_count': total})

@router.post("/simcard_out/{item_id}")
async def simcard_out(
        request: Request,
        item_id: int,
        target_loc: str = Form(""),
        target_user: str = Form(""),
        target_project: str = Form(""),
        current_user: dict = Depends(get_current_user)
):
    lang = request.state.lang
    with Session(engine) as session:
        item = session.get(PhysicalSimCard, item_id)
        if not item:
            return RedirectResponse(url="/simcard", status_code=303)

        was_in_stock = item.is_stock
        if was_in_stock:
            item.is_stock = False
            item.location = target_loc
            item.direct_user = target_user
            item.project = target_project
            action_note = 'OUT'
        else:
            item.is_stock = True
            item.location = 'Warehouse'
            item.direct_user = ''
            item.project = ''
            action_note = 'RETURN'
        session.add(item)

        log = PhysicalSimCardLog(
            icc_id = item.icc_id,
            phone_number = item.phone_number,
            target_loc = item.location,
            target_user = item.direct_user,
            target_project = item.project,
            action = action_note,
        )
        session.add(log)
        session.commit()
        session.refresh(item)
        return {
            'status': 'success',
            'data': {
                'id': item.id,
                'is_stock': item.is_stock,
                'location': item.location,
            },
            'message': t_lang("do.success", lang)
        }

@router.post("/simcard_edit/{item_id}")
async def simcard_edit(
        request: Request,
        item_id: int,
        icc_id: str = Form(...),
        carrier: str = Form(...),
        phone_number: str = Form(...),
        location: str = Form(...),
        direct_user: str = Form(""),
        project: str = Form(""),
        note: str = Form("")
):
    lang = request.state.lang
    with Session(engine) as session:
        statement = select(PhysicalSimCard).where(PhysicalSimCard.id==item_id)
        item = session.exec(statement).first()
        if not item:
            return {'status': 'error', 'message': t_lang("do.not_exist", lang)}
        item.icc_id = icc_id.replace(" ", "").strip()
        item.carrier = carrier
        item.phone_number = phone_number
        item.location = location
        item.direct_user = direct_user
        item.project = project
        item.note = note
        session.add(item)
        session.commit()
        session.refresh(item)
    return {
        'status': 'success',
        'data': {
            'id': item.id,
            'icc_id': item.icc_id,
            'carrier': item.carrier,
            'phone_number': item.phone_number,
            'location': item.location,
            'direct_user': item.direct_user,
            'project': item.project,
            'note': item.note
        },
        'message': t_lang("do.success", lang)
    }

@router.post("/simcard_active_toggle/{item_id}")
async def simcard_active_toggle(
        request: Request,
        item_id: int,
        current_user: dict = Depends(get_current_user)
):
    lang = request.state.lang
    with Session(engine) as session:
        item = session.get(PhysicalSimCard, item_id)
        if not item:
            return {'status': 'error', 'message': t_lang("do.not_exist", lang)}
        item.is_active = not item.is_active
        item.is_stock = True
        item.location = 'Warehouse'
        item.direct_user = ''
        item.project = ''
        session.add(item)
        if item.is_active:
            action_note = 'Enable'
        else:
            action_note = 'Disable'
        log = PhysicalSimCardLog(
            icc_id=item.icc_id,
            phone_number=item.phone_number,
            target_loc=item.location,
            target_user='',
            target_project='',
            action=action_note
        )
        session.add(log)
        session.commit()
        session.refresh(item)
        return {
            'status': 'success',
            'data': {
                'id': item.id,
                'is_active': item.is_active,
                'location': item.location
            },
            'message': t_lang("do.success", lang)
        }

@router.get("/simcard_stock_in", response_class=HTMLResponse)
async def simcard_stock_in(request: Request,current_user: dict = Depends(get_current_user)):
    return templates.TemplateResponse(request, "simcard_stock_in.html", {"request": request, "user": current_user, 'active_page': 'simcard_stock_in'})

@router.post("/simcard_batch_submit")
async def simcard_batch_submit(
        icc_id: List[str] = Form(default=[]),
        carrier: List[str] = Form(default=[]),
        phone_number: List[str] = Form(default=[]),
        note: List[str] = Form(default=[]),
):
    with Session(engine) as session:
        for i in range(len(icc_id)):
            current_icc_id = icc_id[i].replace(" ", "").strip()
            if not current_icc_id:
                continue
            new_simcard = PhysicalSimCard(
                icc_id = current_icc_id,
                carrier = carrier[i].strip() if i < len(carrier) else "",
                phone_number = phone_number[i].strip() if i < len(phone_number) else "",
                is_active = True,
                is_stock = True,
                location = "Warehouse",
                direct_user = "",
                project = "",
                note = note[i] if i < len(note) else "",
            )
            session.add(new_simcard)
            log = PhysicalSimCardLog(
                icc_id = current_icc_id,
                phone_number = new_simcard.phone_number,
                target_loc = new_simcard.location,
                target_user = new_simcard.direct_user,
                target_project = new_simcard.project,
                action = "Initial Receiving"
            )
            session.add(log)
        session.commit()
    return RedirectResponse("/simcard_stock_in", status_code=303)

@router.get("/simcard/export")
def simcard_export(request: Request, current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        contents = session.exec(select(PhysicalSimCard)).all()
        data = []
        for c in contents:
            data.append({
                'ICCID': c.icc_id,
                'Carrier': c.carrier,
                'Phone Number': c.phone_number,
                'Active': c.is_active,
                'Stocking': c.is_stock,
                'Location': c.location,
                'Direct User': c.direct_user,
                'Project': c.project,
                'Note': c.note
            })
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)

        headers = { 'Content-Disposition': f'attachment; filename="Simcard_details_{datetime.now().strftime("%Y%m%d")}.xlsx"' }
        return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@router.post("/simcard_delete/{item_id}")
async def simcard_delete(request: Request, item_id: int, current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        item = session.get(PhysicalSimCard, item_id)
        if item:
            log = PhysicalSimCardLog(
                icc_id = item.icc_id,
                phone_number = item.phone_number,
                target_loc = '',
                target_user = '',
                target_project = '',
                action = 'Scrap'
            )
            session.add(log)
            session.delete(item)
            session.commit()
            referer = request.headers.get('referer')
            redirect_url = referer if referer else "/all"
    return RedirectResponse(url=redirect_url, status_code=303)

@router.get("/simcard_history", response_class=HTMLResponse)
async def simcard_history(request: Request, current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        statement = select(PhysicalSimCardLog).order_by(desc(PhysicalSimCardLog.id))
        logs = session.exec(statement).all()
    return templates.TemplateResponse(request, "simcard_history.html", {'logs': logs, 'user': current_user, 'active_page': 'simcard_history'})

@router.get("/simcard_history/export")
def simcard_history_export(current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        contents = session.exec(select(PhysicalSimCardLog)).all()
        data = []
        for c in contents:
            data.append({
                'Date': c.date,
                'ICCID': c.icc_id,
                'Phone Number': c.phone_number,
                'Target Location': c.target_loc,
                'Target User': c.target_user,
                'Target Project': c.target_project,
                'Action': c.action
            })
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)

        headers = {
            'Content-Disposition': f'attachment; filename="Simcard_History_Logs_{datetime.now().strftime("%Y%m%d")}.xlsx"',
        }
        return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')