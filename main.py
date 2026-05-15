# main.py
from fastapi import FastAPI ,Request
from fastapi.templating import Jinja2Templates
from starlette.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.staticfiles import StaticFiles
import os


from dependencies import RequiresLoginException
from middlewares import inject_global_template_data
from init_db import init_application
import core


app = FastAPI()

# 挂载中间件与静态资源
app.add_middleware(BaseHTTPMiddleware, dispatch=inject_global_template_data)
app.add_middleware(SessionMiddleware, secret_key="h8x!kP9z$mQ2vL5w*rB4nJ7c@yT1gF6")
app.mount("/static", StaticFiles(directory=os.path.join(core.base_dir, "static")), name="static")

# 异常处理
@app.exception_handler(RequiresLoginException)
async def requires_login_exception_handler(request: Request, exc: RequiresLoginException):
    user_agent = request.headers.get("User-Agent").lower()
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

app.include_router(users.router)
app.include_router(asset.router)
app.include_router(inventory.router)
app.include_router(functions.router)
app.include_router(production.router)
app.include_router(request.router)

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