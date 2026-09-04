
(() => {

    // 从后端捞取数据
    window.initHistoryPage = async function() {
        const topActionsContainer = document.querySelector('.top-actions');
        const pageActions = document.getElementById('page-top-actions');
        if (pageActions) {
            topActionsContainer.innerHTML = pageActions.innerHTML;
            pageActions.remove();
        }
        
        try {
            const response = await fetch('/api/history');
            const result = await response.json();
            
            if (result.status === 'success') {
                window.HISTORY_DATA = result.data;
                renderHistory(result.data);

                // 修改左下指示灯
                const indicator = document.getElementById('indicator');
                const indicatorData = result.data;
                indicator.innerHTML = `
                    <i class="material-icons" style="font-size: 1.45rem; color: var(--primary-green);">history</i>
                    ${t('status.history')}:
                    <span style="font-size: 1.2rem; font-weight: bold; color: var(--primary-green); margin-left: 4px;">
                        ${indicatorData.length || '-'}
                    </span>
                `;

                const globalSearch = document.getElementById('globalSearch');
                let searchTimeout;
                if (globalSearch) {
                    globalSearch.oninput = function(e) {
                        let term = e.target.value.toLowerCase().trim();
                        clearTimeout(searchTimeout);

                        searchTimeout = setTimeout(() => {
                            if (term === '') {
                                renderHistory(window.HISTORY_DATA);
                                return;
                            }

                            let filterData = window.HISTORY_DATA.filter(log => {
                                let searchKey = `${log.date || ''} ${log.pn_1 || ''} ${log.pn_2 || ''} ${log.name || ''} ${log.applicant || ''} ${log.department || ''} ${log.note || ''}`.toLowerCase();
                                return searchKey.includes(term);
                            }); 
                            renderHistory(filterData);
                        }, 300);
                    }
                }
            }
        } catch (error) {
            console.error("Data Loaded Fail", error);
            document.querySelector('tbody').innerHTML = `<div style="text-align:center; color:red;">加载失败，请刷新重试</div>`;
        }
    };

    function renderHistory(data) {
        const tBody = document.querySelector('tbody');
        if (!tBody) return;
        if (!data || data.length === 0) {
            tBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align:center; padding: 40px 20px; color: #999;">
                        <i class="material-icons" style="font-size: 3rem; opacity: 0.5;">inbox</i>
                        <p>暂无数据</p>
                    </td>
                </tr>
            `;
            return;
        }

        const rowsHtml = data.map(log => {

            let changeClass = 'color-adj';
            let changeText =  `${log.change_qty}`;
            if (log.change_qty > 0) {
                changeClass = 'color-in';
                changeText = `+${log.change_qty}`;
            } else if (log.change_qty < 0) {
                changeClass = 'color-out';
            }


            let logStatus = 'normalLog';
            if (log.note.includes('Undone') || log.note.includes('已撤销')) {
                logStatus = 'undone';
            } else if (log.note.includes('Undo Record') || log.note.includes('撤销记录')) {
                logStatus = 'undoLog';
            } else if (log.note.includes('Imported Log')) {
                logStatus = 'importeLog';
            } else if (log.note.includes('Scrapped')) {
                logStatus = 'scrapLog';
            }

            let noteClass;
            if (logStatus === 'undone') {
                noteClass = 'note-undone';
            } else if (logStatus === 'undoLog') {
                noteClass = 'note-undo-action';
            }


            let undoBtn = ``;
            if (window.CURRENT_USER && window.CURRENT_USER.role.includes('admin') && logStatus === 'normalLog') {
                undoBtn = `<button type="button" class="btn-undo" onclick="window.undoHistoryLog(${log.id}, this)">${t('history.undo')}</button>`;
            } else {
                undoBtn = `<i class="material-icons" style="color: #eee; font-size: 1.2rem;">block</i>`;
            }

            return `
                <tr class="${logStatus === 'undone' ? "tr-undone" : ""}">
                    <td style="font-size: 0.85rem; text-align: center;">${log.date}</td>
                    <td style="text-align: center;"><strong>${log.pn_1}</strong></td>
                    <td style="font-size: 0.85rem; color: var(--text-muted); text-align: center;">${log.pn_2 || '-'}</td>
                    <td style="font-size: 0.85rem; color: var(--text-muted);">${log.name || '-'}</td>
                    <td class="${changeClass}" style="text-align: center;">${changeText}</td>
                    <td style="text-align: center;">${log.applicant || '-'}</td>
                    <td style="text-align: center;">${log.department || '-' }</td>
                    <td class="${noteClass}">${log.note || '-'}</td>
                    <td style="text-align: center;">${undoBtn}</td>
                </tr>
            `;
        }).join('');
        tBody.innerHTML = rowsHtml;
    }

    // Ajax
    window.undoHistoryLog = async function(logId, btnElement) {
        if(!confirm(history.confirm_undo)) return;

        let originalHtml = btnElement.innerHTML;
        btnElement.disabled = true;
        btnElement.innerHTML = `<i class="material-icons" style="animation: spin 1s linear infinite; font-size:1rem;">autorenew</i>`;

        try {
            let response = await fetch(`/undo/${log.id}`, { method: 'POST' });
            let result = await response.json();

            if (result.status === 'success') {
                showToast(result.message, 'success');
                fetch('/api/history').then(res => res.json()).then(res => {
                    window.HISTORY_DATA = res.data;
                    renderHistory(res.data);
                });
            } else {
                showToast(result.message, 'error');
                btnElement.disabled = false;
                btnElement.innerHTML = originalHtml;
            }
        } catch (error) {
            showToast('Loading Fail', 'error');
            btnElement.disabled = false;
            btnElement.innerHTML = originalHtml;
        }
    }
    
})();