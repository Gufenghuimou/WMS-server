# Mobile SPA 迁移记录（2026-09-12）

本次工作已阅读并延续 `mobile-spa-handoff-2026-09-11.md` 中的约定。

## 页面入口

- 资产盘点：`static/views/m_audit_asset.html`、`static/js/m_audit_asset.js`。
- 消耗品盘点：`static/views/m_audit_inventory.html`、`static/js/m_audit_inventory.js`。
- 图片上传：`static/views/m_upload.html`、`static/js/m_upload.js`。
- 三个 `/mobile/` 地址均返回 `templates/m_index.html`，由 `m_router.js` 加载 HTML 碎片；标题和菜单选中状态随路由更新。
- 外壳统一加载扫码和裁剪依赖。页面复用 `mobile.css` 原有选择器，采用与 `m_approve` 一致的初始化、事件委托和离页清理结构。

## 本次追加的消耗品页面要求

- 移除重置盘点、导出报告和刷新按钮；移动端脚本也移除重置分支。这两个管理入口继续保留在 PC 页面。
- 只保留顶部一条 `action-row`，左侧同步按钮、右侧 `auditProgress`。
- 操作行吸顶在公共页头下方，扫码区在其下方吸顶。通过 `ResizeObserver` 同步高度，定位滚动时扣除吸顶区域高度，离页断开观察。

## 功能与接口

- 两个盘点页读取既有 `/api/mobile/audit_inventory`、`/api/mobile/audit_asset`，数据保存到对应 `window.M_AUDIT_*_DATA`。
- 消耗品保存使用 `/audit/submit/{id}`，同步使用 `/api/audit/commit`；状态 `Issue` 映射至现有 `status-mismatched` 样式。保存和切换语言保留其他表单草稿。
- 资产扫码、重置、同步使用 `/api/asset_audit/scan`、`/start`、`/commit`，修正旧模板缺少 `/api` 的路径。
- 上传保留型号查询、扫码、选图、自由裁剪、压缩和上传。补全读取真实 `match_type` 字段，并使用 `focusout` 事件监听。
- `/api/item/{pn_or_loc}` 额外返回 `item_type`，准确区分资产/消耗品图片目录，避免两张表的 ID 重复导致错图。未修改数据库结构或鉴权。
- 页面异步读取绑定取消信号；已发出的写入通过提交锁和离页状态检查管理。扫码使用唯一宿主，离页后等待启动结束再释放相机，避免影响新页面。
- 补充四语言文案和占位文字翻译支持。

## 验证

- JavaScript 语法检查、Python AST、翻译 key 检查。
- 隔离的无界面 Chrome 测试通过：审批页回归、SPA 导航、盘点卡片安全文本渲染、消耗品保存和重分组、语言切换、资产扫码校验和重复提交锁、上传过期补全、PN2 纠偏、真实 Cropper 裁剪压缩及模拟上传。
- 检查了 390px 和 320px 手机宽度，验证操作行吸顶、扫码区不重叠；截图完成视觉检查。
- 所有写入验证使用模拟接口，未连接数据库执行盘点或上传。真实手机摄像头权限和实际接口仍需现场验收。
