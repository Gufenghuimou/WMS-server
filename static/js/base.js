// --- 🌟 升级版：从服务器动态加载地图数据 ---
let racks = [];

// 异步加载布局数据
async function loadMapData() {
    try {
        const response = await fetch('/api/layout');
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            racks = data; // 使用服务器保存的布局
        } else {
            console.log(BASE_I18N.map_not_found);
        }
    } catch (error) {
        console.error(BASE_I18N.map_load_fail, error);
    }
}

window.currentHighlightRack = null;

// 🌟 辅助函数：计算背景颜色的亮度，决定文字用黑还是白 (同步后台功能)
function getContrastYIQ(hexcolor){
    hexcolor = (hexcolor || "#ffffff").replace("#", "");
    if (hexcolor.length === 3) hexcolor = hexcolor.split('').map(c => c + c).join('');
    const r = parseInt(hexcolor.substr(0,2),16);
    const g = parseInt(hexcolor.substr(2,2),16);
    const b = parseInt(hexcolor.substr(4,2),16);
    const yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 140) ? '#1e293b' : '#ffffff';
}

window.drawWarehouseMap = function(targetRack = null) {
    if (targetRack !== null) window.currentHighlightRack = targetRack;
    else targetRack = window.currentHighlightRack;

    const canvases = document.querySelectorAll('.wh-canvas');
    const dpr = window.devicePixelRatio || 1;

    canvases.forEach(canvas => {
        if (!canvas.getContext) return;
        const ctx = canvas.getContext('2d');

        ctx.resetTransform();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 绘制工程蓝图风格的背景网格
        const GRID_SIZE = 10;
        ctx.beginPath();
        for (let x = 0; x <= canvas.width; x += GRID_SIZE) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
        for (let y = 0; y <= canvas.height; y += GRID_SIZE) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
        ctx.strokeStyle = "#f1f5f9";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = 'bold 12px "Roboto Mono", monospace'; // 字号稍微加大加粗
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        racks.forEach(r => {
            const isTarget = r.name === targetRack;
            let bgColor = r.color || "#ffffff"; // 读取后台设置的颜色

            if (isTarget) {
                ctx.fillStyle = bgColor;
                ctx.strokeStyle = "#ff3e3e"; // 目标库位红框警示
                ctx.lineWidth = 3;
                ctx.shadowColor = "rgba(255, 62, 62, 0.6)";
                ctx.shadowBlur = 15;
            } else {
                ctx.fillStyle = bgColor;
                ctx.strokeStyle = "#94a3b8";
                ctx.lineWidth = 1;
                ctx.shadowBlur = 0;
            }

            ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.strokeRect(r.x, r.y, r.w, r.h);

            // 智能黑白文字
            ctx.fillStyle = getContrastYIQ(bgColor);
            ctx.fillText(r.name, r.x + r.w/2, r.y + r.h/2);
        });
    });
}

// 页面加载时拉取数据
loadMapData();

// 🌟 新增：专门用来强制升起抽屉并高亮、对焦库位的 API
window.openFooterMap = function(targetLoc) {
    const footer = document.querySelector('.bottom-bar');
    const icon = document.getElementById('expandIcon');
    const subtitle = document.getElementById('mapSubtitle');

    window.currentHighlightRack = targetLoc;

    if (targetLoc) {
        subtitle.innerHTML = `<span style="color: #ff3e3e; font-weight: bold;">${BASE_I18N.target_loc}${targetLoc}</span>${BASE_I18N.drag_tip}`;
    }

    if (!footer.classList.contains('expanded')) {
        footer.classList.add('expanded');
        icon.style.transform = 'rotate(180deg)';
    }

    // ==========================================
    // 🌟 摄像机自动对焦算法 (智能双轴与居中保护)
    // ==========================================
    if (targetLoc && racks.length > 0) {
        let targetRack = racks.find(r => r.name === targetLoc);
        if (targetRack && mapEl) {
            let canvasWidth = mapEl.width;
            let canvasHeight = mapEl.height;
            let viewportWidth = mapEl.parentElement.clientWidth;
            let viewportHeight = mapEl.parentElement.clientHeight || 600;

            let rackCenterX = targetRack.x + (targetRack.w / 2);
            let rackCenterY = targetRack.y + (targetRack.h / 2);

            let targetMapX = (viewportWidth / 2) - rackCenterX;
            let targetMapY = (viewportHeight / 2) - rackCenterY;

            // X轴：如果视口比地图宽，强制居中；否则套用边界对焦
            if (viewportWidth >= canvasWidth) {
                mapCurrentX = (viewportWidth - canvasWidth) / 2;
            } else {
                let maxScrollX = -(canvasWidth - viewportWidth);
                mapCurrentX = Math.min(0, Math.max(targetMapX, maxScrollX));
            }

            // Y轴：如果视口比地图高，强制居中；否则套用边界对焦
            if (viewportHeight >= canvasHeight) {
                mapCurrentY = (viewportHeight - canvasHeight) / 2;
            } else {
                let maxScrollY = -(canvasHeight - viewportHeight);
                mapCurrentY = Math.min(0, Math.max(targetMapY, maxScrollY));
            }

            mapEl.style.transform = `translate(${mapCurrentX}px, ${mapCurrentY}px)`;
        }
    }

    setTimeout(() => {
        if (window.drawWarehouseMap) window.drawWarehouseMap(targetLoc);
    }, 300);
};

