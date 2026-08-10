document.addEventListener('DOMContentLoaded', () => {

    const alertAudio = new Audio('../static/sound/alert.mp3');
    const doneAudio = new Audio('../static/sound/done.mp3');
    const noticeAudio = new Audio('../static/sound/notice.mp3');

    // 渲染页面时将折叠的group丢到后面去 将未盘点的物品拉到group最上端
    const auditContainer = document.getElementById('auditContainer');
    if (auditContainer) {
        const blocks = auditContainer.querySelectorAll('.location-block');
        blocks.forEach(block => {
            if (block.classList.contains('collapsed')) {
                auditContainer.appendChild(block);
                const statusBadge = block.querySelector('.status-badge');
                if (!statusBadge) return;
                statusBadge.style.backgroundColor = '#e6f4ea';
                statusBadge.style.color = '#1e8e3e';
            }
            const groupedTable = block.querySelector('tbody');
            const rows = groupedTable.querySelectorAll('tr');
            rows.forEach(row => {
                const rowStatus = row.querySelector('.status-badge');
                if (!rowStatus) return;
                if (rowStatus.classList.contains('status-done') || rowStatus.classList.contains('status-warn')) {
                    groupedTable.appendChild(row);
                }
            })
        });
    }

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

        async function executeAuditSubmit(ctrlNo, currentLoc) {
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

                    // 成功提示
                    if (data.is_location_changed) {
                        let warnText = ASSET_AUDIT_I18N.scan_warn.replace('{expected_location}', data.expected_location);
                        resultBox.innerHTML = `<span style="color:#f29900;"><i class="material-icons" style="vertical-align:bottom;">warning</i> **${ctrlNo}** ${data.message}  ${warnText}</span> <button type="button" class="btn-primary" onclick="doPrintAudit('${ctrlNo}');"><i class="material-icons">print</i> ${ASSET_AUDIT_I18N.reprint}</button>`;
                    } else {
                        resultBox.innerHTML = `<span style="color:#1e8e3e;"><i class="material-icons" style="vertical-align:bottom;">check_circle</i> **${ctrlNo}** ${data.message}</span> <button type="button" class="btn-primary" onclick="doPrintAudit('${ctrlNo}');"><i class="material-icons">print</i>${ASSET_AUDIT_I18N.reprint}</button>`;
                    }

                    doneAudio.currentTime = 0;
                    doneAudio.play().catch(error => {console.log("Loading sound fail")});
                } else {
                    // 失败警告
                    resultBox.innerHTML = `<span style="color:#d93025;"><i class="material-icons" style="vertical-align:bottom;">error</i> ❌ ${data.message}</span>`;
                    alertAudio.currentTime = 0;
                    alertAudio.play().catch(error => {console.log("Loading sound fail")});
                }
            } catch (err) {
                resultBox.innerHTML = `<span style="color:#d93025;">${ASSET_AUDIT_I18N.net_error}</span>`;
                alertAudio.currentTime = 0;
                alertAudio.play().catch(error => {console.log("Loading sound fail")});
            }

            // 扫完清空条码，光标锁定，等待下一台
            barcodeInput.value = '';
            barcodeInput.focus();
        }

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

                let targetRow = document.getElementById(`row-${ctrlNo}`);
                if (targetRow) {
                    let statusBadge = targetRow.querySelector('.cell-status');
                    let isMiss = statusBadge.classList.contains('status-miss');
                    if (!isMiss) {
                        // 如果不是缺失状态，说明已经扫过一次了，获取上次记录的位置
                        let previousActualLoc = targetRow.querySelector('.cell-actual-loc').innerText.trim();
                        openRepeatedConfirmModal(ctrlNo, previousActualLoc, currentLoc);
                        return;
                    }
                }
                await executeAuditSubmit(ctrlNo, currentLoc);
            }
        });

        // 重复扫码确认模态框，确认时可以唤出地图
        window.openRepeatedConfirmModal = function(ctrlNo, previousLoc, currentLoc) {
            const modal = document.getElementById('repeatedConfirmModal');
            const text = document.getElementById('repeatedConfirmText');
            const submitBtn = document.getElementById('repeatedSubmitBtn');
            const cancelBtn = document.getElementById('repeatedCancelBtn');
                        
            let safePrev = "";
            if (previousLoc && previousLoc !== '-' && previousLoc.toLowerCase() !== 'none') {
                if (previousLoc.includes('-')) {
                    safePrev = previousLoc.split('-')[0].toUpperCase();
                } else {
                    safePrev = previousLoc;
                }
                safePrev = safePrev.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            }
            let safeCurr = "";
            if (currentLoc && currentLoc !== '-' && currentLoc.toLowerCase() !== 'none') {
                if (currentLoc.includes('-')) {
                    safeCurr = currentLoc.split('-')[0].toUpperCase();
                } else {
                    safeCurr = currentLoc;
                }
                safeCurr = safeCurr.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            }

            // text.innerHTML = `上次确认的位置为 <strong>${previousLoc}</strong><br>当前扫描位置为 <strong>${currentLoc}</strong><br>是否覆盖？`;
            let prevHtml = `<span style="cursor:pointer; color:var(--primary); font-weight:500; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;" onclick="window.openFooterMap('${safePrev}')"><i class="material-icons" style="font-size:1.1rem">place</i>${previousLoc}</span>`;
            let currHtml = `<span style="cursor:pointer; color:var(--primary); font-weight:500; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;" onclick="window.openFooterMap('${safeCurr}')"><i class="material-icons" style="font-size:1.1rem">place</i>${currentLoc}</span>`;

            text.innerHTML = ASSET_AUDIT_I18N.repeated_text.replace('{previousLoc}', prevHtml).replace('{currentLoc}', currHtml);
            modal.style.display = 'flex';
            cancelBtn.focus();
            noticeAudio.currentTime = 0;
            noticeAudio.play().catch(error => {console.log("Loading sound fail")});
            submitBtn.onclick = async function() {
                closeRepeatedConfirmModal();
                await executeAuditSubmit(ctrlNo, currentLoc);
            }
        }

        const cancelBtn = document.getElementById('repeatedCancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                }
            });
        }

        const submitBtn = document.getElementById('repeatedSubmitBtn');
        if (submitBtn) {
            submitBtn.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                }
            });
        }

        window.closeRepeatedConfirmModal = function() {
            document.getElementById('repeatedConfirmModal').style.display = 'none';
            barcodeInput.value = '';
            barcodeInput.focus();
        }
    }

    window.doPrintAudit = async function(ctrlNo) {
        let formData = new FormData();
        formData.append('right_barcode', ctrlNo);

        try {

            let res = await fetch('/api/trigger_print', { method: 'POST', body: formData });
            let data = await res.json();

            if (data.status === 'success') {
                showToast(data.message, 'success');
                barcodeInput.focus();

            } else {
                alert(ASSET_AUDIT_I18N.alert_print_fail);
                barcodeInput.focus();
            }
            // let pingRes = await fetch('/api/printer_status');
            // let pingData = await pingRes.json();
            // if (data.status === 'online') {
            //     let res = await fetch('/api/trigger_print', { method: 'POST', body: formData });
            //     let data = await res.json();
            //     if (data.status === 'success') {
            //         alert(ASSET_AUDIT_I18N.alert_print_success);
            //     }
            // } else {
            //     alert(ASSET_AUDIT_I18N.alert_print_fail);
            // }

            // let dot = document.getElementById('printerDot');
            // if (!dot) return;
            // let status = dot.style.color;
            // if (status === 'rgb(29, 185, 84)') {
            //     let res = await fetch('/api/trigger_print', { method: 'POST', body: formData });
            //     let data = await res.json();
            //     if (data.status === 'success') {
            //         alert(ASSET_AUDIT_I18N.alert_print_success);
            //     }
            // } else {
            //     alert(ASSET_AUDIT_I18N.alert_print_fail);
            // }

        } catch (e) {
            alert(ASSET_AUDIT_I18N.alert_print_fail);
            barcodeInput.focus();
        }
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

// 弹出地图
document.querySelectorAll('.location-header h3').forEach(h3 => {
    h3.addEventListener('click', function(e) {
        if (e.target.classList.contains('collapse-icon')) return;
        e.stopPropagation();
        
        let block = this.closest('.location-block');
        let rawLoc = block ? block.getAttribute('data-loc') : '';
        let safeLoc = rawLoc.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        let rackName = "";
        if (rawLoc && rawLoc !== '-' && rawLoc.toLowerCase() !== 'none' && rawLoc !== 'unallocated') {
            if (rawLoc.includes('-')) {
                rackName = rawLoc.split('-')[0].toUpperCase();
            } else {
                rackName = rawLoc.toUpperCase();
            }
            rackName = rackName.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            if (window.openFooterMap) window.openFooterMap(rackName);
        }
    });
});
