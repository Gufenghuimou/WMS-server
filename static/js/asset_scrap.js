let assetSet = new Set();
let scanInput, scrapList, hiddenInputs, emptyState, countDisplay, scrapActionButton;
let expectedSecurityAnswer = 0; // 🛡️ 安全锁答案变量

document.addEventListener('DOMContentLoaded', () => {
    scanInput = document.getElementById('scanInput');
    scrapList = document.getElementById('scrapList');
    // hiddenInputs = document.getElementById('hiddenInputs');
    emptyState = document.getElementById('emptyState');
    countDisplay = document.getElementById('countDisplay');

    // 获取新的执行按钮 (因为没有ID，所以用 onclick 属性来定位)
    scrapActionButton = document.querySelector('button[onclick="openSecurityModal()"]');

    // 1. 绑定扫码回车事件
    if (scanInput) {
        scanInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.addAsset();
            }
        });
    }

    // 2. 🛡️ 绑定安全锁回车确认事件
    const securityInput = document.getElementById('securityAnswerInput');
    if (securityInput) {
        securityInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.verifyAndExecuteScrap();
            }
        });
    }

    // 3. 🧩 草稿箱恢复引擎：把后端渲染的表格行，重新塞入 JS 集合与隐藏表单
    document.querySelectorAll('.scrap-item').forEach(tr => {
        if (tr.id === 'emptyState') return;

        let td = tr.querySelector('td');
        if (td) {
            let val = td.innerText.trim();
            // 过滤掉可能包含的 material-icons 文字
            val = val.replace('qr_code', '').trim();

            if (val && !assetSet.has(val)) {
                assetSet.add(val);
                // 补齐后端提交需要的 hidden input
                // const input = document.createElement('input');
                // input.type = 'hidden';
                // input.name = 'ctrl_no';
                // input.value = val;
                // input.id = 'hidden_' + val;
                // if (hiddenInputs) hiddenInputs.appendChild(input);
            }
        }
    });

    // 初始状态更新
    window.updateUI();
});

// 🌟 核心引擎：将单个对象渲染为表格行
window.addAssetToTable = function(item, isFromFetch = false) {
    const val = item.ctrl_no.trim().toUpperCase();
    if (!val || assetSet.has(val)) return false;

    assetSet.add(val);

    // 1. 插入表格行 <tr>
    let raisonHtml = item.is_no_use ? 'NO USE' : 'NG Scrap';

    const deleteDisabled = isFromFetch ? 'disabled' : '';
    const deleteOpacity = isFromFetch ? 'opacity: 0.3; cursor: not-allowed;' : '';
    const deleteTitle = isFromFetch ? 'Must unstop asset firstly' : SCRAP_I18N.title_remove;

    const tr = document.createElement('tr');
    tr.className = 'scrap-item';
    tr.id = 'row-' + val;
    tr.innerHTML = `
        <td style="font-weight: bold; font-size: 1.15rem">
            <i class="material-icons" style="font-size: 18px; color: var(--danger-red); vertical-align: middle; margin-right: 8px;">qr_code</i>
            ${val}
        </td>
        <td>${item.pn_1 || '-'}</td>
        <td>${item.pn_2 || '-'}</td>
        <td>${item.name || '-'}</td>
        <td>${raisonHtml}</td>
        <td>${item.location || '-'}</td>
        <td style="text-align: center;">
            <button type="button" class="btn-remove" ${deleteDisabled} style="${deleteOpacity}" onclick="removeAsset('${val}', this)" title="${deleteTitle}">
                <i class="material-icons">close</i>
            </button>
        </td>
    `;

    if (emptyState && emptyState.style.display !== 'none') emptyState.style.display = 'none';
    scrapList.appendChild(tr);

    // 2. 插入后端所需的隐藏表单 <input>
    // const input = document.createElement('input');
    // input.type = 'hidden';
    // input.name = 'ctrl_no';
    // input.value = val;
    // input.id = 'hidden_' + val;
    // if (hiddenInputs) hiddenInputs.appendChild(input);

    return true;
};

// 🌟 手工扫码录入 (对接后端 API 存入草稿数据库)
window.addAsset = async function() {
    if (!scanInput) return;
    const val = scanInput.value.trim().toUpperCase();
    if (!val) return;

    if (assetSet.has(val)) {
        // 扫重了给个颤抖动画
        scanInput.style.transform = 'translateX(-5px)';
        setTimeout(() => scanInput.style.transform = 'translateX(5px)', 50);
        setTimeout(() => scanInput.style.transform = 'translateX(0)', 100);
        scanInput.value = '';
        return;
    }

    // 发送 Ajax 请求存入数据库暂存表
    let formData = new FormData();
    formData.append('ctrl_no', val);

    try {
        let response = await fetch('/api/asset_scrap/scan', { method: 'POST', body: formData });
        let result = await response.json();

        if (result.status === 'success') {
            if (result.data) {
                // 如果是新加的，渲染完整数据
                window.addAssetToTable(result.data);
            }
        } else {
            alert(result.message);
        }
    } catch (e) {
        alert(SCRAP_I18N.scan_net_error);
    }

    window.updateUI();
    scanInput.value = '';
    scanInput.focus();
};