// ==========================================
// 🌟 地图拖拽引擎 (免疫Zoom缩放的高级物理算法)
// ==========================================
let mapEl = document.getElementById('footerWarehouseCanvas');
let mapCurrentX = 0;
let mapCurrentY = 0;
let isDraggingMap = false;
let mapDragStartX = 0;
let mapDragStartY = 0;
let mapStartTransformX = 0;
let mapStartTransformY = 0;

if (mapEl) {
    mapEl.addEventListener('mousedown', (e) => {
        isDraggingMap = true;
        mapEl.style.transition = 'none';

        // 记录鼠标按下的物理坐标
        mapDragStartX = e.clientX;
        mapDragStartY = e.clientY;
        // 记录按下时画布的虚拟坐标
        mapStartTransformX = mapCurrentX;
        mapStartTransformY = mapCurrentY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDraggingMap) return;

        // 🌟 获取当前页面的 zoom 比例，除以比例以抵消鼠标移动的物理误差
        let currentZoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;

        // 计算真实的虚拟移动距离
        let deltaX = (e.clientX - mapDragStartX) / currentZoom;
        let deltaY = (e.clientY - mapDragStartY) / currentZoom;

        let canvasWidth = mapEl.width;
        let canvasHeight = mapEl.height;
        let viewportWidth = mapEl.parentElement.clientWidth;
        let viewportHeight = mapEl.parentElement.clientHeight || 600;

        let targetX = mapStartTransformX + deltaX;
        let targetY = mapStartTransformY + deltaY;

        // 🌟 X轴物理限制
        if (viewportWidth >= canvasWidth) {
            mapCurrentX = (viewportWidth - canvasWidth) / 2; // 装得下，直接锁定在正中间
        } else {
            let maxScrollX = -(canvasWidth - viewportWidth);
            mapCurrentX = Math.min(0, Math.max(targetX, maxScrollX)); // 装不下，限制在边界内滑动
        }

        // 🌟 Y轴物理限制
        if (viewportHeight >= canvasHeight) {
            mapCurrentY = (viewportHeight - canvasHeight) / 2;
        } else {
            let maxScrollY = -(canvasHeight - viewportHeight);
            mapCurrentY = Math.min(0, Math.max(targetY, maxScrollY));
        }

        mapEl.style.transform = `translate(${mapCurrentX}px, ${mapCurrentY}px)`;
    });

    window.addEventListener('mouseup', () => {
        if (isDraggingMap) {
            isDraggingMap = false;
            mapEl.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
        }
    });

    // 鼠标移出地图区域自动松开，防止粘连
    mapEl.parentElement.addEventListener('mouseleave', () => {
        if (isDraggingMap) {
            isDraggingMap = false;
            mapEl.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
        }
    });
}

