from fastapi import Request


async def inject_request_context(request: Request, call_next):
    request.state.lang = request.session.get("lang", "zh")
    request.state.sys_ver = request.app.state.sys_ver
    return await call_next(request)