// 🌟 一键拉取停用资产
window.fetchStoppedAssets = async function(event) {
    const btn = event ? event.currentTarget : document.querySelector('button[onclick*="fetchStoppedAssets"]');
    const originalHtml = btn ? btn.innerHTML : '';

    if (btn) {
        btn.innerHTML = `<i class="material-icons" style="font-size: 1.2rem; margin-right: 5px; animation: spin 1s linear infinite;">autorenew</i>${SCRAP_I18N.fetching}`;
        btn.disabled = true;
    }

    try {
        let res = await fetch('/api/get_stopped');
        let result = await res.json();

        if (result.status === 'success') {
            showToast(result.message, 'success');
            let assets = result.data;
            let addedCount = 0;

            assets.forEach(item => {
                if (window.addAssetToTable(item, true)) {
                    addedCount++;
                }
            });

            window.updateUI();

            // 动态替换变量显示结果
            let successMsg = SCRAP_I18N.fetch_success
                                .replace('{total}', assets.length)
                                .replace('{added}', addedCount);
            alert(successMsg);
        } else {
            showToast(result.message, 'error');
            alert(result.message);
        }
    } catch (e) {
        alert(SCRAP_I18N.fetch_net_error);
    } finally {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }
};

// window.removeAsset = function(val, btnElement) {
//     assetSet.delete(val);
//     const tr = btnElement.closest('.scrap-item');
//     if (tr) tr.remove();
//
//     const input = document.getElementById('hidden_' + val);
//     if (input) input.remove();
//
//     window.updateUI();
//     if (scanInput) scanInput.focus();
// };

window.removeAsset = async function(val, btnElement){
    if (btnElement.disabled) return;

    let formData = new FormData();
    formData.append('ctrl_no', val);
    try {
        let res = await fetch('/api/asset_scrap/delete', {method: 'POST', body: formData});
        let result = await res.json();

        if (result.status === 'success') {
            showToast(result.message, 'success');
            assetSet.delete(val);
            const tr = btnElement.closest('.scrap-item');
            if (tr) tr.remove();
            // const input = document.getElementById('hidden_' + val);
            // if (input) input.remove();
            window.updateUI();
            if (scanInput) scanInput.focus();
        } else {
            showToast(result.message, 'error');
            alert(result.message);
        }
    } catch (e) {
        alert("Delete Failed, please check internet.")
    }
};

window.updateUI = function() {
    const count = assetSet.size;

    if (countDisplay) {
        countDisplay.style.transform = 'scale(1.2)';
        setTimeout(() => countDisplay.style.transform = 'scale(1)', 150);
        countDisplay.innerText = count;
    }

    if (count > 0) {
        if (emptyState) emptyState.style.display = 'none';
        if (scrapActionButton) scrapActionButton.disabled = false;
    } else {
        if (emptyState) emptyState.style.display = 'table-row';
        if (scrapActionButton) scrapActionButton.disabled = true;
    }
};

// ==========================================
// 🛡️ 报废安全锁引擎 (滑动解锁版)
// ==========================================

let isDraggingSlider = false;
let startX = 0;
let maxDrag = 0;
const ZOOM_LEVEL = 0.67; // 对应 base.css 里的缩放

window.openSecurityModal = function() {
    if (assetSet.size === 0) return;

    const modal = document.getElementById('scrapSecurityModal');
    modal.style.display = 'flex';

    // 重置滑块状态
    resetSlider();

    // 初始化滑块参数
    const handle = document.getElementById('sliderHandle');
    const container = document.getElementById('sliderContainer');
    maxDrag = container.clientWidth - handle.clientWidth - 6; // 6是左右padding补偿

    // 绑定事件
    handle.onmousedown = startSlide;
};

function startSlide(e) {
    isDraggingSlider = true;
    startX = e.clientX;
    document.onmousemove = onSlide;
    document.onmouseup = stopSlide;

    // 移除过渡效果，让拖拽随动
    document.getElementById('sliderHandle').style.transition = 'none';
    document.getElementById('sliderBg').style.transition = 'none';
}

function onSlide(e) {
    if (!isDraggingSlider) return;

    // 核心计算：除以缩放倍率
    let moveX = (e.clientX - startX) / ZOOM_LEVEL;

    // 边界控制
    if (moveX < 0) moveX = 0;
    if (moveX > maxDrag) moveX = maxDrag;

    updateSliderPosition(moveX);

    // 检查是否滑到底了 (98% 就算成功)
    if (moveX >= maxDrag * 0.98) {
        unlockSuccess();
    }
}

function stopSlide() {
    if (!isDraggingSlider) return;
    isDraggingSlider = false;
    document.onmousemove = null;
    document.onmouseup = null;

    // 如果没解锁成功，弹回去
    if (!document.getElementById('sliderContainer').classList.contains('unlocked')) {
        resetSlider(true);
    }
}

function updateSliderPosition(x) {
    const handle = document.getElementById('sliderHandle');
    const bg = document.getElementById('sliderBg');
    handle.style.left = (x + 3) + 'px';
    bg.style.width = (x + 25) + 'px'; // 25是让背景稍微没过滑块中心
}

function resetSlider(animate = false) {
    const container = document.getElementById('sliderContainer');
    const handle = document.getElementById('sliderHandle');
    const bg = document.getElementById('sliderBg');
    const text = document.getElementById('sliderText');

    container.classList.remove('unlocked');
    text.innerText = SCRAP_I18N.slider_text || "Slide to Confirm";

    if (animate) {
        handle.style.transition = 'left 0.3s ease';
        bg.style.transition = 'width 0.3s ease';
    }

    handle.style.left = '3px';
    bg.style.width = '0';
}

function unlockSuccess() {
    isDraggingSlider = false;
    document.onmousemove = null;

    const container = document.getElementById('sliderContainer');
    container.classList.add('unlocked');
    document.getElementById('sliderText').innerText = "RELEASE TO DESTROY"; // 这里也可以用 I18N

    // 自动提交 (加个微小的延迟增加仪式感)
    setTimeout(() => {
        document.getElementById('scrapForm').submit();
    }, 200);
}

window.closeSecurityModal = function() {
    document.getElementById('scrapSecurityModal').style.display = 'none';
    resetSlider();
};