// 🌟 修改：原有的切换函数，增加文字还原功能
window.toggleMapExpansion = function() {
    const footer = document.querySelector('.bottom-bar');
    const icon = document.getElementById('expandIcon');
    const subtitle = document.getElementById('mapSubtitle');
    const isExpanded = footer.classList.toggle('expanded');

    if (isExpanded) {
        icon.style.transform = 'rotate(180deg)';
    } else {
        icon.style.transform = 'rotate(0deg)';
        // 收起时，把文字恢复成默认介绍
        subtitle.innerHTML = BASE_I18N.map_legend;
    }

    setTimeout(() => {
        if (window.drawWarehouseMap) {
            window.drawWarehouseMap(window.currentHighlightRack);
        }
    }, 300);
}

// ==========================================
// 🌟 将原生 Select 自动升级为定制圆角下拉组件
// ==========================================
function initCustomSelects() {
    // 找到页面上所有带有 btn-primary 类的 select
    document.querySelectorAll('select.btn-primary').forEach(select => {
        // 防止被重复执行
        if (select.parentNode.classList.contains('custom-select-container')) return;

        let wrapper = document.createElement('div');
        wrapper.className = 'custom-select-container';
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);

        let trigger = document.createElement('div');
        trigger.className = 'btn-primary select-trigger';
        trigger.innerHTML = `<span>${select.options[select.selectedIndex].text}</span>`;
        wrapper.appendChild(trigger);

        let optionsList = document.createElement('div');
        optionsList.className = 'select-options';

        Array.from(select.options).forEach(option => {
            let optDiv = document.createElement('div');
            optDiv.className = 'select-option' + (option.selected ? ' selected' : '');
            optDiv.innerText = option.text;
            optDiv.setAttribute('data-value', option.value);

            // 4. 点击选项时的交互逻辑
            optDiv.addEventListener('click', function(e) {
                e.stopPropagation();
                // 移除所有高亮，自己高亮
                optionsList.querySelectorAll('.select-option').forEach(el => el.classList.remove('selected'));
                this.classList.add('selected');

                // 按钮文字更新
                trigger.querySelector('span').innerText = this.innerText;

                // 🌟 核心：悄悄修改原生 select 的值，并触发你原本写的 change 事件！
                select.value = this.getAttribute('data-value');
                select.dispatchEvent(new Event('change'));

                // 关门
                optionsList.classList.remove('open');
                trigger.classList.remove('open');
            });
            optionsList.appendChild(optDiv);
        });
        wrapper.appendChild(optionsList);

        // 5. 点击按钮，展开/收起下拉面板
        trigger.addEventListener('click', function(e) {
            e.stopPropagation();
            // 独占模式：点开自己时，关掉页面上可能打开的其他面板
            document.querySelectorAll('.select-options.open').forEach(menu => {
                if (menu !== optionsList) {
                    menu.classList.remove('open');
                    menu.previousElementSibling.classList.remove('open');
                }
            });
            optionsList.classList.toggle('open');
            trigger.classList.toggle('open');
        });
    });

    // 6. 全局监听：点击网页空白处，收起所有展开的菜单
    document.addEventListener('click', function() {
        document.querySelectorAll('.select-options.open').forEach(menu => {
            menu.classList.remove('open');
            menu.previousElementSibling.classList.remove('open');
        });
    });
}

// ==========================================
// 🌟 全局页面加载监控引擎
// ==========================================
window.addEventListener('load', function() {
    const loader = document.getElementById('global-page-loader');

    // 给系统一点缓冲时间（可选），让界面渲染更平滑。这里设置了 300ms 延时。
    setTimeout(() => {
        if (loader) {
            // 1. 给遮罩层加 hidden 类，触发 CSS 的 0.5秒 渐隐淡出动画
            loader.classList.add('hidden');

            // 2. 拔除 body 的加载状态！瞬间激活全站所有按钮和侧边栏菜单
            document.body.classList.remove('is-loading');

            // 3. 彻底释放内存：等 0.5 秒淡出动画播完后，把遮罩层从流中移除
            setTimeout(() => {
                loader.style.display = 'none';
            }, 500);
        }
    }, 300);
});

// 页面加载完成后，立刻执行变身魔法
document.addEventListener("DOMContentLoaded", initCustomSelects);

