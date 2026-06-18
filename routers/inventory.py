# /routers/inventory.py
from fastapi import Request, Form, UploadFile, File, Depends, BackgroundTasks, APIRouter
from fastapi.responses import HTMLResponse, StreamingResponse
from sqlmodel import Session, select, or_, desc, delete, func
from typing import List, Optional
from starlette.responses import RedirectResponse
from collections import defaultdict
import pandas as pd
import io
import os
from datetime import datetime


from database import engine
from models import InventoryItem, HistoryLog, AuditRecord, User, UserBookmark, OutboundRequest
from dependencies import get_current_user, require_admin
from core import templates, t_lang
from utils import update_single_usage, update_all_usage_stats, zpl_print_task

router = APIRouter(tags=['Inventory'])

# ============================================================= #
# =========================消耗品管理============================ #
# ============================================================= #
# -----------------------------物品信息--------------------------#

@router.get("/")
async def root(request: Request):
    user_agent = request.headers.get('User-Agent', '').lower()
    mobile_keywords = ["android", "iphone", "ipad", "ipod", "windows phone", "mobile"]
    is_mobile = any(keyword in user_agent for keyword in mobile_keywords)
    user = request.session.get('user')
    if is_mobile:
        return RedirectResponse(url="/mobile/approve" if user else "/mobile/login", status_code=303)
    else:
        return RedirectResponse(url="/all" if user else "/login", status_code=303)

