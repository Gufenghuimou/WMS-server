
(() => {

    // 从后端捞取数据
    window.initSimcardHistoryPage = async function() {
        const topActionsContainer = document.querySelector('.top-actions');
        const pageActions = document.getElementById('page-top-actions');
        if (pageActions) {
            topActionsContainer.innerHTML = pageActions.innerHTML;
            pageActions.remove();
        }

        try {
            const response = await fetch('/api/simcard_history');
            const result = await response.json();

            if (result.status === 'success') {
                window.SIMCARD_LOG_DATA = result.data;
                renderSimcardLog(result.data);

                // 修改左下指示灯
                const indicator = document.getElementById('indicator');
                const indicatorData = result.data;
                indicator.innerHTML = `
                    <i class="material-icons" style="font-size: 1.45rem; color: var(--primary-green);">manage_history</i>
                    ${t('status.asset_history')}:
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
                                renderSimcardLog(window.SIMCARD_LOG_DATA);
                                return;
                            }

                            let filterData = window.SIMCARD_LOG_DATA.filter(log => {
                                let searchKey = `${log.icc_id || ''} ${log.phone_number || ''} ${log.target_loc || ''} ${log.target_user || ''} ${log.target_project || ''} ${log.action || ''}`.toLowerCase();
                                return searchKey.includes(term);
                            });
                            renderSimcardLog(filterData);
                        }, 300);
                    };
                }
            }
        } catch (error) {
            console.error("Data Loaded Fail", error);
            document.querySelector('tbody').innerHTML = `<div style="text-align:center; color:red;">加载失败，请刷新重试</div>`;
        }
    }

    function renderSimcardLog(data) {
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
            let betterIcc;
            if (log.icc_id && log.icc_id.length >5) {
                betterIcc = log.icc_id.slice(0, -5) + ' ' + log.icc_id.slice(-5);
            } else {
                betterIcc = log.icc_id;
            }

            let actionStatus;
            switch (log.action.trim()) {
                case 'OUT':
                    actionStatus = `<span class="color-out">${log.action}</span>`;
                    break;
                case 'RETURN':
                    actionStatus = `<span class="color-return">${log.action}</span>`;
                    break;
                case 'Scrap':
                    actionStatus = `<span class="color-scrap">${log.action}</span>`;
                    break;
                case 'Disable':
                    actionStatus = `<span class="color-disable">${log.action}</span>`;
                    break;
                case 'Enable':
                    actionStatus = `<span class="color-enable">${log.action}</span>`;
                    break;
                case 'Edit':
                    actionStatus = `<span class="color-edit">${log.action}</span>`;
                    break;
                default:
                    actionStatus = `<span class="color-init">${log.action}</span>`;
                    break;
            }
            return `
                <tr class="main-row" data-id="${log.id}" id="row-${log.id}">
                <td>${log.date}</td>
                <td class="font-monospace icc-id">${betterIcc}</td>
                <td class="font-monospace phone_number">${log.phone_number}</td>
                <td>${log.target_loc}</td>
                <td>${log.target_user}</td>
                <td>${log.target_project}</td>
                <td>${actionStatus}</td>
            </tr>
            `;
        }).join('');
        tBody.innerHTML = rowsHtml;
    }
    
})();