// ==========================================
// 🌟 Canvas 终极版地图编辑器 全局状态
// ==========================================
const GRID_SIZE = 10;
let editorRacks = [];

// 多选系统核心变量
let selectedRacks = [];
let isDragging = false;
let isSelecting = false;
let dragStartCoords = [];
let selStartX = 0, selStartY = 0, selEndX = 0, selEndY = 0;

// DOM 元素引用 (在 DOMContentLoaded 中赋值)
let editorCanvas, eCtx;
let pName, pW, pH, colorTrigger, btnUpd, btnDel, btnDup, paletteBox;

// ==========================================
// 核心内部函数
// ==========================================

// 亮度对比算法
function getContrastYIQ(hexcolor){
    hexcolor = (hexcolor || "#ffffff").replace("#", "");
    if (hexcolor.length === 3) hexcolor = hexcolor.split('').map(c => c + c).join('');
    const r = parseInt(hexcolor.substr(0,2),16), g = parseInt(hexcolor.substr(2,2),16), b = parseInt(hexcolor.substr(4,2),16);
    return (((r*299)+(g*587)+(b*114))/1000 >= 140) ? '#1e293b' : '#ffffff';
}

// 绘图主引擎
function drawEditor() {
    if (!eCtx) return;
    eCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);

    // 网格线
    eCtx.beginPath();
    for (let x = 0; x <= editorCanvas.width; x += GRID_SIZE) { eCtx.moveTo(x, 0); eCtx.lineTo(x, editorCanvas.height); }
    for (let y = 0; y <= editorCanvas.height; y += GRID_SIZE) { eCtx.moveTo(0, y); eCtx.lineTo(editorCanvas.width, y); }
    eCtx.strokeStyle = "#e2e8f0"; eCtx.lineWidth = 1; eCtx.stroke();

    eCtx.font = 'bold 16px "Roboto Mono", monospace';
    eCtx.textAlign = 'center'; eCtx.textBaseline = 'middle';

    editorRacks.forEach(r => {
        let bgColor = r.color || "#ffffff";
        let isSelected = selectedRacks.includes(r);

        if (isSelected) {
            eCtx.fillStyle = bgColor;
            eCtx.strokeStyle = "#38bdf8"; eCtx.lineWidth = 3;
            eCtx.shadowColor = "rgba(56, 189, 248, 0.8)"; eCtx.shadowBlur = 15;
        } else {
            eCtx.shadowBlur = 0; eCtx.fillStyle = bgColor; eCtx.strokeStyle = "#94a3b8"; eCtx.lineWidth = 1;
        }

        eCtx.fillRect(r.x, r.y, r.w, r.h);
        eCtx.strokeRect(r.x, r.y, r.w, r.h);

         eCtx.font = 'bold 16px "Roboto Mono", monospace';
        eCtx.textAlign = 'center'; eCtx.textBaseline = 'middle';

        eCtx.fillStyle = getContrastYIQ(bgColor);
        eCtx.fillText(r.name, r.x + r.w/2, r.y + r.h/2);
    });
    eCtx.shadowBlur = 0;

    // 绘制淡蓝色的选择框
    if (isSelecting) {
        eCtx.fillStyle = "rgba(56, 189, 248, 0.2)";
        eCtx.strokeStyle = "rgba(56, 189, 248, 0.8)";
        eCtx.lineWidth = 1;
        eCtx.fillRect(selStartX, selStartY, selEndX - selStartX, selEndY - selStartY);
        eCtx.strokeRect(selStartX, selStartY, selEndX - selStartX, selEndY - selStartY);
    }
}

// 获取免疫 zoom 缩放的真实 Canvas 坐标
function getCanvasPos(e) {
    const rect = editorCanvas.getBoundingClientRect();
    let currentZoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    return {
        x: (e.clientX - rect.left) / currentZoom,
        y: (e.clientY - rect.top) / currentZoom
    };
}

