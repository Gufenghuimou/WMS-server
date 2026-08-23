## TODO

- [x] **Asset页面性能优化** 加载速度太慢，后端返回模板前端Jinja处理 改成后端直接返回json
- [x] **Asset页面UI交互优化** Action 按钮放进模态框 拿到CtrlNo前面，方便对照
- [x] **remarks编辑修复** remarks编辑form从 card转向按CtrlNo编辑，放到itemEdit中，显示在 PoType后面，Card中gird重新排列
- [x] **Asset展示用图片放大** 增加模态框用于展示放大的Asset图片

- [x] **Simcard按钮交互优化** 组合进模态框，放到iccid前面 效果不好且无性能优化需求，纯多此一举，还原

- [x] **标签打印模态框化** 标签打印功能重做，不再使用模板，而是直接做成模态框

- [ ] **后端优化** 尝试后端统一返回json，全部使用空白template并用js渲染

- [x] **屏锁优化** 防误触屏锁刷新后应直接解锁