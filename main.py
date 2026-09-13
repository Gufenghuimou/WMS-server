# main.py
from fastapi import FastAPI ,Request
from starlette.responses import RedirectResponse, HTMLResponse, JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.staticfiles import StaticFiles
import os
import time


from dependencies import RequiresLoginException
from middlewares import inject_request_context
from init_db import init_application
import core


app = FastAPI()

GLOBAL_APP_VERSION = str(int(time.time()))  # 使用时间戳作为版本号，确保每次启动时都是最新的
app.state.sys_ver = GLOBAL_APP_VERSION

class CachingStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        if response.status_code in [200, 304]:
            if os.path.splitext(path)[1].lower() in {'.js', '.css', '.html', '.json'}:
                response.headers["Cache-Control"] = "no-cache"
            else:
                response.headers["Cache-Control"] = "public, max-age=2592000"
        return response

# 挂载中间件与静态资源
app.add_middleware(BaseHTTPMiddleware, dispatch=inject_request_context)
app.add_middleware(SessionMiddleware, secret_key="h8x!kP9z$mQ2vL5w*rB4nJ7c@yT1gF6")
app.mount("/static", CachingStaticFiles(directory=os.path.join(core.base_dir, "static")), name="static")

# 异常处理
@app.exception_handler(RequiresLoginException)
async def requires_login_exception_handler(request: Request, exc: RequiresLoginException):
    if request.url.path.startswith("/api/"):
        return JSONResponse(status_code=401, content={'status': 'error', 'message': 'Unauthorized, please login.'})
    user_agent = request.headers.get("User-Agent", "").lower()
    is_mobile = any(keyword in user_agent for keyword in ["android", "iphone", "mobile"])
    if is_mobile:
        return RedirectResponse("/mobile/login", status_code=303)
    else:
        return RedirectResponse("/login", status_code=303)

# 启动事件
@app.on_event("startup")
def on_startup():
    init_application()

# 注册路由
import routers.users as users
import routers.asset as asset
import routers.inventory as inventory
import routers.functions as functions
import routers.production as production
import routers.request as request
import routers.simcard as sim_card

app.include_router(users.router)
app.include_router(asset.router)
app.include_router(inventory.router)
app.include_router(functions.router)
app.include_router(production.router)
app.include_router(request.router)
app.include_router(sim_card.router)

# SPA兜底路由
@app.get("/{full_path:path}",response_class=HTMLResponse)
async def serve_spa(request: Request, full_path: str):
    # 1. 排除掉真实的 API 请求：如果前端请求 /api/xxx 不存在，返回标准的 404 JSON，不要返回 index.html
    if full_path.startswith("api/"):
        return JSONResponse(status_code=404, content={"status": "error", "message": "API Endpoint Not Found"})
        
    index_path = os.path.join(core.base_dir, "templates", "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

# 本体
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=443,
        ssl_keyfile='./key.pem',
        ssl_certfile='./cert.crt'
    )