// 更新属性面板
function updatePropPanel() {
    if (!pName) return;
    if (selectedRacks.length === 1) {
        let r = selectedRacks[0];
        pName.value = r.name; pW.value = r.w; pH.value = r.h;
        pName.disabled = pW.disabled = pH.disabled = false;
        colorTrigger.style.background = r.color || "#ffffff"; colorTrigger.style.cursor = 'pointer';
        btnUpd.disabled = btnDel.disabled = btnDup.disabled = false;
    } else if (selectedRacks.length > 1) {
        pName.value = ADMIN_I18N.selected_count.replace('{count}', selectedRacks.length);
        pW.value = ''; pH.value = '';
        pName.disabled = pW.disabled = pH.disabled = true;
        colorTrigger.style.background = '#ffffff'; colorTrigger.style.cursor = 'pointer';
        btnUpd.disabled = true;
        btnDel.disabled = btnDup.disabled = false;
    } else {
        pName.value = ''; pW.value = ''; pH.value = '';
        pName.disabled = pW.disabled = pH.disabled = true;
        colorTrigger.style.background = '#ffffff'; colorTrigger.style.cursor = 'not-allowed';
        btnUpd.disabled = btnDel.disabled = btnDup.disabled = true;
    }
}

// ==========================================
// 挂载至 window 的 API (供 HTML 按钮调用)
// ==========================================

window.updateSelectedRack = function() {
    if (selectedRacks.length === 1) {
        let r = selectedRacks[0];
        r.name = pName.value;
        r.w = Math.max(GRID_SIZE, Math.round(parseFloat(pW.value) / GRID_SIZE) * GRID_SIZE);
        r.h = Math.max(GRID_SIZE, Math.round(parseFloat(pH.value) / GRID_SIZE) * GRID_SIZE);
        pW.value = r.w; pH.value = r.h;
        drawEditor();
    }
};

window.deleteSelectedRack = function() {
    if (selectedRacks.length === 0) return;
    editorRacks = editorRacks.filter(r => !selectedRacks.includes(r));
    selectedRacks = [];
    updatePropPanel(); drawEditor();
};

window.duplicateSelectedRack = function() {
    if (selectedRacks.length === 0) return;
    let newSelections = [];
    selectedRacks.forEach(r => {
        let newRack = { name: r.name, color: r.color, x: r.x + GRID_SIZE*2, y: r.y + GRID_SIZE*2, w: r.w, h: r.h };
        editorRacks.push(newRack);
        newSelections.push(newRack);
    });
    selectedRacks = newSelections;
    updatePropPanel(); drawEditor();
};

window.addNewRack = function() {
    editorRacks.push({ name: ADMIN_I18N.new_rack_name, color: "#e0f2fe", x: 30, y: 30, w: 60, h: 120 });
    selectedRacks = [editorRacks[editorRacks.length - 1]];
    let canvasWrapper = document.querySelector('#editorCanvas');
    if (canvasWrapper && canvasWrapper.parentElement) {
        canvasWrapper.parentElement.scrollTop = 0;
    }
    updatePropPanel(); drawEditor();
};

window.saveMapToDb = function() {
    if (confirm(ADMIN_I18N.confirm_deploy)) {
        fetch('/api/layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editorRacks) })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') alert(ADMIN_I18N.deploy_success); else alert(ADMIN_I18N.deploy_fail + data.message);
        });
    }
};

window.togglePalette = function(e) {
    if (selectedRacks.length === 0 || !paletteBox) return;
    paletteBox.style.display = paletteBox.style.display === 'none' ? 'grid' : 'none';
    e.stopPropagation();
};

