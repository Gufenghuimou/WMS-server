# 业务重定向清理

- 业务 POST 未登录统一返回 401 JSON；页面请求、退出登录和手机二维码导航保留重定向。
- 资产、SIM 出入库记录不存在返回 404 JSON。
- 库存删除、SIM 删除、资产批量报废及四个 Excel 导入成功返回 `status: success, data: ...`，不再返回页面重定向。不存在的删除目标返回 404；导入异常返回 400 和 `status: error, message: ...`。
- PC 请求通过 `apiFetch` 统一处理 401。新增脚本在 index.js 前加载。移动端沿用 requestMobileJson。
- 后台四个导入表单接入异步处理，检查 HTTP 状态与业务状态；成功留在原页，失败恢复按钮。
- 删除、报废表单通过委托 submit 事件提交 JSON 请求，成功后重新加载当前 SPA 视图；滑动确认的旧浏览器分支也触发 submit 事件。
- 语言接口新增 POST，保留 GET 兼容入口但返回 JSON；支持 zh/en/ja/vi 与 jp/vn 别名。PC、手机端语言加载同时同步 Session。

本次只统一原先返回业务重定向的接口，没有批量重写其他已有 JSON 接口的数据结构，也没有改变文件导出响应。

## 验证

运行 `python tests/check_response_contracts.py`：38 项 JSON 响应检查通过，并验证页面重定向、权限检查、Python AST 和业务 POST 不含 RedirectResponse。测试数据库、日志及文件操作均在临时工作目录，未修改业务数据库。

`git diff --check` 通过。已静态核对 PC 请求入口、四个导入表单及删除/报废表单；当前环境未找到 Node 和浏览器测试工具，未完成 JavaScript 运行及浏览器交互回归。

之前检查发现的 PC 首屏失败恢复入口仍待处理；本次未接入 Vue/Tailwind。
