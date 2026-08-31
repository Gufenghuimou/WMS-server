# main.py
from fastapi import FastAPI ,Request
from fastapi.templating import Jinja2Templates
from starlette.responses import RedirectResponse, HTMLResponse, JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.staticfiles import StaticFiles
import os
import time


from dependencies import RequiresLoginException
from middlewares import inject_global_template_data #如果不需要给其他老页面提供模板注入，可以注释掉这行
from init_db import init_application
import core


app = FastAPI()

GLOBAL_APP_VERSION = str(int(time.time()))  # 使用时间戳作为版本号，确保每次启动时都是最新的
app.state.sys_ver = GLOBAL_APP_VERSION

class CachingStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        if response.status_code in [200, 304]:
            response.headers["Cache-Control"] = "public, max-age=2592000"  # 设置缓存时间为30天
        return response

# 挂载中间件与静态资源
app.add_middleware(BaseHTTPMiddleware, dispatch=inject_global_template_data) #如果已彻底不用 Jinja，注释掉这个中间件，提升性能
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
        
    # 2. 排除登录页（如果你的登录页暂时还没有改成 SPA 模式的话，可以让前端直接访问 /login 触发老逻辑）
    if full_path in ["login", "mobile/login"]:
        # 根据你现在的逻辑，如果登录页还是要靠 Jinja 渲染，你不能在这里拦截。
        # 最好的办法是在你的 users.router 里面保留 /login 的 GET 路由，因为路由优先匹配上面的精准路由。
        pass

    # 3. 兜底返回单页应用的外壳
    # 假设你刚刚把基础骨架写在了 templates/index.html 里面
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