// ==========================================
// 初始化及事件绑定
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    // 1. 全局异步表单拦截引擎 (处理新建/删除/重置)
    document.querySelectorAll('.async-form').forEach(form => {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            let confirmText = this.getAttribute('data-confirm');
            if (confirmText && !confirm(confirmText)) return;

            let formData = new FormData(this);
            let msgBox = document.getElementById('globalAdminMsg');
            let btn = this.querySelector('button[type="submit"]');
            let originalBtnHtml = btn.innerHTML;

            btn.disabled = true;
            btn.innerHTML = `<i class="material-icons" style="font-size: 1.2rem; animation: spin 1s linear infinite;">autorenew</i> ${ADMIN_I18N.processing}`;
            msgBox.style.display = 'none';
            msgBox.className = 'admin-msg-box';
            window.scrollTo({ top: 0, behavior: 'smooth' });

            try {
                let response = await fetch(this.action, { method: this.method, body: formData });
                let data = await response.json();

                msgBox.innerText = data.message;
                msgBox.style.display = 'block';

                if (data.status === 'error') {
                    msgBox.classList.add('msg-error');
                    btn.disabled = false;
                    btn.innerHTML = originalBtnHtml;
                } else if (data.status === 'success') {
                    msgBox.classList.add('msg-success');
                    btn.innerHTML = `<i class="material-icons" style="font-size: 1.2rem;">check</i> ${ADMIN_I18N.success}`;
                    btn.style.background = '#1db954';
                    setTimeout(() => window.location.reload(), 1500);
                }
            } catch (err) {
                console.error(err);
                msgBox.innerText = ADMIN_I18N.net_error;
                msgBox.classList.add('msg-error');
                msgBox.style.display = 'block';
                btn.disabled = false;
                btn.innerHTML = originalBtnHtml;
            }
        });
    });

    // 2. 初始化地图编辑器
    editorCanvas = document.getElementById('editorCanvas');
    if (editorCanvas) {
        eCtx = editorCanvas.getContext('2d');
        pName = document.getElementById('propName');
        pW = document.getElementById('propW');
        pH = document.getElementById('propH');
        colorTrigger = document.getElementById('colorTrigger');
        btnUpd = document.getElementById('btnUpdate');
        btnDel = document.getElementById('btnDelete');
        btnDup = document.getElementById('btnDuplicate');
        paletteBox = document.getElementById('colorPalette');

        if (pName) {
            pName.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    window.updateSelectedRack();
                    pName.blur();
                }
            });
        }

        fetch('/api/layout').then(res => res.json()).then(data => {
            if(Array.isArray(data)) editorRacks = data;
            drawEditor();
        });

        // 绑定 Canvas 鼠标事件
        editorCanvas.addEventListener('mousedown', (e) => {
            const pos = getCanvasPos(e);
            const mouseX = pos.x;
            const mouseY = pos.y;

            let clickedRack = null;
            for (let i = editorRacks.length - 1; i >= 0; i--) {
                let r = editorRacks[i];
                if (mouseX >= r.x && mouseX <= r.x + r.w && mouseY >= r.y && mouseY <= r.y + r.h) {
                    clickedRack = r; break;
                }
            }

            if (clickedRack) {
                if (e.shiftKey) {
                    let idx = selectedRacks.indexOf(clickedRack);
                    if (idx > -1) selectedRacks.splice(idx, 1);
                    else selectedRacks.push(clickedRack);
                } else {
                    if (!selectedRacks.includes(clickedRack)) selectedRacks = [clickedRack];
                }

                if (selectedRacks.length > 0) {
                    isDragging = true;
                    editorCanvas.style.cursor = 'grabbing';
                    dragStartCoords = selectedRacks.map(r => ({ rack: r, offsetX: mouseX - r.x, offsetY: mouseY - r.y }));
                }
            } else {
                if (!e.shiftKey) selectedRacks = [];
                isSelecting = true;
                selStartX = selEndX = mouseX;
                selStartY = selEndY = mouseY;
            }

            updatePropPanel(); drawEditor();
        });

        editorCanvas.addEventListener('mousemove', (e) => {
            const pos = getCanvasPos(e);
            const mouseX = pos.x;
            const mouseY = pos.y;

            if (isDragging) {
                dragStartCoords.forEach(item => {
                    item.rack.x = Math.round((mouseX - item.offsetX) / GRID_SIZE) * GRID_SIZE;
                    item.rack.y = Math.round((mouseY - item.offsetY) / GRID_SIZE) * GRID_SIZE;
                });
                drawEditor();
            } else if (isSelecting) {
                selEndX = mouseX;
                selEndY = mouseY;
                drawEditor();
            }
        });

        editorCanvas.addEventListener('mouseup', (e) => {
            if (isSelecting) {
                let minX = Math.min(selStartX, selEndX), maxX = Math.max(selStartX, selEndX);
                let minY = Math.min(selStartY, selEndY), maxY = Math.max(selStartY, selEndY);

                let newSelections = editorRacks.filter(r => !(r.x > maxX || r.x + r.w < minX || r.y > maxY || r.y + r.h < minY));

                if (e.shiftKey) {
                    newSelections.forEach(r => { if (!selectedRacks.includes(r)) selectedRacks.push(r); });
                } else {
                    selectedRacks = newSelections;
                }
            }

            isDragging = false; isSelecting = false;
            editorCanvas.style.cursor = 'crosshair';
            updatePropPanel(); drawEditor();
        });

        editorCanvas.addEventListener('mouseleave', () => { isDragging = isSelecting = false; drawEditor(); });

        // 全局快捷键
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); window.duplicateSelectedRack(); }
            if (e.key === 'Delete' || e.key === 'Backspace') { window.deleteSelectedRack(); }
        });

        // 3. Office 风格 70色 调色板生成
        const colorSwatches = [
            '#ffffff','#f8fafc','#f1f5f9','#e2e8f0','#cbd5e1','#94a3b8','#475569','#1e293b','#0f172a','#000000',
            '#fef2f2','#fee2e2','#fecaca','#fca5a5','#f87171','#ef4444','#dc2626','#b91c1c','#991b1b','#7f1d1d',
            '#fff7ed','#ffedd5','#fed7aa','#fdba74','#fb923c','#f97316','#ea580c','#c2410c','#9a3412','#7c2d12',
            '#fefce8','#fef08a','#fde047','#facc15','#eab308','#ca8a04','#a16207','#854d0e','#713f12','#422006',
            '#f0fdf4','#dcfce7','#bbf7d0','#86efac','#4ade80','#22c55e','#16a34a','#15803d','#166534','#14532d',
            '#f0fdfa','#ccfbf1','#99f6e4','#5eead4','#2dd4bf','#14b8a6','#0d9488','#0f766e','#115e59','#134e4a',
            '#eff6ff','#dbeafe','#bfdbfe','#93c5fd','#60a5fa','#3b82f6','#2563eb','#1d4ed8','#1e40af','#1e3a8a',
            '#eef2ff','#e0e7ff','#c7d2fe','#a5b4fc','#818cf8','#6366f1','#4f46e5','#4338ca','#3730a3','#312e81',
            '#faf5ff','#f3e8ff','#e9d5ff','#d8b4fe','#c084fc','#a855f7','#9333ea','#7e22ce','#6b21a8','#581c87',
            '#fdf2f8','#fce7f3','#fbcfe8','#f9a8d4','#f472b6','#ec4899','#db2777','#be185d','#9d174d','#831843'
        ];

        colorSwatches.forEach(c => {
            let div = document.createElement('div');
            div.style.backgroundColor = c;
            div.style.width = '100%';
            div.style.paddingBottom = '100%';
            div.style.borderRadius = '2px';
            div.style.cursor = 'pointer';
            div.style.boxShadow = 'inset 0 0 0 1px rgba(0,0,0,0.05)';

            div.onclick = (e) => {
                e.stopPropagation();
                if (selectedRacks.length === 0) return;
                selectedRacks.forEach(r => r.color = c);
                colorTrigger.style.background = c;
                paletteBox.style.display = 'none';
                drawEditor();
            };
            paletteBox.appendChild(div);
        });

        // 点击网页空白处收起调色板
        document.addEventListener('click', () => { if(paletteBox) paletteBox.style.display = 'none'; });
    }
});