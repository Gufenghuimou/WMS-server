# /routers/asset.py
from fastapi import Request, Form, UploadFile, File, Depends, BackgroundTasks, APIRouter
from fastapi.responses import HTMLResponse, StreamingResponse
from sqlmodel import Session, select, or_, desc, delete
from typing import List, Optional
from starlette.responses import RedirectResponse
from collections import defaultdict
import pandas as pd
import io
import os
from datetime import datetime

from database import engine
from models import AssetItem, AssetLog, AssetScrapRecord, AssetAuditRecord, User
from dependencies import get_current_user, require_admin
from core import templates, t_lang
from routers import request
from utils import zpl_print_task, generate_next_seq

router = APIRouter(tags=["Assets"])

# ============================================================= #
# =========================资产管理============================= #
# ============================================================= #

# -----------------------------资产信息--------------------------#

@router.get("/asset", response_class=HTMLResponse)
async def get_asset(request: Request, query: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        statement = select(AssetItem)

        if query:
            statement = statement.where(
                or_(
                    AssetItem.pn_1.like(f'%{query}%'),
                    AssetItem.pn_2.like(f'%{query}%'),
                    AssetItem.name.like(f'%{query}%'),
                    AssetItem.description_1.like(f'%{query}%'),
                    AssetItem.description_2.like(f'%{query}%'),
                    AssetItem.use_for.like(f'%{query}%'),
                    AssetItem.location.like(f'%{query}%'),
                    AssetItem.remarks.like(f'%{query}%')
                )
            )
        else:
            statement = statement.order_by(AssetItem.location)
        items = session.exec(statement).all()
        categories = len(set(i.pn_1 for i in items))
        total = len(items)

    return templates.TemplateResponse(request,"asset.html",{'items': items, 'query': query, 'user': current_user, 'active_page': 'asset', 'asset_categories_count': categories, 'asset_total_count': total})

@router.post("/asset_out/{item_id}")
async def asset_out(
        request: Request,
        item_id: int,
        target_loc: str = Form(""),
        current_user: dict = Depends(get_current_user),
):
    lang = request.state.lang
    with Session(engine) as session:
        item = session.get(AssetItem, item_id)
        if not item:
            return RedirectResponse(url= "/asset", status_code=303)

        was_in_stock = item.is_stock
        if was_in_stock:
            item.is_stock = False
            item.location = target_loc
            final_loc = target_loc
            action_note = 'OUT'
        else:
            conditions = [AssetItem.pn_1 == item.pn_1]
            if item.pn_2:
                conditions.append(AssetItem.pn_2 == item.pn_2)

            statement = select(AssetItem).where(AssetItem.is_stock == True, AssetItem.id != item.id, or_(*conditions))
            sibling = session.exec(statement).first()
            origin = str(sibling.location).strip() if sibling else ''

            item.is_stock = True
            final_loc = target_loc.strip() if target_loc.strip() else origin
            item.location = final_loc
            action_note = 'RETURN'
        session.add(item)

        log = AssetLog(
            ctrl_no = item.ctrl_no,
            pn_1 = item.pn_1,
            pn_2 = item.pn_2,
            name = item.name,
            status = item.is_stock,
            target_loc = final_loc,
            note = action_note,
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
            'message': t_lang("do.success", lang)}

@router.post("/asset_edit_group/{pn_1}")
async def asset_edit_group(
        request: Request,
        pn_1: str,
        pn_2: str = Form(""),
        name: str = Form(...),
        description_1: str = Form(""),
        description_2: str = Form(""),
        use_for: str = Form(""),
        remarks: str = Form(""),
        po_type: str = Form(""),
        model: str = Form("")
):
    lang = request.state.lang
    with Session(engine) as session:
        items = session.exec(select(AssetItem).where(AssetItem.pn_1 == pn_1.strip())).all()
        for item in items:
            item.pn_2 = pn_2
            item.name = name
            item.description_1 = description_1
            item.description_2 = description_2
            item.use_for = use_for
            item.remarks = remarks
            item.model = model
            session.add(item)
        session.commit()
        session.refresh(item)
        return {'status': 'success',
                'data': {
                    'pn_1': pn_1,
                    'pn_2': item.pn_2,
                    'name': item.name,
                    'description_1': item.description_1,
                    'description_2': item.description_2,
                    'use_for': item.use_for,
                    'remarks': item.remarks,
                    'model': item.model
                },
                'message': t_lang("do.success", lang)}

@router.post("/asset_edit_item/{item_id}")
async def asset_edit_item(
        request: Request,
        item_id: int,
        ctrl_no: str = Form(...),
        location: str = Form(...),
        first_in_date: str = Form(""),
        po_type: str = Form(""),
        apply_po_to_all: Optional[str] = Form(None)
):
    lang = request.state.lang
    with Session(engine) as session:
        statement = select(AssetItem).where(AssetItem.id == item_id)
        item = session.exec(statement).first()
        batch_po_type_returned = None
        if item:
            item.ctrl_no = ctrl_no
            item.location = location
            item.first_in_date = first_in_date
            item.po_type = po_type
            if apply_po_to_all == "true":
                batch_po_type_returned = po_type
                siblings = session.exec(select(AssetItem).where(AssetItem.pn_1 == item.pn_1)).all()
                for sib in siblings:
                    sib.po_type = po_type
                    session.add(sib)
            session.add(item)
            session.commit()
            session.refresh(item)
        return {'status': 'success',
                'data': {
                    'id': item.id,
                    'ctrl_no': item.ctrl_no,
                    'location': item.location,
                    'first_in_date': item.first_in_date,
                    'po_type': item.po_type,
                    'pn_1': item.pn_1,
                    'batch_po_type': batch_po_type_returned
                },
                'message': t_lang("do.success", lang)}

@router.post("/api/asset_upload_image/{item_pn_1}")
async def asset_upload_image(item_pn_1: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    file_path = f'static/asset_images/{item_pn_1}.jpg'
    with open(file_path, 'wb') as f:
        f.write(await file.read())
        with Session(engine) as session:
            statement = select(AssetItem).where(AssetItem.pn_1 == item_pn_1)
            items = session.exec(statement).all()
            for item in items:
                item.has_image = True
                session.add(item)
            session.commit()
    return {'status': 'success', 'url': f'/{file_path}?t={datetime.now().timestamp()}'}

@router.post("/api/asset_stop_toggle/{item_id}")
async def asset_stop(
        request: Request,
        item_id: int,
        is_no_use: str = Form(None),
        target_loc: str = Form(""),
        current_user: dict = Depends(get_current_user)
):
    lang = request.state.lang
    with Session(engine) as session:
        item = session.get(AssetItem, item_id)
        if not item:
            return {'status': 'error', 'message': t_lang("do.not_exist", lang)}
        item.is_stop = not item.is_stop
        item.is_stock = True
        item.is_no_use = (is_no_use.lower() == 'true') if is_no_use is not None else False
        if item.is_stop:
            item.location = 'NG Area' if not item.is_no_use else item.location
            action_note = 'Stopped'
        else:
            item.location = target_loc.strip() if target_loc.strip() else item.location
            action_note = 'Enable'
        session.add(item)
        log = AssetLog(
            ctrl_no = item.ctrl_no,
            pn_1 = item.pn_1,
            pn_2 = item.pn_2,
            name = item.name,
            status = item.is_stock,
            target_loc = item.location,
            note = action_note
        )
        session.add(log)
        session.commit()
        session.refresh(item)
        return {
            'status': 'success',
            'data': {
                'id': item.id,
                'is_stop': item.is_stop,
                'is_no_use': item.is_no_use,
                'location': item.location,
            },
            'message': t_lang("do.success", lang)}

@router.post("/import_asset")
async def import_asset(request: Request, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))

        with Session(engine) as session:
            try:
                session.exec(delete(AssetItem))
                for _, row in df.iterrows():
                    ctrl_no = str(row['ctrl_no'])
                    pn_1 = str(row['pn_1'])
                    pn_2 = str(row['pn_2']) if not pd.isna(row['pn_2']) else ''
                    name = str(row['name']) if not pd.isna(row['name']) else ''
                    description_1 = str(row['description_1']) if not pd.isna(row['description_1']) else ''
                    description_2 = str(row['description_2']) if not pd.isna(row['description_2']) else ''
                    use_for = str(row['use_for']) if not pd.isna(row['use_for']) else ''
                    location = str(row['location']) if not pd.isna(row['location']) else ''
                    first_in_date = str(row['first_in_date']) if not pd.isna(row['first_in_date']) else ''
                    has_image = bool(row['has_image']) if not pd.isna(row['has_image']) else False
                    is_stock = bool(row['is_stock']) if not pd.isna(row['is_stock']) else False
                    new_asset = AssetItem(
                        ctrl_no=ctrl_no,
                        pn_1=pn_1,
                        pn_2=pn_2,
                        name=name,
                        description_1=description_1,
                        description_2=description_2,
                        use_for=use_for,
                        location=location,
                        first_in_date=first_in_date,
                        has_image=has_image,
                        is_stock=is_stock,
                    )
                    session.add(new_asset)
                session.commit()
            except Exception as inner_e:
                session.rollback()
                return {"error": t_lang("do.import_error", lang, error=str(inner_e))}

        return RedirectResponse(url= "/backend", status_code=303)
    except Exception as e:
        return {"error": t_lang("do.read_excel_error", lang, error=str(e))}

@router.get("/asset/export")
def asset_export(request: Request, current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        contents = session.exec(select(AssetItem)).all()
        data = []
        for c in contents:
            data.append({
                t_lang("asset.ctrl_no", lang): c.ctrl_no,
                "PN1": c.pn_1,
                "PN2": c.pn_2,
                t_lang("asset.name", lang): c.name,
                t_lang("asset.description_1", lang): c.description_1,
                t_lang("asset.description_2", lang): c.description_2,
                t_lang("asset.use_for", lang): c.use_for,
                t_lang("asset.status", lang): (t_lang("asset.is_stock", lang) if c.is_stock else t_lang("asset.not_stock",lang)),
                t_lang("asset.location", lang): c.location,
                t_lang("asset.first_in_date", lang): c.first_in_date,
                t_lang("asset.remarks", lang): c.remarks,
                "Image": c.has_image,
                'PO Type': c.po_type,
                'Model': c.model
            })
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)

        headers = {
            'Content-Disposition': f'attachment; filename="Asset_details_{datetime.now().strftime("%Y%m%d")}.xlsx"'
        }
        return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@router.get("/asset/export_summary")
def asset_export_summary(request: Request, current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        all_assets = session.exec(select(AssetItem)).all()
        grouped_assets = defaultdict(list)
        for item in all_assets:
            grouped_assets[item.pn_1].append(item)

        completed_audit = session.exec(select(AssetAuditRecord).where(AssetAuditRecord.status == 'Completed')).all()
        audit_counts = defaultdict(int)
        for r in completed_audit:
            audit_counts[r.pn_1] += 1

        data = []
        for pn, items in grouped_assets.items():
            first_item = items[0]
            total_qty = len(items)

            common_qty = sum(1 for i in items if str(i.po_type).lower() == 'common')
            reimburse_qty = sum(1 for i in items if str(i.po_type).lower() == 'reimburse')
            consign_qty = sum(1 for i in items if str(i.po_type).lower() == 'consign')

            stock_qty = sum(1 for i in items if i.is_stock)
            broken_qty = sum(1 for i in items if i.is_stop)
            good_qty = stock_qty - broken_qty
            used_qty = sum(1 for i in items if not i.is_stock)

            audit_qty = audit_counts[pn]

            data.append({
                "PN": pn,
                "Equipment Name": first_item.name or "",
                "Equipment Name(Chinese)": first_item.description_2 or "",
                "PO: Common": common_qty,
                "PO: Reimburse": reimburse_qty,
                "PO: Consign": consign_qty,
                "总账数量": total_qty,
                "盘点数量": audit_qty,
                "在库总数": stock_qty,
                "在库良品": good_qty,
                "在库废品": broken_qty,
                "现场总数": used_qty
            })

        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Summary')
            worksheet = writer.sheets['Summary']
            for idx, col in enumerate(df.columns):
                max_len = max(df[col].astype(str).map(len).max(), len(col)) + 4
                worksheet.column_dimensions[chr(65 + idx)].width = max_len
        output.seek(0)

        headers = {
            'Content-Disposition': f'attachment; filename="Asset_Summary_{datetime.now().strftime("%Y%m%d")}.xlsx"'
        }
        return StreamingResponse(
            output,
            headers=headers,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )

# -----------------------------资产登记--------------------------#

@router.get("/asset_stock_in", response_class=HTMLResponse)
async def asset_stock_in(request: Request, current_user: dict = Depends(get_current_user)):
    return templates.TemplateResponse(request, "asset_stock_in.html", {"request": request, "user": current_user, "active_page": "asset_stock_in"})

@router.get("/api/asset/next_seq")
async def get_next_asset_seq():
    current_year = datetime.now().strftime("%y")
    prefix = f'JPE{current_year}'
    with Session(engine) as session:
        statement = select(AssetItem.ctrl_no).where(AssetItem.ctrl_no.like(f'%{prefix}%')).order_by(desc(AssetItem.id))
        last_ctrl_no = session.exec(statement).first()
        last_seq = last_ctrl_no[-3:] if last_ctrl_no else '000'
    return {'prefix': prefix,'last_seq': last_seq}

@router.post("/asset_batch_submit")
async def asset_batch_submit(
        background_tasks: BackgroundTasks,
        ctrl_no: List[str] = Form(default=[]),
        pn_1: List[str] = Form(default=[]),
        pn_2: List[str] = Form(default=[]),
        name: List[str] = Form(default=[]),
        description_1: List[str] = Form(default=[]),
        description_2: List[str] = Form(default=[]),
        use_for: List[str] = Form(default=[]),
        location:List[str] = Form(default=[]),
        first_in_date: List[str] = Form(default=[]),
        remarks: List[str] = Form(default=[]),
        po_type: List[str] = Form(default=[]),
        model: List[str] = Form(default=[])
):
    current_year = datetime.now().strftime("%y")
    prefix = f'JPE{current_year}'
    with Session(engine) as session:
        seq_cache = {}
        for i in range(len(pn_1)):
            current_pn = pn_1[i].strip()
            if not current_pn:
                continue

            current_ctrl_no = ctrl_no[i].strip() if i < len(ctrl_no) else ''
            if not current_ctrl_no:
                if prefix not in seq_cache:
                    statement = select(AssetItem.ctrl_no).where(AssetItem.ctrl_no.like(f'{prefix}%')).order_by(desc(AssetItem.ctrl_no))
                    last_ctrl_no = session.exec(statement).first()
                    seq_cache[prefix] = last_ctrl_no[-3:] if last_ctrl_no else None
                seq_cache[prefix] = generate_next_seq(seq_cache[prefix])
                current_ctrl_no = f'{prefix}{seq_cache[prefix]}'

            new_asset = AssetItem(
                ctrl_no=current_ctrl_no,
                pn_1=current_pn,
                pn_2=pn_2[i].strip() if i < len(pn_2) else "",
                name=name[i].strip() if i < len(name) else "No Name",
                description_1=description_1[i].strip() if i < len(description_1) else "",
                description_2=description_2[i].strip() if i < len(description_2) else "",
                use_for=use_for[i].strip() if i < len(use_for) else "",
                location=location[i].strip() if i < len(location) else "",
                first_in_date=first_in_date[i].strip() if i < len(first_in_date) else datetime.now().strftime("%Y-%m-%d"),
                remarks=remarks[i].strip() if i < len(remarks) else "",
                is_stock=True
            )
            session.add(new_asset)
            background_tasks.add_task(zpl_print_task, left_text=current_pn, right_barcode=current_ctrl_no)
            log = AssetLog(
                ctrl_no=current_ctrl_no,
                pn_1=current_pn,
                pn_2=new_asset.pn_2,
                name=new_asset.name,
                status=True,
                target_loc=new_asset.location,
                note="Initial Receiving",
            )
            session.add(log)
        session.commit()
    return RedirectResponse(url= "/asset_stock_in", status_code=303)

# -----------------------------资产报废--------------------------#

@router.get("/asset_scrap", response_class=HTMLResponse)
async def asset_scrap(request: Request, current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        records = session.exec(select(AssetScrapRecord)).all()
        draft_records = []
        for r in records:
            item = session.exec(select(AssetItem).where(AssetItem.ctrl_no == r.ctrl_no)).first()
            draft_records.append({
                'ctrl_no': item.ctrl_no,
                'pn_1': item.pn_1,
                'pn_2': item.pn_2,
                'name': item.name,
                'is_no_use': item.is_no_use,
                'location': item.location,
                'is_stop': item.is_stop if item else False,
            })
    return templates.TemplateResponse(request, "asset_scrap.html", {"request": request, 'draft_records': draft_records, "user": current_user, "active_page": "asset_scrap"})

@router.post("/asset_scrap")
async def asset_batch_scrap(
        current_user: dict = Depends(require_admin),
):
    with Session(engine) as session:
        draft_records = session.exec(select(AssetScrapRecord)).all()
        for draft in draft_records:
            current_c_no = draft.strip()

            statement = select(AssetItem).where(AssetItem.ctrl_no == current_c_no)
            item = session.exec(statement).first()
            if item:
                log = AssetLog(
                    ctrl_no = item.ctrl_no,
                    pn_1 = item.pn_1,
                    pn_2 = item.pn_2,
                    name = item.name,
                    target_loc = '',
                    note = f'{datetime.now().strftime("%Y")} Annual Scrapping'
                )
                session.add(log)

                remaining_statement = select(AssetItem).where(
                    AssetItem.pn_1 == item.pn_1,
                    AssetItem.id != item.id
                )
                remaining_item = session.exec(remaining_statement).first()
                if not remaining_item:
                    image_path = f'static/asset_images/{item.pn_1}.jpg'
                    try:
                        if os.path.exists(image_path):
                            os.remove(image_path)
                    except Exception as e:
                        print(f"Error deleting image file: {e}")
                session.delete(item)

        statement_scrap = delete(AssetScrapRecord)
        session.exec(statement_scrap)
        session.commit()
    return RedirectResponse(url= "/asset_scrap", status_code=303)

@router.get("/api/get_stopped")
async def get_stopped(request: Request, current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        statement = select(AssetItem).where(AssetItem.is_stop == True)
        items = session.exec(statement).all()
        if not items:
            return {'status': 'error', 'message': t_lang("do.not_exist", lang)}
        stopped_items = []
        for item in items:
            stopped_items.append({
                'ctrl_no': item.ctrl_no,
                'pn_1': item.pn_1,
                'pn_2': item.pn_2,
                'name': item.name,
                'location': item.location,
                'is_no_use': item.is_no_use,
                'remarks': item.remarks
            })
            existing = session.exec(select(AssetScrapRecord).where(AssetScrapRecord.ctrl_no == item.ctrl_no)).first()
            if not existing:
                record = AssetScrapRecord(
                    ctrl_no=item.ctrl_no,
                    pn_1=item.pn_1,
                    pn_2=item.pn_2,
                    name=item.name,
                    location=item.location,
                    is_no_use=item.is_no_use,
                    po_type=item.po_type,
                    model=item.model,
                    description_1=item.description_1,
                    remarks=item.remarks
                )
                session.add(record)
        session.commit()
        return {'status': 'success', 'data': stopped_items, 'message': t_lang("do.copy_stopped", lang, count=len(stopped_items))}

@router.post("/api/asset_scrap/scan")
async def scan_asset_scrap(request: Request, ctrl_no: str = Form(...), current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        existing_draft = session.exec(select(AssetScrapRecord).where(AssetScrapRecord.ctrl_no == ctrl_no)).first()
        if existing_draft:
            return {'status': 'success', 'message': t_lang("do.scan_repeatedly", lang)}

        statement = select(AssetItem).where(AssetItem.ctrl_no == ctrl_no)
        item = session.exec(statement).first()
        if not item:
            return {'status': 'error', 'message': t_lang("do.not_exist", lang)}

        record = AssetScrapRecord(
            ctrl_no=item.ctrl_no,
            pn_1=item.pn_1,
            pn_2=item.pn_2,
            name=item.name,
            location=item.location,
            is_no_use=True,
            po_type=item.po_type,
            model=item.model,
            description_1=item.description_1,
            remarks=item.remarks
        )
        session.add(record)
        session.commit()
        return {
            'status': 'success',
            'data': {
                'ctrl_no': item.ctrl_no,
                'pn_1': item.pn_1,
                'pn_2': item.pn_2,
                'name': item.name,
                'location': item.location,
                'is_no_use': True,
                'remarks': item.remarks
            },
            'message': t_lang("do.success", lang)
        }

@router.post("/api/asset_scrap/delete")
async def delete_asset_scrap(request: Request, ctrl_no: str = Form(...), current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        statement = select(AssetScrapRecord).where(AssetScrapRecord.ctrl_no == ctrl_no)
        item = session.exec(statement).first()
        if not item:
            return {'status': 'error', 'message': t_lang("do.not_exist", lang)}
        session.delete(item)
        session.commit()
        return {'status': 'success', 'message': t_lang("do.success", lang)}

@router.get("/asset_scrap/export")
def asset_scrap_export(request: Request, current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        contents_broken = session.exec(select(AssetScrapRecord).where(AssetScrapRecord.is_no_use == False)).all()
        contents_no_use = session.exec(select(AssetScrapRecord).where(AssetScrapRecord.is_no_use == True)).all()
        contents = session.exec(select(AssetScrapRecord)).all()
        scrap_ng = []
        for c in contents_broken:
            scrap_ng.append({
                'PN1': c.pn_1,
                'DESC': c.name,
                'Location': c.location,
                'QTY': 1,
                '管理番号': c.ctrl_no,
                'Check Date': datetime.now().strftime("%Y%m%d"),
                '故障原因': '破損',
                'memo': c.remarks
            })
        scrap_no_use = []
        for c in contents_no_use:
            scrap_no_use.append({
                'P/N': c.pn_1,
                'DESC': c.name,
                'Location': c.location,
                '管理番号': c.ctrl_no
            })

        unique_pn_records = {c.pn_1: c for c in contents}.values()
        scrap_list = []
        for c in unique_pn_records:
            using = session.exec(select(AssetItem).where(AssetItem.pn_1 == c.pn_1, AssetItem.is_stock == False)).all()
            using_qty = len(using)
            stocking = session.exec(select(AssetItem).where(AssetItem.pn_1 == c.pn_1, AssetItem.is_stock == True)).all()
            stocking_qty = len(stocking)
            ng_qty = len([x for x in contents_broken if x.pn_1 == c.pn_1])
            no_use_qty = len([x for x in contents_no_use if x.pn_1 == c.pn_1])
            scrap_list.append({
                "P/N": c.pn_1,
                "DESC": c.name,
                "Scrap Type": "NO USE" if c.is_no_use else "NG 廃棄",
                "Model": c.model,
                "Category": c.description_1,
                "PO Type": c.po_type,
                "Location": c.location,
                "NG Scrap Qty": ng_qty,
                "Unused Scrap Qty": no_use_qty,
                "Line-in-Use Qty": using_qty,
                "Warehouse Stock Qty": stocking_qty,
                "Total Qty": using_qty + stocking_qty,
                "Memo": c.remarks
            })
            df1 = pd.DataFrame(scrap_list)
            df2 = pd.DataFrame(scrap_no_use)
            df3 = pd.DataFrame(scrap_ng)
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df1.to_excel(writer, sheet_name='Scrap list', index=False)
                df2.to_excel(writer, sheet_name='Unused scrap detail', index=False)
                df3.to_excel(writer, sheet_name='NG scrap detail', index=False)
            output.seek(0)
            headers = {
                'Content-Disposition': f'attachment; filename="Asset_to_Scrap{datetime.now().strftime("%Y%m%d")}.xlsx"'
            }
            return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    # -----------------------------资产变动--------------------------#

@router.get('/asset_history', response_class=HTMLResponse)
async def asset_history(request: Request, current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        statement = select(AssetLog).order_by(desc(AssetLog.id))
        logs = session.exec(statement).all()

    return templates.TemplateResponse(request, "asset_history.html", {'logs': logs, 'user': current_user, 'active_page': 'asset_history'})

@router.get("/asset_history/export")
def asset_history_export(request: Request, current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        contents = session.exec(select(AssetLog)).all()
        data = []
        for c in contents:
            data.append({
                t_lang("asset.date", lang): c.date,
                t_lang("asset.ctrl_no", lang): c.ctrl_no,
                "PN1": c.pn_1,
                "PN2": c.pn_2,
                t_lang("asset.name", lang): c.name,
                t_lang("asset.status", lang): (t_lang("asset.is_stock", lang) if not c.status else t_lang("asset.not_stock", lang)),
                t_lang("asset.location", lang): c.target_loc,
                t_lang("asset.remarks", lang): c.note
            })
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)

        headers = {
            'Content-Disposition': f'attachment; filename="Asset_History_{datetime.now().strftime("%Y%m%d")}.xlsx"'
        }
        return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@router.post("/asset_history/import")
async def asset_history_import(request: Request, file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    lang = request.state.lang
    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
        df = df.where(pd.notnull(df), None)
        try:
            with Session(engine) as session:
                session.exec(delete(AssetLog))
                for _, row in df.iterrows():
                    status_str = str(row['status']) if not pd.isna(row['status']) else ''
                    if status_str:
                        status = True if status_str == 'is_stock' else False
                    else:
                        status = ''
                    now_log = AssetLog(
                        date=str(row['date'])[:10] if row['date'] else datetime.now().strftime("%Y-%m-%d"),
                        ctrl_no=str(row['ctrl_no']),
                        pn_1=str(row['pn_1']),
                        pn_2=str(row['pn_2']) if not pd.isna(row['pn_2']) else "",
                        name=str(row['name']) if not pd.isna(row['name']) else "",
                        status=status,
                        target_loc=str(row['location']) if not pd.isna(row['location']) else "",
                        note=str(row['note']) if not pd.isna(row['note']) else ""
                    )
                    session.add(now_log)
                session.commit()
        except Exception as inner_e:
            session.rollback()
            return {"error": t_lang("do.import_error", lang, error=str(inner_e))}
        return RedirectResponse(url= "/backend", status_code=303)
    except Exception as e:
        return {"error": t_lang("do.read_excel_error", lang, error=str(e))}

# -----------------------------资产盘点--------------------------#

@router.get("/asset_audit/dashboard", response_class=HTMLResponse)
async def view_asset_audit(request: Request, current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        statement = select(AssetAuditRecord).order_by(AssetAuditRecord.expected_location)
        records = session.exec(statement).all()
        total = len(records)
        completed = sum(1 for r in records if r.status != 'Pending')
        progress = int((completed / total * 100)) if total > 0 else 0

        statement_missing = select(AssetAuditRecord).where(AssetAuditRecord.status == 'Pending')
        missing = session.exec(statement_missing).all()

        statement_misplaced = select(AssetAuditRecord).where(
            AssetAuditRecord.status == 'Completed',
            AssetAuditRecord.expected_location != AssetAuditRecord.actual_location
        )
        misplaced = session.exec(statement_misplaced).all()

        grouped = defaultdict(list)
        for r in records:
            loc = r.actual_location or r.expected_location
            grouped[loc].append(r)
    return templates.TemplateResponse(request, "asset_audit.html", {"records": records, 'missing': missing, 'misplaced': misplaced, "total": total, "progress": progress, "completed": completed, "grouped": grouped, "user": current_user, "active_page": "asset_audit"})

@router.post("/asset_audit/start")
async def start_audit(request: Request, current_user: dict = Depends(get_current_user)):
    with Session(engine) as session:
        for old_record in session.exec(select(AssetAuditRecord)).all():
            session.delete(old_record)

        items = session.exec(select(AssetItem)).all()
        for item in items:
            record = AssetAuditRecord(
                asset_id=item.id,
                ctrl_no=item.ctrl_no,
                pn_1=item.pn_1,
                pn_2=item.pn_2,
                name=item.name,
                expected_location=item.location,
                actual_location=item.location,
                status='Pending',
            )
            session.add(record)
        session.commit()
    referer = request.headers.get("referer", "")
    target_url = "/mobile/audit_asset" if "mobile" in referer else "/asset_audit/dashboard"
    return RedirectResponse(url=target_url, status_code=303)

@router.post("/api/asset_audit/scan")
async def scan_asset_audit(
        request: Request,
        ctrl_no: str = Form(...),
        current_location: str = Form(...),
        current_user: dict = Depends(get_current_user),
):
    lang = request.state.lang
    with Session(engine) as session:
        statement = select(AssetAuditRecord).where(AssetAuditRecord.ctrl_no == ctrl_no)
        record = session.exec(statement).first()

        if not record:
            return {'status': 'error', 'message': t_lang("do.not_exist", lang)}

        record.actual_location = current_location
        record.status = 'Completed'
        record.scanned_at = datetime.now().strftime("%Y-%m-%d")
        record.scanned_by = current_user['full_name']

        session.add(record)
        session.commit()

        return {
            'status': 'success',
            'message': t_lang("do.scan_success", lang, name=record.name),
            'is_location_changed': record.expected_location != current_location,
        }

@router.post("/asset_audit/commit")
async def commit_asset_audit(request: Request, current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        records = session.exec(select(AssetAuditRecord).where(AssetAuditRecord.status == 'Completed')).all()
        for r in records:
            asset = session.exec(select(AssetItem).where(AssetItem.id == r.asset_id)).first()
            if asset:
                if asset.location != r.actual_location:
                    asset.location = r.actual_location

                    log = AssetLog(
                        ctrl_no=asset.ctrl_no,
                        pn_1=asset.pn_1,
                        pn_2=asset.pn_2,
                        name=asset.name,
                        status=asset.is_stock,
                        target_loc=asset.location,
                        note='Stock Correction',
                    )
                    session.add(log)
                session.add(asset)
        session.commit()
    referer = request.headers.get("referer", "")
    target_url = "/mobile/audit_asset" if "mobile" in referer else "/asset_audit/dashboard"
    return RedirectResponse(url=target_url, status_code=303)

@router.get("/asset_audit/export")
def export_audit(request: Request, current_user: dict = Depends(get_current_user)):
    lang = request.state.lang
    with Session(engine) as session:
        records = session.exec(select(AssetAuditRecord)).all()
        data = []
        for r in records:
            data.append({
                t_lang("asset.ctrl_no", lang): r.ctrl_no,
                "PN1": r.pn_1,
                "PN2": r.pn_2,
                t_lang("asset.name", lang): r.name,
                t_lang("asset.expected_location", lang): r.expected_location,
                t_lang("asset.actual_location", lang): r.actual_location,
                t_lang("asset.audit_status", lang): r.status,
            })
        df = pd.DataFrame(data)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)

        headers = {
            'Content-Disposition': f'attachment; filename="Asset_Audit_Report_{datetime.now().strftime("%Y%m%d")}.xlsx"'
        }
        return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

