let currentReqQty = 0;

window.openApproveModal = function(reqId, pn, name, reqQty, sysStock, location) {
    document.getElementById('approveForm').action = '/request_queue/approve/' + reqId;
    document.getElementById('modalPn').innerText = pn;
    document.getElementById('modalName').innerText = name;
    document.getElementById('modalSysStock').innerText = sysStock;
    document.getElementById('modalReqQty').innerText = reqQty;
    currentReqQty = parseInt(reqQty);

    // 重置所有输入和报错状态
    let stockInput = document.getElementById('realStock');
    stockInput.value = '';
    stockInput.style.backgroundColor = 'transparent';
    document.getElementById('approveError').style.display = 'none';
    document.getElementById('approveForm').classList.remove('shake-animation');

    document.getElementById('approveModal').style.display = 'block';

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