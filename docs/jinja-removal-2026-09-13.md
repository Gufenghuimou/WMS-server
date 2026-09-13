# 移除 Jinja（2026-09-13）

## 最终结构

- `templates` 目录继续存放普通 HTML 文件，名称不代表使用模板引擎。
- `GET /login` 返回 `login.html` 文件，手机访问仍跳转 `/mobile/login`。
- `POST /login` 返回 JSON：成功为 `200` 和 `{status: "success", redirect_url: "/"}`；密码错误为 `401`；超管异地登录限制为 `403`，保留 `is_security_alert` 标记。
- 登录仍使用原有密码验证、Session、超管 IP 限制和审计逻辑。登录成功后保存前端选择的语言。
- `login.js` 不再解析 HTML 或用正则提取错误。失败显示接口消息并恢复按钮，成功完成原有动画后跳转，期间阻止重复提交。
- 四个移动页面入口返回同一个普通 `m_index.html`。用户信息由受保护的 `GET /api/mobile/context` 提供，只返回 username、full_name、role，以及语言和版本信息；响应为 `no-store`。
- 移动页面继续要求登录，移动 API 未登录时返回 401，前端跳转登录页。上下文加载失败会显示错误及重试按钮。
- 手机二维码授权、有效期和一次性使用机制保持不变；授权写入 Session 时补上用户 ID，使退出登录可正常查找用户。

## 清理

- 删除 Jinja 初始化、模板专用翻译包装、TemplateResponse 和相关导入。
- 保留独立的 `t_lang()`；兼容 `ja/jp`、`vi/vn` 语言代码。
- 中间件改名为 `inject_request_context`，保留 Session 语言及版本初始化，删除旧模板计数注入代码。
- `requirements.txt` 删除 `Jinja2==3.1.6`，没有新增依赖。
- README 更新前端技术说明。

## 测试

使用项目 `.venv` 的真实 FastAPI/SQLModel 环境，数据库和日志均位于新建的临时目录，未使用业务数据库做写入测试。

- 拦截并禁止所有 `jinja2` 导入后，完整应用可启动并通过接口测试。
- PC 登录页面、手机重定向、错误密码、四种语言、成功登录 Session、超管异地限制通过。
- 四个移动页面、上下文隐私字段、未登录 401、二维码过期、重复使用和退出登录通过。
- Chrome 使用临时服务测试真实登录及移动端流程；网络错误、代理返回 HTML、10 秒超时、上下文加载失败后重试通过。
- Chrome 测试未出现未处理的 JavaScript 异常。
- Python/JS 语法检查通过；运行源码和 HTML 中未发现 Jinja、TemplateResponse 或模板占位语法。

## 部署

同步本次修改的 Python、HTML、JS 和 requirements 文件，重启后端并强制刷新浏览器一次。

没有新增依赖，无需为了运行本次改动重新安装依赖。已有环境中留着 Jinja2 不影响运行；新环境按更新后的 requirements 安装即可。`pip install -r requirements.txt` 不会自动卸载旧包。

无需数据库迁移。临时测试服务已关闭。
