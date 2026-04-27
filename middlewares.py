# middlewares.py
from fastapi import Request
from sqlmodel import Session, select, func

from database import engine
from models import OutboundRequest

async def inject_global_template_data(request: Request, call_next):
    lang = request.session.get("lang", "zh")
    request.state.lang = lang

    if request.url.path.startswith(("/static","/api")):
        return await call_next(request)
    try:
        with Session(engine) as session:
            count = session.exec(
                select(func.count(OutboundRequest.id)).where(OutboundRequest.status == 'Pending')
            ).one()
            request.state.pending_count = count
    except Exception as e:
        request.state.pending_count = 0

    response = await call_next(request)
    return response