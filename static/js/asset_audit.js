(() => {
    const alertAudio = new Audio('../static/sound/alert.mp3');
    const doneAudio = new Audio('../static/sound/done.mp3');
    const noticeAudio = new Audio('../static/sound/notice.mp3');

    // 后端数据捞取
    window.initAssetAuditPage = async function () {
        const topActionsContainer = document.querySelector('.top-actions');
        const pageActions = document.getElementById('page-top-actions');
        if (pageActions) {
            topActionsContainer.innerHTML = pageActions.innerHTML;
            pageActions.remove();
        }

        try {
            const response = await fetch('/api/get_asset_audit');
            const result = await response.json();

            if (result.status === 'success') {
                const aduitData = result.data;
                window.ASSET_AUDIT_DATA = aduitData.grouped;
                window.auditedLocations = aduitData.audited_locations;

                renderAssetAudit(aduitData.grouped);

                // 修改左下指示灯
                const indicator = document.getElementById('indicator');
                const indicatorData = aduitData.stats;
                indicator.innerHTML = `
                    <i class="material-icons" style="font-size: 1.45rem; color: var(--primary-green);">barcode_reader</i>
                    ${t('status.asset_audit')}:
                    <span style="font-size: 1.2rem; font-weight: bold; color: var(--primary-green); margin-left: 4px;">
                        ${ indicatorData.progress || 0 }% (${indicatorData.completed || 0}/${indicatorData.total || 0})
                    </span>
                `;

                bindAssetAuditEvent();
            }
        } catch (error) {
            console.error("Data Loaded Fail", error);
            document.querySelector('tbody').innerHTML = `<div style="text-align:center; color:red;">加载失败，请刷新重试</div>`;
        }
    };

    function renderAssetAudit(data) {
        const auditList = document.getElementById('auditContainer');
        if (!auditList) return;

        if (!data || Object.keys(data).length === 0) {
            auditList.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align:center; padding: 40px 20px; color: #999;">
                        <i class="material-icons" style="font-size: 3rem; opacity: 0.5;">inbox</i>
                        <p>暂无数据</p>
                    </td>
                </tr>
            `;
            return;
        }

        const sortedLoc = Object.entries(data).sort((a, b) => {
            const itemsA = a[1];
            const itemsB = b[1];
            let isAllDoneA = itemsA.every(item => item.status && item.status.toLowerCase() !== 'pending');
            let isAllDoneB = itemsB.every(item => item.status && item.status.toLowerCase() !== 'pending');

            if (isAllDoneA && !isAllDoneB) return 1;
            if (!isAllDoneA && isAllDoneB) return -1
            return 0;
        });
        const blockHtml = sortedLoc.map(([loc, items]) => {
            items.sort((a, b) => {
                let isPendingA = !a.status || a.status.toLowerCase() === 'pending';
                let isPendingB = !b.status || b.status.toLowerCase() === 'pending';
                if (isPendingA && !isPendingB) return -1;
                if (!isPendingA && isPendingB) return 1;
                return 0;
            });
            let isAllDone = items.every(item => item.status && item.status.toLowerCase() !== 'pending');
            let collapsedClass = isAllDone ? 'collapsed' : '';
            let allDoneClass = isAllDone ? 'all-done' : '';

            let rowsHtml = items.map(item => {
                let statusBadge = ``;
                if (item.status.toLowerCase() === 'pending') {
                    statusBadge = `<span class="status-badge status-miss cell-status">${t('asset_audit.status_miss')}</span>`;
                } else {
                    if (item.actual_location.toLowerCase() !== item.expected_location.toLowerCase()) {
                        statusBadge = `<span class="status-badge status-warn cell-status">${t('asset_audit.status_warn')}</span>`;
                    } else {
                        statusBadge = `<span class="status-badge status-done cell-status">${t('asset_audit.status_done')}</span>`;
                    }
                }
                return `
                    <tr id="row-${item.ctrl_no}">
                        <td class="font-monospace"><strong style="font-size: 1.15rem;">${item.ctrl_no}</strong></td>
                        <td>${item.pn_1}</td>
                        <td><div style="font-weight: 500;" class="text-truncate">${item.name}</div></td>
                        <td style="color: var(--text-muted);">${item.expected_location || '-'}</td>
                        <td class="cell-actual-loc" style="font-weight: 600; color: var(--primary);">${item.status === 'Completed' ? item.actual_location : '-'}</td>
                        <td style="text-align: center;">${statusBadge}</td>
                        <td class="cell-time" style="text-align: center; color: var(--text-muted);">${item.scanned_at || '-'}</td>
                    </tr>
                `;
            }).join('');

            return `
                <div class="location-block ${collapsedClass}" data-loc="${loc.toLocaleLowerCase() || t('asset_audit.unassigned')}">
                <div class="location-header" onclick="this.parentElement.classList.toggle('collapsed')">
                    <h3>
                        <i class="material-icons collapse-icon">expand_more</i>
                        <i class="material-icons loc-label" style="font-size: 1.2rem;">place</i> ${loc || 'Unallocated'}
                    </h3>
                    <span class="status-badge ${allDoneClass}">${(t('asset_audit.total_devices')).replace('{count}', items.length)}</span>
                </div>

                <table class="audit-table">
                    <thead>
                        <tr>
                            <th style="width: 12%;">${t('asset_audit.th_ctrl_no')}</th>
                            <th style="width: 12%;">${t('asset_audit.th_pn1')}</th>
                            <th style="width: 36%;">${t('asset_audit.th_name')}</th>
                            <th style="width: 10%;">${t('asset_audit.th_expected_loc')}</th>
                            <th style="width: 10%;">${t('asset_audit.th_actual_loc')}</th>
                            <th style="width: 10%; text-align: center;">${t('asset_audit.th_status')}</th>
                            <th style="width: 10%; text-align: center;">${t('asset_audit.th_time')}</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
            `;
        }).join('');

        auditList.innerHTML = blockHtml;

        // 遍历缓存页面
        document.querySelectorAll('.location-block tbody tr').forEach(row => {
            row._cachedSearchText = row.innerText.toLowerCase();
        });
    };

    function bindAssetAuditEvent() {
        const locInput = document.getElementById('scanLocation');
        const barcodeInput = document.getElementById('scanBarcode');
        const resultBox = document.getElementById('scanResult');
        const globalSearch = document.getElementById('globalSearch');
        const auditContainer = document.getElementById('auditContainer');

        if (locInput && barcodeInput && resultBox) {
            // 页面加载后自动对焦到库位输入框
            locInput.focus();

            // 库位框按回车，定位对应群组并跳到扫码框
            locInput.onkeydown = async function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    let locVal = this.value.trim().toLowerCase();

                    if (locVal !== '') {
                        let targetBlock = document.querySelector(`.location-block[data-loc="${locVal}"]`);

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
            };
        }
        
        barcodeInput.onkeydown = async function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();

                let currentLoc = locInput.value.trim();
                let ctrlNo = barcodeInput.value.trim();

                if (!currentLoc) {
                    resultBox.innerHTML = `<span style="color:#d93025;"><i class="material-icons" style="vertical-align:bottom;">error</i> ${t('asset_audit.err_no_loc')}</span>`;
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
        };

        if (globalSearch) {
            let searchTimeout;
            globalSearch.oninput = function(e) {
                let term = e.target.value.toLowerCase().trim();
                clearTimeout(searchTimeout);

                searchTimeout = setTimeout(() => {
                    if (term === "") return;

                    let firstMatch = null;
                    document.querySelectorAll('.location-block').forEach(block => {
                        let locName = (block.getAttribute('data-loc') || "").toLowerCase();
                        let blockMatches = locName.includes(term);
                        let hasVisibleRow = false;

                        block.querySelectorAll('tbody tr').forEach(row => {
                            let rowText = row._cachedSearchText || "";
                            if (rowText.includes(term) || blockMatches) {
                                row.style.display = '';
                                hasVisibleRow = true;
                                if (!firstMatch) firstMatch = row;
                            }
                        });

                        if (hasVisibleRow && blockMatches) {
                            block.classList.remove('collapsed');
                        }
                    });

                    if (firstMatch) {
                        firstMatch.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        void firstMatch.offsetWidth;
                    }
                }, 400);
            }
        }

        if (auditContainer) {
            auditContainer.onclick = function(e) {
                let h3 = e.target.closest('.location-header h3');
                if (!h3) return;
                if (e.target.classList.contains('collapse-icon')) return;
                e.stopPropagation();
                
                let block = h3.closest('.location-block');
                let rawLoc = block ? block.getAttribute('data-loc') : '';
                let safeLoc = rawLoc.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                let rackName = "";
                if (safeLoc && safeLoc !== '-' && safeLoc.toLowerCase() !== 'none' && safeLoc !== 'unallocated') {
                    if (safeLoc.includes('-')) {
                        rackName = safeLoc.split('-')[0].toUpperCase();
                    } else {
                        rackName = safeLoc.toUpperCase();
                    }
                    rackName = rackName.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                    if (window.openFooterMap) window.openFooterMap(rackName);
                }
            };
        }

        const cancelBtn = document.getElementById('repeatedCancelBtn');
        if (cancelBtn) {
            cancelBtn.onkeydown = (e) => { if (e.key === 'Enter') e.preventDefault(); };
        }
        const submitBtn = document.getElementById('repeatedSubmitBtn');
        if (submitBtn) {
            submitBtn.onkeydown = (e) => { if (e.key === 'Enter') e.preventDefault(); };
        }
    }

    window.executeAuditSubmit = async function(ctrlNo, currentLoc) {
        const barcodeInput = document.getElementById('scanBarcode');
        const resultBox = document.getElementById('scanResult');

        let formData = new FormData();
        formData.append("ctrl_no", ctrlNo);
        formData.append("current_location", currentLoc);
            
        try {
            let response = await fetch('/api/asset_audit/scan', { method: 'POST', body: formData });
            let data = await response.json();

            if (data.status === 'success') {
                let targetRow = document.getElementById(`row-${ctrlNo}`);
                if (targetRow) {
                    targetRow.querySelector('.cell-actual-loc').innerText = currentLoc;
                    targetRow._cachedSearchText = targetRow.innerText.toLowerCase();
                    targetRow.querySelector('.cell-time').innerText = new Date().toISOString().split('T')[0];

                    let badge = targetRow.querySelector('.cell-status');
                    badge.className = 'status-badge cell-status ' + (data.is_location_changed ? 'status-warn' : 'status-done');
                    badge.innerText = data.is_location_changed ? t('asset_audit.status_warn') : t('asset_audit.status_done');

                    targetRow.style.backgroundColor = '#e6f4ea';
                    setTimeout(() => targetRow.style.backgroundColor = 'transparent', 1000);
                }

                if (data.is_location_changed) {
                    let warnText = t('asset_audit.scan_warn').replace('{expected_location}', data.expected_location);
                    resultBox.innerHTML = `<span style="color:#f29900;"><i class="material-icons" style="vertical-align:bottom;">warning</i> **${ctrlNo}** ${data.message}  ${warnText}</span> <button type="button" class="btn-primary" onclick="doPrintAudit('${ctrlNo}');"><i class="material-icons">print</i> ${t('asset_audit.reprint')}</button>`;
                } else {
                    resultBox.innerHTML = `<span style="color:#1e8e3e;"><i class="material-icons" style="vertical-align:bottom;">check_circle</i> **${ctrlNo}** ${data.message}</span> <button type="button" class="btn-primary" onclick="doPrintAudit('${ctrlNo}');"><i class="material-icons">print</i>${t('asset_audit.reprint')}</button>`;
                }

                doneAudio.currentTime = 0;
                doneAudio.play().catch(() => console.log("Loading sound fail"));
            } else {
                resultBox.innerHTML = `<span style="color:#d93025;"><i class="material-icons" style="vertical-align:bottom;">error</i> ❌ ${data.message}</span>`;
                alertAudio.currentTime = 0;
                alertAudio.play().catch(() => console.log("Loading sound fail"));
            }
        } catch (err) {
            resultBox.innerHTML = `<span style="color:#d93025;">${t('asset_audit.net_error')}</span>`;
            alertAudio.currentTime = 0;
            alertAudio.play().catch(() => console.log("Loading sound fail"));
        }

        if(barcodeInput) {
            barcodeInput.value = '';
            barcodeInput.focus();
        }
    }

    window.openRepeatedConfirmModal = function(ctrlNo, previousLoc, currentLoc) {
        const modal = document.getElementById('repeatedConfirmModal');
        const text = document.getElementById('repeatedConfirmText');
        const submitBtn = document.getElementById('repeatedSubmitBtn');
        const cancelBtn = document.getElementById('repeatedCancelBtn');
                    
        let safePrev = previousLoc ? previousLoc.split('-')[0].toUpperCase().replace(/'/g, "\\'").replace(/"/g, "&quot;") : '';
        let safeCurr = currentLoc ? currentLoc.split('-')[0].toUpperCase().replace(/'/g, "\\'").replace(/"/g, "&quot;") : '';

        let prevHtml = `<span style="cursor:pointer; color:var(--primary); font-weight:500; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;" onclick="window.openFooterMap('${safePrev}')"><i class="material-icons" style="font-size:1.1rem">place</i>${previousLoc}</span>`;
        let currHtml = `<span style="cursor:pointer; color:var(--primary); font-weight:500; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;" onclick="window.openFooterMap('${safeCurr}')"><i class="material-icons" style="font-size:1.1rem">place</i>${currentLoc}</span>`;

        text.innerHTML = t('asset_audit.repeated_text').replace('{previousLoc}', prevHtml).replace('{currentLoc}', currHtml);
        modal.style.display = 'flex';
        cancelBtn.focus();
        
        noticeAudio.currentTime = 0;
        noticeAudio.play().catch(() => console.log("Loading sound fail"));
        
        submitBtn.onclick = async function() {
            window.closeRepeatedConfirmModal();
            await window.executeAuditSubmit(ctrlNo, currentLoc);
        }
    }

    window.closeRepeatedConfirmModal = function() {
        document.getElementById('repeatedConfirmModal').style.display = 'none';
        const barcodeInput = document.getElementById('scanBarcode');
        if(barcodeInput) {
            barcodeInput.value = '';
            barcodeInput.focus();
        }
    }

    window.doPrintAudit = async function(ctrlNo) {
        let formData = new FormData();
        formData.append('right_barcode', ctrlNo);
        const barcodeInput = document.getElementById('scanBarcode');

        try {
            let res = await fetch('/api/trigger_print', { method: 'POST', body: formData });
            let data = await res.json();
            if (data.status === 'success') {
                showToast(data.message, 'success');
            } else {
                alert(t('asset_audit.alert_print_fail'));
            }
        } catch (e) {
            alert(t('asset_audit.alert_print_fail'));
        }
        if (barcodeInput) barcodeInput.focus();
    }
})();