// ==========================================
// 🌟 入库界面专属：动态统计"有效"入库行数
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const stockinCountDisplay = document.getElementById('stockinCountDisplay');
    const assetStockinCountDisplay = document.getElementById('assetStockinCountDisplay');

    const updateCount = () => {
        // 消耗品
        if (stockinCountDisplay) {
            let count = 0;
            const container = document.getElementById('stockInForm') || document;
            container.querySelectorAll('input[name="pn_1"]').forEach(input => {
                if (input.value.trim() !== '') count++;
            });
            stockinCountDisplay.innerText = count;
        }

        // 资产
        if (assetStockinCountDisplay) {
            let count = 0;
            const container = document.getElementById('assetStockInForm') || document;
            container.querySelectorAll('input[name="pn_1"]').forEach(input => {
                if (input.value.trim() !== '') count++;
            });
            assetStockinCountDisplay.innerText = count;
        }
    };

    // 监听全局的 "输入" 事件（打字、扫码枪录入、Ctrl+V 粘贴都会瞬间触发）
    document.addEventListener('input', updateCount);

    // 监听鼠标点击事件 (兼容你点击“清空网格”按钮的动作，加一点延时等清空完成)
    document.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('.material-icons')) {
            setTimeout(updateCount, 50);
        }
    });

    // 页面刚加载时统计一次（此时全是空框，所以会显示 0）
    updateCount();

});

// ==========================================
// 🌟 手机端协同传图引擎
// ==========================================

window.openMobileUploadAuth = async function(event) {
    let btn = event.currentTarget;
    let originalHtml = btn.innerHTML;

    // 按钮变成加载状态
    btn.innerHTML = `<i class="material-icons" style="font-size: 1.2rem; animation: spin 1s linear infinite;">autorenew</i> ${BASE_I18N.generating}`;
    btn.disabled = true;

    try {
        // ⚠️ 注意：这里向后端请求 Token，你需要确保后端写了这个接口！
        let res = await fetch('/api/generate_mobile_token', { method: 'POST' });
        let data = await res.json();

        if (data.status === 'success' && data.token) {
            // 拼接移动端专属页面的 URL (包含 token 身份验证)
            let currentHost = window.location.host
            let mobileUrl = `https://${currentHost}/mobile/quick_upload?token=${data.token}`;

            // 清空并生成新的二维码
            let canvas = document.getElementById('qrcodeCanvas');
            new QRious({
                element: canvas,
                value: mobileUrl,
                size: 220,
                level: 'H' // 高容错率，方便手机扫
            });

            // 呼出弹窗
            document.getElementById('qrModal').style.display = 'flex';
        } else {
            alert(BASE_I18N.auth_fail + (data.message || BASE_I18N.unknown_error));
        }
    } catch(e) {
        console.error(e);
        alert(BASE_I18N.network_error_qr);
    } finally {
        // 恢复按钮状态
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
};

window.closeQrModal = function() {
    document.getElementById('qrModal').style.display = 'none';
};

// ==========================================
// 🌟 搜索栏一键清空
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const globalSearch = document.getElementById('globalSearch');
    const clearBtn = document.getElementById('clearBtn');

    if (globalSearch && clearBtn) {

        // 优化1：不要写死 block，用 inline-block 或者直接置空 '' 也可以
        const showStyle = 'inline-block';

        // 初始化状态
        clearBtn.style.display = globalSearch.value.length > 0 ? showStyle : 'none';

        // 监听输入
        globalSearch.addEventListener('input', () => {
            clearBtn.style.display = globalSearch.value.length > 0 ? showStyle : 'none';
        });

        // 优化2：使用 mousedown 拦截失去焦点事件，彻底解决手机端键盘闪烁问题
        clearBtn.addEventListener('mousedown', (e) => {
            e.preventDefault(); // 核心：阻止默认的点击行为，输入框就不会失去焦点了！

            globalSearch.value = '';
            // globalSearch.focus(); // 因为没有失去焦点，所以这行甚至都可以省了，但保留也无妨

            globalSearch.dispatchEvent(new Event('input'));
        });
    }
});

