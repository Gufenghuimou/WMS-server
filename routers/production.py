# /routers/production.py
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
from dateutil.relativedelta import relativedelta

from database import engine
from models import MonthlyProduction
from core import t_lang

router = APIRouter(tags=["Productions"])

# ----------------------- 产量统计 --------------------- #

@router.post("/production/daily_update")
async def update_daily_production(request: Request, model_id: int, today_qty: int):
    lang = request.state.lang
    with Session(engine) as session:
        current_year_month = datetime.now().strftime("%Y-%m")
        statement = select(MonthlyProduction).where(MonthlyProduction.model_id == model_id, MonthlyProduction.year_month == current_year_month)
        record = session.exec(statement).first()
        if not record:
            new_record = MonthlyProduction(
                model_id=model_id,
                year_month=current_year_month,
                quantity=today_qty,
            )
            session.add(new_record)
        else:
            record.quantity += today_qty
            record.last_updated = datetime.now()
            session.add(record)
        session.commit()
    return {'status': 'success', 'message': t_lang("do.success", lang)}

@router.get("/production/dashboard")
async def get_last_12_months_production(model_id: int):
    twelve_months_ago = datetime.now() - relativedelta(month=11)
    taget_month_str = twelve_months_ago.strftime("%Y-%m")
    with Session(engine) as session:
        statement = select(MonthlyProduction).where(
            MonthlyProduction.model_id == model_id,
            MonthlyProduction.year_month > taget_month_str
        ).order_by(MonthlyProduction.year_month)
        records = session.exec(statement).all()

    return {records.year_month: record.quantity for record in records}