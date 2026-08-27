let assetSet = new Set();
let scanInput, scrapList, hiddenInputs, emptyState, countDisplay, scrapActionButton;

document.addEventListener('DOMContentLoaded', () => {
    scanInput = document.getElementById('scanInput');
    scrapList = document.getElementById('scrapList');
    // hiddenInputs = document.getElementById('hiddenInputs');
    emptyState = document.getElementById('emptyState');
    countDisplay = document.getElementById('countDisplay');

    // 获取新的执行按钮 (因为没有ID，所以用 onclick 属性来定位)
    scrapActionButton = document.querySelector('button[onclick="openScrapModal()"]');

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
        <td class="font-monospace" style="font-weight: bold; font-size: 1.15rem;">
            <i class="material-icons" style="font-size: 18px; color: var(--danger-red); vertical-align: middle; margin-right: 8px;">qr_code</i>
            ${val}
        </td>
        <td class="font-monospace" style="font-size: 1.1rem">${item.pn_1 || '-'}</td>
        <td class="font-monospace" style="font-size: 1.1rem">${item.pn_2 || '-'}</td>
        <td>${item.name || '-'}</td>
        <td>${raisonHtml}</td>
        <td>${item.location || '-'}</td>
        <td style="text-align: center;">
            <button type="button" class="btn-remove" ${deleteDisabled} style="${deleteOpacity}" onclick="removeAsset('${val}', this)" title="${deleteTitle}">
                <i class="material-icons">close</i>
            </button>
        </td>
    `;

    tr.classList.add('is-shaking');
    tr.addEventListener('animationend', function() {
        tr.classList.remove('is-shaking');
    }, { once: true });
    if (emptyState && emptyState.style.display !== 'none') emptyState.style.display = 'none';
    scrapList.prepend(tr);

    return true;
};

// 扫码录入
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

// 一键拉取停用资产
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

    // 同步更新指示灯
    const indicatorCount = document.getElementById('scrapCountDisplay');
    if (indicatorCount) {
        indicatorCount.innerText = count;
    }

    if (count > 0) {
        if (emptyState) emptyState.style.display = 'none';
        if (scrapActionButton) scrapActionButton.disabled = false;
    } else {
        if (emptyState) emptyState.style.display = 'table-row';
        if (scrapActionButton) scrapActionButton.disabled = true;
    }
};

// 拉取后端数据
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/asset_scrap');
        const result = await response.json();

        if (result.status === 'success') {
            window.ASSET_SCRAP_DATA = result.data;
            renderAssetScrap(result.data);

            // 修改左下指示灯
            const indicator = document.getElementById('indicator');
            const indicatorData = result.data;
            console.log(indicatorData);
            indicator.innerHTML = `
                <i class="material-icons" style="font-size: 1.45rem; color: var(--primary-green);">delete_sweep</i>
                ${BASE_I18N.asset_scrap}:
                <span id="scrapCountDisplay" style="font-size: 1.2rem; font-weight: bold; color: var(--primary-green); margin-left: 4px;">
                    ${indicatorData.length || 0}
                </span>
            `;
        }
    } catch (error) {
        console.error("Data Loaded Fail", error);
        document.querySelector('tbody').innerHTML = `<div style="text-align:center; color:red;">加载失败，请刷新重试</div>`;
    } finally {
        if (typeof window.hideGlobalLoader === 'function') {
            setTimeout(window.hideGlobalLoader, 50);
        }
    }
});

function renderAssetScrap (data) {
    const scrapList = document.getElementById('scrapList');
    if (!scrapList) return;

    // 每次刷新都清空旧集合
    assetSet.clear();

    if (!data || data.length === 0) {
        scrapList.innerHTML = `
            <tr id="emptyState">
                <td colspan="6" style="text-align: center; padding: 80px 20px; color: var(--text-muted); border: none;">
                    <i class="material-icons" style="font-size: 4rem; color: #e0e0e0; display: block; margin-bottom: 15px;">document_scanner</i>
                    <span style="font-size: 1.1rem;">${SCRAP_I18N.empty_table}</span>
                </td>
            </tr>
        `;
        window.updateUI();
        return;
    }

    const rowsHtml = data.map(draft => {
        // 逐行灌入数据
        assetSet.add(draft.ctrl_no.trim().toUpperCase());

        let btnDisabled = draft.is_stop ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : '';
        return `
            <tr id="row-${draft.ctrl_no}" class="scrap-item">
                <td class="font-monospace" style="font-weight: bold; font-size: 1.15rem;">
                    <i class="material-icons" style="font-size: 18px; color: var(--danger-red); vertical-align: middle; margin-right: 8px;">qr_code</i>
                    ${draft.ctrl_no}
                </td>
                <td class="font-monospace" style="font-size: 1.1rem">${draft.pn_1 || '-'}</td>
                <td class="font-monospace" style="font-size: 1.1rem">${draft.pn_2 || '-'}</td>
                <td>${draft.name || '-'}</td>
                <td>${draft.is_no_use ? "NO USE" : "NG Scrap"}</td>
                <td>${draft.location || '-'}</td>
                <td style="text-align: center;">
                    <button type="button" class="btn-remove" ${btnDisabled} onclick="removeAsset('${draft.ctrl_no}', this)" title="${draft.is_stop ? "Must unstop asset firstly" : SCRAP_I18N.title_remove}">
                        <i class="material-icons">close</i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    scrapList.innerHTML = rowsHtml;
    window.updateUI();
}