@router.get("/all", response_class=HTMLResponse)
async def get_all(request: Request, query: Optional[str] = None, warning_only: Optional[str] = None,
                  current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        statement = select(InventoryItem)

        if query:
            statement = statement.where(
                or_(
                    InventoryItem.pn_1.like(f'%{query}%'),
                    InventoryItem.pn_2.like(f'%{query}%'),
                    InventoryItem.name.like(f'%{query}%'),
                    InventoryItem.description_1.like(f'%{query}%'),
                    InventoryItem.description_2.like(f'%{query}%'),
                    InventoryItem.remarks.like(f'%{query}%')
                )
            )
        else:
            statement = statement.order_by(desc(InventoryItem.usage_1y))

        is_warning = warning_only in ['on', 'true', '1']
        if is_warning:
            statement = statement.where(InventoryItem.warning_level > 0,
                                        InventoryItem.stock <= InventoryItem.warning_level)
        items = session.exec(statement).all()

        username = current_user.get('username')
        bm_statement = select(UserBookmark).where(UserBookmark.username == username)
        bookmarks = session.exec(bm_statement).all()
        user_bookmarks = [b.item_id for b in bookmarks]
    return templates.TemplateResponse(request, "inventory_cards.html", {'items': items, 'query': query, 'is_warning': is_warning, 'user': current_user, 'user_bookmarks': user_bookmarks, 'active_page': 'inventory'})

@router.post("/do_out/{item_id}")
async def do_out(
        request: Request,
        item_id: int,
        req_qty: int = Form(...),
        real_stock: int = Form(...),
        current_user: dict = Depends(get_current_user),
        dept: str = Form(...)
):
    lang = request.state.lang
    with Session(engine) as session:
        item = session.get(InventoryItem, item_id)
        if not item:
            return {'status': 'error', 'message': t_lang("do.not_exist", lang)}
        if item and item.stock != real_stock:
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

        if item and item.stock >= req_qty > 0:
            item.stock -= req_qty
            item.total_out = (item.total_out or 0) + req_qty
            session.add(item)

        real_applicant = current_user.get("full_name") or current_user.get("username")
        log = HistoryLog(
            pn_1=item.pn_1,
            pn_2=item.pn_2,
            change_qty=-req_qty,
            applicant=real_applicant,
            department=dept,
            note='OUT'
        )
        session.add(log)
        update_single_usage(session, item.pn_1)
        session.commit()
        session.refresh(item)
        return {
            'status': 'success',
            'data': {
                'id': item.id,
                'stock': item.stock,
                'total_out': item.total_out
            },
            'message': t_lang("do.success", lang)
        }

@router.post("/edit/{item_id}")
async def update_edit(
        request: Request,
        item_id: int,
        pn_1: str = Form(...),
        pn_2: str = Form(""),
        name: str = Form(...),
        description_1: str = Form(""),
        description_2: str = Form(""),
        stock: int = Form(...),
        location: str = Form(...),
        remarks: str = Form(""),
        current_user: dict = Depends(get_current_user)
):
    lang = request.state.lang
    with Session(engine) as session:
        item = session.get(InventoryItem, item_id)
        if not item:
            return {'status': 'error', 'message': t_lang("do.not_exist", lang)}

        item.pn_1 = pn_1
        item.pn_2 = pn_2
        item.name = name
        item.description_1 = description_1
        item.description_2 = description_2
        item.stock = stock
        item.location = location
        item.remarks = remarks
        session.add(item)
        session.commit()
        session.refresh(item)
        return {
            'status': 'success',
            'data': {
                'id': item.id,
                'pn_1': item.pn_1,
                'pn_2': item.pn_2,
                'name': item.name,
                'description_1': item.description_1,
                'description_2': item.description_2,
                'stock': item.stock,
                'location': item.location,
                'remarks': item.remarks
            },
            'message': t_lang("do.success", lang)
        }

@router.post("/api/upload_image/{item_id}")
async def upload_image(request: Request, item_id: int, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        item = session.get(InventoryItem, item_id)
        if not item:
            return {'status': 'error', 'message': t_lang("do.not_exist", lang)}

        file_path = f'static/item_images/{item_id}.jpg'
        with open(file_path, 'wb') as f:
            f.write(await file.read())

        item.has_image = True
        session.add(item)
        session.commit()

    return {'status': 'success', 'url': f'/{file_path}?t={datetime.now().timestamp()}'}

@router.post("/delete/{item_id}")
async def delete_item(request: Request, item_id: int, current_user: dict = Depends(require_admin)):
    with Session(engine) as session:
        item = session.get(InventoryItem, item_id)
        if item:
            log = HistoryLog(
                pn_1=item.pn_1,
                pn_2=item.pn_2,
                change_qty=-item.stock,
                applicant=current_user["full_name"],
                department='',
                note='Scrapped'
            )
            session.add(log)
            image_path = f'static/item_images/{item_id}.jpg'
            try:
                if os.path.exists(image_path):
                    os.remove(image_path)
            except Exception as e:
                print(f"Error deleting image file: {e}")
            session.delete(item)
            session.commit()
            referer = request.headers.get('referer')
            redirect_url = referer if referer else "/all"
    return RedirectResponse(url=redirect_url, status_code=303)


@router.post("/import")
async def import_excel(request: Request, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))

        with Session(engine) as session:
            try:
                session.exec(delete(InventoryItem))
                for _, row in df.iterrows():
                    pn_1 = str(row['pn_1'])
                    pn_2 = str(row['pn_2']) if not pd.isna(row['pn_2']) else ''
                    name = str(row['name']) if not pd.isna(row['name']) else ''
                    description_1 = str(row['description_1']) if not pd.isna(row['description_1']) else ''
                    description_2 = str(row['description_2']) if not pd.isna(row['description_2']) else ''
                    total_in = int(row['total_in']) if not pd.isna(row['total_in']) else 0
                    total_out = int(row['total_out']) if not pd.isna(row['total_out']) else 0
                    stock = int(row['stock']) if not pd.isna(row['stock']) else 0
                    location = str(row['location']) if not pd.isna(row['location']) else ''
                    first_in_date = str(row['first_in_date']) if not pd.isna(row['first_in_date']) else ''
                    remarks = str(row['remarks']) if not pd.isna(row['remarks']) else ''
                    has_image = bool(row['has_image']) if not pd.isna(row['has_image']) else False
                    new_item = InventoryItem(
                        pn_1=pn_1,
                        pn_2=pn_2,
                        name=name,
                        description_1=description_1,
                        description_2=description_2,
                        total_in=total_in,
                        total_out=total_out,
                        stock=stock,
                        location=location,
                        first_in_date=first_in_date,
                        remarks=remarks,
                        has_image=has_image,
                    )
                    session.add(new_item)
                session.commit()
            except Exception as inner_e:
                session.rollback()
                return {'status': t_lang("do.import_error", lang, error=str(inner_e))}

        return RedirectResponse(url="/backend", status_code=303)
    except Exception as e:
        return {"error": t_lang("do.read_excel_error", lang, error=str(e))}

# -----------------------------库存管理--------------------------#

@router.get("/inventory_table", response_class=HTMLResponse)
async def view_inventory_table(request: Request, current_user: dict = Depends(get_current_user)):
    if current_user.get('role') not in ['superadmin', 'admin']:
        return RedirectResponse(url= "/all", status_code=303)
    with Session(engine) as session:
        items =session.exec(select(InventoryItem).order_by(desc(InventoryItem.pn_1))).all()
        alarm_items = session.exec(select(InventoryItem).where(InventoryItem.warning_level > 0, InventoryItem.warning_level >= InventoryItem.stock)).all()
        alarm_count = len(alarm_items)
    return templates.TemplateResponse(request,"inventory_table.html", {"items": items, "user": current_user, "active_page": "inventory_table", "alarm_count": alarm_count})

@router.post("/api/update_advanced/{item_id}")
async def update_advanced(request: Request,
                          item_id: int,
                          warning_level: int = Form(0),
                          is_mva: str = Form(False),
                          current_user: dict = Depends(get_current_user)
):
    lang = request.state.lang
    with Session(engine) as session:
        item = session.get(InventoryItem, item_id)
        if item:
            item.warning_level = warning_level
            item.is_mva = (is_mva.lower() == 'true')
            session.add(item)
            session.commit()
    return {'status': 'success', 'message': t_lang("do.success", lang)}

@router.get("/all/export")
def export_all(request: Request, current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        contents = session.exec(select(InventoryItem)).all()
        data = []
        for c in contents:
            data.append({
                "PN1": c.pn_1,
                "PN2": c.pn_2,
                t_lang("inv.name", lang): c.name,
                t_lang("inv.description_1", lang): c.description_1,
                t_lang("inv.description_2", lang): c.description_2,
                t_lang("inv.total_in", lang): c.total_in,
                t_lang("inv.total_out", lang): c.total_out,
                t_lang("inv.stock", lang): c.stock,
                t_lang("inv.location", lang): c.location,
                t_lang("inv.first_in_date", lang): c.first_in_date,
                t_lang("inv.remarks", lang): c.remarks,
                t_lang("inv.usage_1y", lang): c.usage_1y,
                t_lang("inv.usage_2y", lang): c.usage_2y,
                t_lang("inv.usage_3y", lang): c.usage_3y,
                t_lang("inv.warning_level", lang): c.warning_level,
                t_lang("inv.is_mva", lang): c.is_mva
            })
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)

        headers = {
            'Content-Disposition': f'attachment; filename="Inventory_details_{datetime.now().strftime("%Y%m%d")}.xlsx"'
        }
        return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@router.get("/all/mva_export")
def export_mva(request: Request, current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        contents = session.exec(select(InventoryItem).where(InventoryItem.is_mva == True, InventoryItem.warning_level > 0, InventoryItem.warning_level > InventoryItem.stock)).all()
        data = []
        for c in contents:
            data.append({
                "Equipment Name(English)": c.name,
                "Equipment Name(Chinese)": c.description_2,
                "Pega PN.": c.pn_1,
                "Demand At Least": c.warning_level-c.stock,
                "Remarks": c.remarks,
            })
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)

        headers = {
            'Content-Disposition': f'attachment; filename="MVA_required_{datetime.now().strftime("%Y%m%d")}.xlsx"'
        }
        return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

# -----------------------------快速入库--------------------------#

@router.get("/stock_in", response_class=HTMLResponse)
async def stock_in(request: Request, current_user: dict = Depends(get_current_user)):
    return templates.TemplateResponse(request, "stock_in.html", {"request": request, "user": current_user, "active_page": "stock_in"})

@router.post("/batch_submit")
async def batch_submit(
        background_tasks: BackgroundTasks,
        pn_1: List[str] = Form(default=[]),
        pn_2: List[str] = Form(default=[]),
        name: List[str] = Form(default=[]),
        description_1: List[str] = Form(default=[]),
        description_2: List[str] = Form(default=[]),
        stock:List[str] = Form(default=[]),
        location:List[str] = Form(default=[]),
        first_in_date: List[str] = Form(default=[]),
        remarks: List[str] = Form(default=[]),
        current_user: dict = Depends(get_current_user)
):
    with Session(engine) as session:
        for i in range(len(pn_1)):
            current_pn = pn_1[i].strip()
            if not current_pn:
                continue

            safe_qty_str = stock[i].strip() if i < len(stock) else ''
            incoming_stock = int(safe_qty_str) if safe_qty_str.isdigit() else 0

            safe_pn_2 = pn_2[i].strip() if i < len(pn_2) else ''
            safe_name = name[i].strip() if i < len(name) else ''
            safe_desc1 = description_1[i].strip() if i < len(description_1) else ''
            safe_desc2 = description_2[i].strip() if i < len(description_2) else ''
            safe_loc = location[i].strip() if i < len(location) else ''
            safe_date = first_in_date[i].strip() if i < len(first_in_date) else ''
            safe_remarks = remarks[i].strip() if i < len(remarks) else ''

            statement = select(InventoryItem).where(InventoryItem.pn_1 == current_pn)
            db_item = session.exec(statement).first()

            if db_item:
                db_item.stock = (db_item.stock or 0) + incoming_stock
                db_item.total_in = (db_item.total_in or 0) + incoming_stock
                db_item.name = safe_name if safe_name else db_item.name
                db_item.description_1 = safe_desc1 if safe_desc1 else db_item.description_1
                db_item.description_2 = safe_desc2 if safe_desc2 else db_item.description_2
                db_item.location = safe_loc if safe_loc else db_item.location
                db_item.first_in_date = safe_date if safe_date else db_item.first_in_date
                db_item.remarks = safe_remarks if safe_remarks else db_item.remarks
                session.add(db_item)
            else:
                new_item = InventoryItem(
                    pn_1=current_pn,
                    pn_2=safe_pn_2,
                    name=safe_name if safe_name else "No Name",
                    description_1=safe_desc1,
                    description_2=safe_desc2,
                    stock=incoming_stock,
                    location=safe_loc,
                    first_in_date=safe_date,
                    remarks=safe_remarks,
                )
                session.add(new_item)
                background_tasks.add_task(zpl_print_task, left_text=safe_pn_2, right_barcode=current_pn)
            if incoming_stock > 0:
                real_applicant = current_user.get('full_name') or current_user.get('username')
                log = HistoryLog(
                    pn_1=current_pn,
                    pn_2=safe_pn_2,
                    change_qty=incoming_stock,
                    applicant=real_applicant,
                    department='-',
                    note=safe_remarks,
                )
                session.add(log)
        session.commit()
    return RedirectResponse(url= "/stock_in", status_code=303)

# -----------------------------历史记录--------------------------#

@router.get('/history', response_class=HTMLResponse)
async def view_history(request: Request, current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        statement = select(HistoryLog).order_by(desc(HistoryLog.id))
        logs = session.exec(statement).all()

    return templates.TemplateResponse(request, "history.html", {'logs': logs, 'user': current_user, 'active_page': 'history'})

@router.post("/undo/{log_id}")
async def undo_history_log(request: Request, log_id: int, current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        log = session.get(HistoryLog, log_id)
        if not log:
            return HTMLResponse('No logs found.', status_code=404)

        if log.note and ('Undo Record' in log.note or 'Imported Log' in log.note or 'Scrapped' in log.note):
            return RedirectResponse(url= "/history", status_code=303)

        statement = select(InventoryItem).where(InventoryItem.pn_1 == log.pn_1)
        item = session.exec(statement).first()
        if not item:
            return HTMLResponse(t_lang("do.undo_fail", lang), status_code=404)

        revert_qty = -log.change_qty
        item.stock = (item.stock or 0) + revert_qty

        if log.change_qty > 0:
            item.total_in = (item.total_in or 0) - log.change_qty
        elif log.change_qty < 0:
            item.total_out = (item.total_out or 0) + log.change_qty
        session.add(item)

        log.note = f"{log.note or ''} Undone"
        session.add(log)

        undo_log = HistoryLog(
            pn_1 = log.pn_1,
            pn_2 = log.pn_2,
            change_qty = revert_qty,
            applicant = current_user["full_name"],
            department = log.department,
            note = f"Undo Record ID: {log.id}",
        )
        session.add(undo_log)

        update_single_usage(session, log.pn_1)
        session.commit()

    return RedirectResponse(url= "/history", status_code=303)

@router.post("/import_history_excel")
async def import_history_excel(request: Request, file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    lang = request.state.lang
    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
        df = df.where(pd.notnull(df), None)
        with Session(engine) as session:
            try:
                session.exec(delete(HistoryLog))
                for _, row in df.iterrows():
                    now_log = HistoryLog(
                        date=str(row['date'])[:10] if row['date'] else datetime.now().strftime("%Y-%m-%d"),
                        pn_1=str(row['PN1']),
                        pn_2=str(row['PN2']) if not pd.isna(row['PN2']) else "",
                        change_qty=int(row['chang_qty']),
                        applicant=str(row['applicant']) if row['applicant'] else "",
                        department=str(row['department']) if row['department'] else "",
                        note=str(row['note'])+"Imported Log" if not pd.isna(row['note']) else "Imported Log"
                    )
                    session.add(now_log)
                session.commit()
                update_all_usage_stats(session)
            except Exception as inner_e:
                session.rollback()
                return {"error": t_lang("do.import_error", lang, error=str(inner_e))}
        return RedirectResponse(url= "/backend", status_code=303)
    except Exception as e:
        return {"error": t_lang("do.read_excel_error", lang ,error=str(e))}

@router.get("/history/export")
def export_history(request: Request, current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        contents = session.exec(select(HistoryLog)).all()
        data = []
        for c in contents:
            data.append({
                t_lang("inv.date", lang): c.date,
                "PN1": c.pn_1,
                "PN2": c.pn_2,
                t_lang("inv.change_qty", lang): c.change_qty,
                t_lang("inv.applicant", lang): c.applicant,
                t_lang("inv.department", lang): c.department,
                t_lang("inv.remarks", lang): c.note
            })
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)

        headers = {
            'Content-Disposition': f'attachment; filename="History_Logs_{datetime.now().strftime("%Y%m%d")}.xlsx"'
        }
        return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

# -----------------------------盘点工作台--------------------------#

@router.get("/audit", response_class=HTMLResponse)
async def view_audit(request: Request, current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        statement = select(AuditRecord).order_by(AuditRecord.expected_location)
        records = session.exec(statement).all()
        total = len(records)
        completed = sum(1 for r in records if r.status != 'Pending')
        progress = int((completed / total * 100)) if total > 0 else 0

        grouped = defaultdict(list)
        for r in records:
            loc = r.actual_location or r.expected_location or 'Unallocated'
            grouped[loc].append(r)
    return templates.TemplateResponse(request, "audit.html", {"records": records, "total": total, "progress": progress, "completed": completed, "grouped": grouped, "user": current_user, "active_page": "audit"})

@router.post("/audit/start")
async def start_audit(request: Request, current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        for old_record in session.exec(select(AuditRecord)).all():
            session.delete(old_record)

        items = session.exec(select(InventoryItem)).all()
        for item in items:
            record = AuditRecord(
                item_id=item.id,
                pn_1=item.pn_1,
                pn_2=item.pn_2,
                name=item.name,
                expected_stock=item.stock or 0,
                expected_location=item.location,
                actual_stock=item.stock or 0,
                actual_location=item.location,
                status='Pending',
            )
            session.add(record)
        session.commit()
    referer = request.headers.get("referer", "")
    target_url = "/mobile/audit_inventory" if "mobile" in referer else "/audit"
    return RedirectResponse(url=target_url, status_code=303)

@router.post("/audit/submit/{audit_id}")
async def submit_audit(
        request: Request,
        audit_id: int,
        actual_stock: int = Form(...),
        actual_location: str = Form(""),
        remarks: str = Form("")
):
    lang = request.state.lang
    with Session(engine) as session:
        record = session.get(AuditRecord, audit_id)
        if not record:
            return {'status': 'error', 'message': t_lang("do.not_exist", lang)}
        record.actual_stock = actual_stock
        record.actual_location = actual_location
        record.remarks = remarks

        loc_match = (not actual_location) or (actual_location.strip() == (record.expected_location or "").strip())
        if actual_stock == record.expected_stock and loc_match:
            record.status = "Matched"
        else:
            record.status = "Mismatched"

        session.add(record)
        session.commit()
        session.refresh(record)
    return {
        'status': 'success',
        'message': t_lang("do.success", lang),
        'data': {
            'id': record.id,
            'status': record.status,
            'actual_stock': record.actual_stock,
            'actual_location': record.actual_location,
            'remarks': record.remarks,
        }
    }

@router.post("/audit/submit_by_pn")
async def submit_audit_by_pn(
        request: Request,
        pn_1: str = Form(...),
        actual_stock: int = Form(...),
        actual_location: str = Form(""),
        remarks: str = Form("")
):
    lang = request.state.lang
    with Session(engine) as session:
        statement = select(AuditRecord).where(AuditRecord.pn_1 == pn_1)
        record = session.exec(statement).first()
        if not record:
            return {'status': 'error', 'message': t_lang("do.not_exist", lang)}

        record.actual_stock = actual_stock
        record.actual_location = actual_location
        record.remarks = remarks

        loc_match = (not actual_location) or (actual_location.strip() == (record.expected_location or "").strip())
        if actual_stock == record.expected_stock and loc_match:
            record.status = "Matched"
        else:
            record.status = "Mismatched"

        session.add(record)
        session.commit()
    return {
        'status': 'success',
        'message': t_lang("do.scan_success", lang),
        'is_location_changed': record.expected_location != actual_location,
        'data': {
            'id': record.id,
            'pn_1': record.pn_1,
            'status': record.status,
            'actual_stock': record.actual_stock,
            'actual_location': record.actual_location,
            'remarks': record.remarks,
        }
    }

@router.get("/audit/export")
def export_audit(request: Request, current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        records = session.exec(select(AuditRecord)).all()
        data = []
        for r in records:
            data.append({
                t_lang("inv.audit_status", lang): r.status,
                "PN1": r.pn_1,
                "PN2": r.pn_2,
                t_lang("inv.name", lang): r.name,
                t_lang("inv.expected_stock", lang): r.expected_stock,
                t_lang("inv.actual_stock", lang): r.actual_stock,
                t_lang("inv.expected_location", lang): r.expected_location,
                t_lang("inv.actual_location", lang): r.actual_location,
                t_lang("inv.remarks", lang): r.remarks
            })
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)

        headers = {
            'Content-Disposition': f'attachment; filename="Audit_Report_{datetime.now().strftime("%Y%m%d")}.xlsx"'
        }
        return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')