// ==========================================
// 🌟 打印机状态检测与补印跳转 (安全修复版)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {

    // 1. 安全绑定标签补印按钮的点击事件 (找不到按钮也不会报错)
    const reprintBtn = document.getElementById('openReprint');
    if (reprintBtn) {
        reprintBtn.addEventListener('click', function () {
            window.open('/reprint', '_blank');
        });
    }

    // 2. 精简版打印机呼吸灯检测逻辑 (只变色，不需要文字)
    async function checkPrinterStatus() {
        const dot = document.getElementById('printerDot');
        if (!dot) return; // 安全退出

        try {
            let res = await fetch('/api/printer_status');
            let data = await res.json();

            if (data.status === 'online') {
                // 在线：亮绿色
                dot.style.background = '#1db954';
                dot.style.boxShadow = '0 0 0 3px rgba(29, 185, 84, 0.4)';
            } else {
                // 离线：亮红色
                dot.style.background = '#e74c3c';
                dot.style.boxShadow = '0 0 0 3px rgba(231, 76, 60, 0.4)';
            }
        } catch (e) {
            // 网络错误：恢复灰色
            dot.style.background = '#ccc';
            dot.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.3)';
        }
    }

    // 页面加载完毕立刻检测一次
    checkPrinterStatus();
    // 每 10 分钟检测一次
    setInterval(checkPrinterStatus, 600000);
});

// ==========================================
// 💬 全局聊天系统引擎
// ==========================================
let chatPollingInterval = null;
let lastMsgId = 0;

window.toggleChat = function() {
    const panel = document.getElementById('chatPanel');
    const badge = document.getElementById('chatUnreadBadge');

    if (panel.style.display === 'flex') {
        panel.style.display = 'none';
        clearInterval(chatPollingInterval); // 关闭窗口停止轮询
    } else {
        panel.style.display = 'flex';
        badge.style.display = 'none';
        badge.innerText = '0';
        fetchChatHistory(); // 立即加载历史记录
        scrollToBottom();
        document.getElementById('chatInput').focus();

        // 开启轮询 (每3秒拉取一次新消息)
        chatPollingInterval = setInterval(fetchChatHistory, 3000);
    }
};

function scrollToBottom() {
    const body = document.getElementById('chatBody');
    body.scrollTop = body.scrollHeight;
}

async function fetchChatHistory() {
    try {
        let res = await fetch('/api/chat/history');
        let messages = await res.json();

        if (messages.length > 0) {
            let maxId = messages[messages.length - 1].id;

            // 只有当有新消息时才重新渲染
            if (maxId > lastMsgId) {
                renderMessages(messages);
                lastMsgId = maxId;

                // 如果面板没打开，则显示小红点
                if (document.getElementById('chatPanel').style.display !== 'flex') {
                    document.getElementById('chatUnreadBadge').style.display = 'flex';
                } else {
                    scrollToBottom();
                }
            }
        }
    } catch (e) {
        console.error("无法获取聊天记录", e);
    }
}

function renderMessages(messages) {
    const body = document.getElementById('chatBody');
    // 保留顶部提示语，清除旧消息
    body.innerHTML = `<div style="text-align: center; color: #aaa; font-size: 0.8rem; margin-top: 10px;">${BASE_I18N.chat_note}</div>`;

    messages.forEach(msg => {
        const isSelf = msg.sender === window.CURRENT_USER.username;
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${isSelf ? 'msg-self' : 'msg-others'}`;

        // 如果是管理员发的消息，加上特殊的标签标识
        const roleTag = msg.role === 'admin' ? BASE_I18N.admin_tag : '';

        const displayName = msg.sender_full_name || msg.sender;

        msgDiv.innerHTML = `
            <span class="msg-sender">${roleTag}${displayName} - ${msg.timestamp}</span>
            <div class="msg-content">${msg.message}</div>
        `;
        body.appendChild(msgDiv);
    });
}

window.sendChatMessage = async function() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    // 乐观 UI 更新：先上墙，再发请求
    input.value = '';

    let formData = new FormData();
    formData.append('message', text);

    try {
        await fetch('/api/chat/send', {
            method: 'POST',
            body: formData
        });
        // 发送完毕后立即强制刷新一次列表
        fetchChatHistory();
    } catch (e) {
        alert(BASE_I18N.send_fail);
    }
};

// 页面加载完成时静默获取一次最新消息 ID
document.addEventListener('DOMContentLoaded', fetchChatHistory);