document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. 极速无刷新扫码引擎 (Ajax 联动)
    // ==========================================
    const locInput = document.getElementById('scanLocation');
    const barcodeInput = document.getElementById('scanBarcode');
    const resultBox = document.getElementById('scanResult');

    if (locInput && barcodeInput && resultBox) {
        // 页面加载后自动对焦到库位输入框
        locInput.focus();

        // 🌟 修改点：库位框按回车，定位对应群组并跳到扫码框
        locInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                let locVal = this.value.trim();

                if (locVal !== '') {
                    // 注意：你的 HTML 模板里 {{ loc | lower }} 做了小写处理，所以这里也要转小写匹配
                    let targetBlock = document.querySelector(`.location-block[data-loc="${locVal.toLowerCase()}"]`);

                    if (targetBlock) {
                        // 1. 自动展开该折叠面板
                        targetBlock.classList.remove('collapsed');

                        // 2. 平滑滚动到该面板的位置
                        targetBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });

                        // 3. 视觉反馈：给该卡片加一个呼吸高亮，提示用户已成功锁定
                        targetBlock.style.transition = 'box-shadow 0.3s, border-color 0.3s';
                        targetBlock.style.borderColor = 'var(--primary)';
                        targetBlock.style.boxShadow = '0 0 15px rgba(93, 140, 138, 0.4)';

                        // 1.5秒后恢复原状
                        setTimeout(() => {
                            targetBlock.style.borderColor = 'var(--border-color)';
                            targetBlock.style.boxShadow = '0 4px 15px rgba(0,0,0,0.03)';
                        }, 1500);
                    }

                    // 无论库位是否存在，最后都将光标锁定到扫码框，准备扫码
                    barcodeInput.focus();
                }
            }
        });

        // 扫码框按回车，触发盘点 API
        barcodeInput.addEventListener('keydown', async function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();

                let currentLoc = locInput.value.trim();
                let ctrlNo = barcodeInput.value.trim();

                if (!currentLoc) {
                    resultBox.innerHTML = `<span style="color:#d93025;"><i class="material-icons" style="vertical-align:bottom;">error</i> ${ASSET_AUDIT_I18N.err_no_loc}</span>`;
                    locInput.focus();
                    return;
                }

                if (!ctrlNo) return;

                // 构造请求数据
                let formData = new FormData();
                formData.append("ctrl_no", ctrlNo);
                formData.append("current_location", currentLoc);

                try {
                    let response = await fetch('/api/asset_audit/scan', {
                        method: 'POST',
                        body: formData
                    });

                    let data = await response.json();

                    if (data.status === 'success') {
                        // 成功提示
                        if (data.is_location_changed) {
                            let warnText = ASSET_AUDIT_I18N.scan_warn.replace('{ctrlNo}', ctrlNo);
                            resultBox.innerHTML = `<span style="color:#f29900;"><i class="material-icons" style="vertical-align:bottom;">warning</i> ${warnText}</span>`;
                        } else {
                            resultBox.innerHTML = `<span style="color:#1e8e3e;"><i class="material-icons" style="vertical-align:bottom;">check_circle</i> ${data.message}</span>`;
                        }

                        // 🚀 核心黑科技：DOM 靶向修改，瞬间刷新页面数据！
                        let targetRow = document.getElementById(`row-${ctrlNo}`);
                        if (targetRow) {
                            targetRow.querySelector('.cell-actual-loc').innerText = currentLoc;
                            targetRow.querySelector('.cell-time').innerText = new Date().toISOString().split('T')[0];

                            let badge = targetRow.querySelector('.cell-status');
                            badge.className = 'status-badge cell-status ' + (data.is_location_changed ? 'status-warn' : 'status-done');
                            badge.innerText = data.is_location_changed ? ASSET_AUDIT_I18N.status_warn : ASSET_AUDIT_I18N.status_done;

                            targetRow.style.backgroundColor = '#e6f4ea';
                            setTimeout(() => targetRow.style.backgroundColor = 'transparent', 1000);
                        }
                    } else {
                        // 失败警告
                        resultBox.innerHTML = `<span style="color:#d93025;"><i class="material-icons" style="vertical-align:bottom;">error</i> ❌ ${data.message}</span>`;
                    }
                } catch (err) {
                    resultBox.innerHTML = `<span style="color:#d93025;">${ASSET_AUDIT_I18N.net_error}</span>`;
                }

                // 扫完清空条码，光标锁定，等待下一台
                barcodeInput.value = '';
                barcodeInput.focus();
            }
        });
    }

    // ==========================================
    // 2. 性能优化版全局搜索 (防抖 + DOM 缓存)
    // ==========================================
    document.querySelectorAll('.location-block tbody tr').forEach(row => {
        row._cachedSearchText = row.innerText.toLowerCase();
    });

    let searchTimeout;
    const globalSearch = document.getElementById('globalSearch');

    if (globalSearch) {
        globalSearch.addEventListener('input', function(e) {
            let term = e.target.value.toLowerCase().trim();
            clearTimeout(searchTimeout);

            searchTimeout = setTimeout(() => {
                if (term === "") {
                    document.querySelectorAll('.location-block').forEach(block => block.style.display = 'block');
                    document.querySelectorAll('tbody tr').forEach(row => row.style.display = '');
                    return;
                }

                document.querySelectorAll('.location-block').forEach(block => {
                    let locName = (block.getAttribute('data-loc') || "").toLowerCase();
                    let blockMatches = locName.includes(term);
                    let hasVisibleRow = false;

                    block.querySelectorAll('tbody tr').forEach(row => {
                        let rowText = row._cachedSearchText || "";
                        if (rowText.includes(term) || blockMatches) {
                            row.style.display = '';
                            hasVisibleRow = true;
                        } else {
                            row.style.display = 'none';
                        }
                    });

                    block.style.display = (blockMatches || hasVisibleRow) ? 'block' : 'none';
                    if (hasVisibleRow && term !== "") {
                        block.classList.remove('collapsed');
                    }
                });
            }, 250);
        });
    }

    // ==========================================
    // 3. 终极修复版：恢复滚动条位置
    // ==========================================
    let pos = sessionStorage.getItem('assetAuditScroll');
    if (pos) {
        setTimeout(() => {
            let scrollBox = document.querySelector('.content-scroll-area');
            if (scrollBox) scrollBox.scrollTo(0, parseInt(pos));
        }, 50);
        sessionStorage.removeItem('assetAuditScroll');
    }
});

// 记录滚动条位置
window.addEventListener('beforeunload', () => {
    let scrollBox = document.querySelector('.content-scroll-area');
    if (scrollBox) {
        sessionStorage.setItem('assetAuditScroll', scrollBox.scrollTop);
    }
});