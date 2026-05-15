let currentReqQty = 0;

window.switchQueueTab = function(tableName, el) {
    document.querySelectorAll('.queue-header-tab').forEach(tab => {
        tab.classList.remove('active');
        tab.classList.add('inactive');
    });
    el.classList.remove('inactive');
    el.classList.add('active');
    document.getElementById('tab-consumable').style.display = tableName === 'consumable' ? 'block' : 'none';
    document.getElementById('tab-asset').style.display = tableName === 'asset' ? 'block' : 'none';
};

window.openApproveModal = function(reqId, pn, name, reqQty, sysStock, location) {
    document.getElementById('approveForm').action = '/request_queue/approve/' + reqId;
    document.getElementById('modalPn').innerText = pn;
    document.getElementById('modalName').innerText = name;
    document.getElementById('modalSysStock').innerText = sysStock;
    document.getElementById('modalReqQty').innerText = reqQty;
    document.getElementById('modalLocation').innerText = location;
    currentReqQty = parseInt(reqQty);

    // 重置所有输入和报错状态
    let stockInput = document.getElementById('realStock');
    stockInput.value = '';
    stockInput.style.backgroundColor = 'transparent';
    document.getElementById('approveError').style.display = 'none';
    document.getElementById('approveForm').classList.remove('shake-animation');

    document.getElementById('approveModal').style.display = 'flex';

    // 自动呼叫底部地图对焦
    if (location && location.trim() !== '' && location !== '-' && location !== 'None') {
        let rackName = location.split('-')[0].toUpperCase();
        if (window.openFooterMap) window.openFooterMap(rackName);
    }

    setTimeout(() => stockInput.focus(), 100);
};

window.closeApproveModal = function() {
    document.getElementById('approveModal').style.display = 'none';
};

// 🌟 护城河：防止批准时库存依然不足
window.validateApproveForm = function(event) {
    let realStock = parseInt(document.getElementById('realStock').value) || 0;
    let form = document.getElementById('approveForm');
    let errorBox = document.getElementById('approveError');
    let errorText = document.getElementById('approveErrorText');
    let stockInput = document.getElementById('realStock');

    if (realStock < currentReqQty) {
        event.preventDefault();

        // 动态替换 I18N 字符串中的变量
        errorText.innerText = QUEUE_I18N.stock_insufficient
                                .replace('{realStock}', realStock)
                                .replace('{reqQty}', currentReqQty);

        errorBox.style.display = 'flex';

        stockInput.style.backgroundColor = '#fadbd8';
        form.classList.remove('shake-animation');
        void form.offsetWidth; // 触发重绘
        form.classList.add('shake-animation');

        return false;
    }
    return true;
};

// 页面加载完成后绑定输入事件，自动清除错误样式
document.addEventListener('DOMContentLoaded', () => {
    const realStockInput = document.getElementById('realStock');
    if (realStockInput) {
        realStockInput.addEventListener('input', () => {
            document.getElementById('approveError').style.display = 'none';
            realStockInput.style.backgroundColor = 'transparent';
        });
    }
});

window.openAssetApproveModal = function(reqId, matter, pn, reqQty, ctrlNo) {
    const modal = document.getElementById('assetApproveModal');
    const form = document.getElementById('assetApproveForm');
    const title = document.getElementById('assetModalTitle');
    const dynamicBox = document.getElementById('assetDynamicInput');

    form.action = `/request_queue/asset_approve/${reqId}`;
    document.getElementById('assetModalPn').innerText = pn;
    let ctrlBox = document.getElementById('assetModalCtrlNoBox');
    if (ctrlNo && ctrlNo !== 'None') {
        ctrlBox.style.display = 'block';
        document.getElementById('assetModalCtrlNo').innerText = ctrlNo;
    } else {
        ctrlBox.style.display = 'none';
    }
    if (matter === 'require') {
        title.innerHTML = `<i class="material-icons" style="color:#2196f3;">add_shopping_cart</i> Dispatch Asset`;
        dynamicBox.innerHTML = `
            <label style="display: block; font-weight: bold; color: var(--text-main); margin-bottom: 8px;">Scan Serial Numbers (Expected: ${reqQty}) <span style="color: red;">*</span></label>
            <input type="text" name="ctrl_nos" required placeholder="e.g. SN001, SN002"
                   style="width: 100%; height: 42px; font-size: 1rem; padding: 0 10px; border: 2px solid #2196f3; border-radius: 6px; outline: none; box-sizing: border-box;">
            <p style="font-size: 0.75rem; color: #888; margin-top: 5px;">Use comma to separate multiple SNs.</p>
        `;
    }
    else if (matter === 'return') {
        title.innerHTML = `<i class="material-icons" style="color:#1e8e3e;">assignment_return</i> Confirm Return`;
        dynamicBox.innerHTML = `
            <label style="display: block; font-weight: bold; color: var(--text-main); margin-bottom: 8px;">Target Location</label>
            <input type="text" name="target_location" placeholder="Leave blank to use original location"
                   style="width: 100%; height: 42px; font-size: 1rem; padding: 0 10px; border: 1px solid #ccc; border-radius: 6px; outline: none; box-sizing: border-box;">
        `;
    }
    else if (matter === 'broken') {
        title.innerHTML = `<i class="material-icons" style="color:#d93025;">build</i> Confirm Broken`;
        dynamicBox.innerHTML = `
            <div style="background: #fce8e6; color: #d93025; padding: 15px; border-radius: 6px; border: 1px dashed #fadbd8; text-align: center;">
                <i class="material-icons" style="font-size: 2rem; margin-bottom: 5px;">warning</i><br>
                Asset will be automatically moved to NG Area and flagged as stock.
            </div>
        `;
    }
    modal.style.display = 'flex';
};

window.closeAssetApproveModal = function() {
    document.getElementById('assetApproveModal').style.display = 'none';
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if(window.closeApproveModal) window.closeApproveModal();
        if(window.closeAssetApproveModal) window.closeAssetApproveModal();
    }
});