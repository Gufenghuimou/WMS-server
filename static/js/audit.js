
// 从后端捞取数据
(() => {

    window.initAuditPage = async function() {
        try {
            const response = await fetch('/api/audit');
            const result = await response.json();
            if (result.status === 'success') {
                const auditData = result.data;
                window.INV_AUDIT_DATA = auditData.grouped;
                renderAudit(auditData.grouped);
                
                // 修改左下指示灯
                const indicator = document.getElementById('indicator');
                const indicatorData = auditData.stats;
                indicator.innerHTML = `
                    <i class="material-icons" style="font-size: 1.45rem; color: var(--primary-green);">fact_check</i>
                    ${t('status.audit')}:
                    <span style="font-size: 1.2rem; font-weight: bold; color: var(--primary-green); margin-left: 4px;">
                        ${ indicatorData.progress || 0 }% (${indicatorData.completed || 0}/${indicatorData.total || 0})
                    </span>
                `;
                bindAuditEvent();
            }
        } catch (error) {
            console.error("Data Loaded Fail", error);
            document.querySelector('tbody').innerHTML = `<div style="text-align:center; color:red;">加载失败，请刷新重试</div>`;
        }
    }

    function renderAudit(data) {
        const auditList = document.querySelector('.audit-list-wrapper');
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

        const blockHtml = Object.entries(data).map(([loc, items]) => {
            let isAllDone = items.every(item => item.status && item.status.toLowerCase() !== 'pending');
            let collapsedClass = isAllDone ? 'collapsed' : '';
            let allDoneClass = isAllDone ? 'all-done' : '';

            let formsHtml = items.map(item => `<form class="audit-form" id="auditForm_${item.id}" action="/audit/submit/${item.id}" method="post"></form>`).join('');

            let rowsHtml = items.map(item => {
                let actualStock = (item.actual_stock !== null && item.actual_stock !== undefined) ? item.actual_stock : item.expected_stock;
                let actualLoc = item.actual_location || item.expected_location || '';
                let status = item.status || t('audit.status_uncounted');
                let statusClass = item.status ? item.status.toLowerCase() : 'pending';
                return `
                    <tr id="row-${item.id}" data-pn1="${(item.pn_1 || '').toLowerCase()}" data-pn2="${(item.pn_2 || '').toLowerCase()}">
                        <td><strong>${item.pn_1}</strong></td>
                        <td class="font-monospace" style="color: #555;">${item.pn_2 || '-'}</td>
                        <td style="font-weight: 500;">${item.name}</td>
                        <td style="text-align: center; background: #fafafa;">${item.expected_stock}</td>
                        <td><input type="number" form="auditForm_${item.id}" name="actual_stock" value="${actualStock}" style="height: 28px;"></td>
                        <td><input type="text" form="auditForm_${item.id}" name="actual_location" value="${actualLoc}" style="height: 28px;"></td>
                        <td><input type="text" form="auditForm_${item.id}" name="remarks" value="${item.remarks || ''}" style="height: 28px;"></td>
                        <td style="text-align: center;">
                            <span id="status-${item.id}" class="status-badge status-${statusClass}">${status}</span>
                        </td>
                        <td style="text-align: center;">
                            <button type="submit" form="auditForm_${item.id}" class="btn-primary" style="border-radius: 12px; background-color: var(--primary-blue); display: flex; align-items: center; justify-content: center; width: 36px; height: 32px; padding: 0;">
                                <i class="material-icons" style="font-size: 1.1rem; margin:0;">save</i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            return `
                <div class="location-block ${collapsedClass}" data-loc="${loc.toLowerCase()}">
                    <div class="location-header" onclick="this.parentElement.classList.toggle('collapsed')">
                        <h3>
                            <i class="material-icons collapse-icon">expand_more</i>
                            <i class="material-icons" style="font-size: 1.2rem;">place</i> ${loc}
                        </h3>
                        <span class="status-badge ${allDoneClass}">${(t('audit.total_items')).replace('{count}', items.length)}</span>
                    </div>

                    ${formsHtml}

                    <table class="audit-table">
                        <thead style="position: sticky; top: 0; background: #f1f5f9; z-index: 10; box-shadow: inset 0 -2px 0 var(--border-color);">
                            <tr>
                                <th style="width: 140px;">${t('audit.th_pn1')}</th>
                                <th style="width: 140px;">PN2</th> <th style="min-width: 250px;">>${t('audit.th_name')}</th>
                                <th style="width: 80px; text-align: center;">>${t('audit.th_book_qty')}}</th>
                                <th style="width: 100px; ">${t('audit.th_actual_qty')}</th>
                                <th style="width: 100px;">${t('audit.th_actual_loc')}</th>
                                <th style="width: 150px;">${t('audit.th_remarks')}</th>
                                <th style="width: 80px; text-align: center;">${t('audit.th_status')}</th>
                                <th style="width: 80px; text-align: center;">${t('audit.th_action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            `;
        }).join('');

        auditList.innerHTML = blockHtml;

        auditList.querySelectorAll('.audit-form').forEach(form => {
            form.onsubmit = handleAuditSubmit;
        });
        // 遍历缓存页面
        document.querySelectorAll('.location-block tbody tr').forEach(row => {
            row._cachedSearchText = row.innerText.toLowerCase();
        });
    }

    function bindAuditEvent() {
        const globalSearch = document.getElementById('globalSearch');
        const scanInput = document.getElementById('scanInput');
        const resultBox = document.getElementById('scanResultBox');

        if (scanInput) {
            scanInput.onkeydown = function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    let term = this.value.trim().toLowerCase();
                    if (!term) return;

                    // 1. 优先级匹配：库位
                    let targetBlock = document.querySelector(`.location-block[data-loc="${term}"]`);
                    let statusText = '';
                    if (targetBlock) {
                        statusText = targetBlock.querySelector('.status-badge').innerText;
                    }

                    if (targetBlock) {
                        document.querySelectorAll('.location-block').forEach(b => b.classList.add('collapsed'));
                        targetBlock.classList.remove('collapsed');

                        requestAnimationFrame(() => {
                            targetBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });

                            let header = targetBlock.querySelector('.location-header');
                            header.classList.remove('highlight-flash');
                            void header.offsetWidth;
                            header.classList.add('highlight-flash');
                        });

                        resultBox.style.background = '#e6f4ea';
                        resultBox.style.borderColor = '#c8e6c9';
                        resultBox.innerHTML = `
                            <div style="font-size: 1.1rem; color: #1e8e3e; display: flex; align-items: center; gap: 8px; font-weight: bold;">
                                <i class="material-icons">place</i> ${term.toUpperCase()}
                            </div>
                            <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal; margin-top: 4px;">
                                ${statusText}
                            </div>
                        `;
                    } else {
                        // 2. 降级匹配：PN
                        let targetRow = document.querySelector(`tr[data-pn1="${term}"]`) || document.querySelector(`tr[data-pn2="${term}"]`);

                        if (targetRow) {
                            let block = targetRow.closest('.location-block');
                            let locName = block ? block.getAttribute('data-loc').toUpperCase() : 'Unknow Location';
                            // 🌟 核心：发现匹配的 PN 时，自动展开它所属的父级 Block
                            if (block) {
                                document.querySelectorAll('.location-block').forEach(b => b.classList.add('collapsed'));
                                block.classList.remove('collapsed');
                            }

                            requestAnimationFrame(() => {
                                targetRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                targetRow.classList.remove('highlight-flash');
                                void targetRow.offsetWidth;
                                targetRow.classList.add('highlight-flash');

                                let qtyInput = targetRow.querySelector('input[name="actual_stock"]');
                                if (qtyInput) {
                                    setTimeout(() => {
                                        qtyInput.focus();
                                        qtyInput.select();
                                    }, 300);
                                }
                            });

                            let matchedName = targetRow.querySelector('tr td:nth-child(3)').textContent;
                            resultBox.style.background = '#e6f4ea';
                            resultBox.style.borderColor = '#c8e6c9';
                            resultBox.innerHTML = `
                                <div style="font-size: 1.1rem; color: #333; font-weight: normal; display: flex; justify-content: flex-start; gap: 25px;">
                                    <span style="font-weight: bold;"><strong style="color:var(--primary-blue);">${locName}&emsp;&gt;&gt;&emsp;${term.toUpperCase()}</strong></span>
                                </div>
                                <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal; margin-top: 4px;">
                                    ${matchedName}
                                </div> 
                            `;
                        } else {
                            // 3. 彻底未找到
                            resultBox.style.background = '#fce8e6';
                            resultBox.style.borderColor = '#fadbd8';
                            resultBox.innerHTML = `
                                <div style="font-size: 1.1rem; color: #d93025; display: flex; align-items: center; gap: 8px; font-weight: bold;">
                                    <i class="material-icons">search_off</i> ${term.toUpperCase()}
                                </div>
                                <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal; margin-top: 4px;">
                                    ${t('audit.scan_desc')}
                                </div> 
                            `;
                        }
                    }
                    this.value = '';
                    this.focus();
                }
            }
        }

        if (globalSearch) {
            let searchTimeout;
            globalSearch.oninput = function(e) {
                let term = e.target.value.toLowerCase().trim();
                clearTimeout(searchTimeout);

                searchTimeout = setTimeout(() => {
                    if (term === "") {
                        document.querySelectorAll('.location-block tbody tr').forEach(row => {
                            row.style.display = '';
                        });
                        return;
                    }

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
    }

    // Ajax
    async function handleAuditSubmit(e) {
        const form = e.target;
        e.preventDefault();
        // 只拦截盘点行的表单
        if (form.classList.contains('audit-form')) {

            let btn = document.querySelector(`button[form="${form.id}"]`);
            let oldHtml = btn.innerHTML;
            btn.innerHTML = '<i class="material-icons" style="animation: spin 1s linear infinite;">autorenew</i>';
            btn.disabled = true;

            try {
                let response = await fetch(form.action, {
                    method: 'POST',
                    body: new FormData(form)
                });
                let result = await response.json();

                if (result.status === 'success') {
                    showToast(result.message, "success");
                    let itemId = result.data.id;
                    let statusBadge = document.getElementById(`status-${itemId}`);
                    let row = document.getElementById(`row-${itemId}`);

                    // 1. 无刷新更新 Badge
                    if (statusBadge) {
                        statusBadge.innerText = result.data.status;
                        statusBadge.className = `status-badge status-${result.data.status.toLowerCase()}`;
                    }

                    // 2. 行变色成功反馈
                    if (row) {
                        row.style.transition = 'background-color 0.4s';
                        row.style.backgroundColor = result.data.status === 'Matched' ? '#e6f4ea' : '#fce8e6';
                        setTimeout(() => {
                            row.style.backgroundColor = '';
                        }, 800);
                    }

                    // 3. 检查当前 block 是否全做完了，做完了就变绿收起
                    let currentBlock = row.closest('.location-block');
                    if (currentBlock) {
                        let allBadges = Array.from(currentBlock.querySelectorAll('.status-badge:not(.location-header .status-badge)'));
                        let isAllDone = allBadges.every(badge => badge.innerText.trim().toLowerCase() !== 'pending');
                        if (isAllDone) {
                            currentBlock.classList.add('collapsed');
                            let headerBadge = currentBlock.querySelector('.location-header .status-badge');
                            if (headerBadge) headerBadge.classList.add('all-done');
                        }
                    }
                    // 3. 焦点交还给扫码框，准备扫下一个
                    let scanInput = document.getElementById('scanInput');
                    if(scanInput) scanInput.focus();

                } else {
                    showToast(result.message, "error");
                    alert(result.message);
                }
            } catch(err) {
                alert("提交时发生网络错误");
            } finally {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
            }
        }
    }

})();