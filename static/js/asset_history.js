(() => {

    // 从后端捞取数据
    window.initAssetHistoryPage = async function() {
        const topActionsContainer = document.querySelector('.top-actions');
        const pageActions = document.getElementById('page-top-actions');
        if (pageActions) {
            topActionsContainer.innerHTML = pageActions.innerHTML;
            pageActions.remove();
        }
        
        try {
            const response = await fetch('/api/asset_history');
            const result = await response.json();

            if (result.status === 'success') {
                window.ASSET_HIS_DATA = result.data;
                if (window.triggerHistoryFilter) {
                    window.triggerHistoryFilter();
                } else {
                    renderAssetHis(result.data);
                }

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
                const logFilterBtn = document.getElementById('logFilter');
                let searchTimeout;
                let isFilterActive = true;

                function applyFilter() {
                    if (!window.ASSET_HIS_DATA) return;
                    let term = globalSearch ? globalSearch.value.toLowerCase().trim() : '';

                    let filterData = window.ASSET_HIS_DATA.filter(log => {
                        let logNote = (log.note || '').toLowerCase();
                        let isScrapOrCorrection = logNote.includes('scrap') || logNote.includes('报废') || logNote.includes('correction') || logNote.includes('更正');
                        let matchToggle = isFilterActive ? !isScrapOrCorrection : true;
                        if (term !== '') {
                            let searchKey = `${log.ctrl_no || ''} ${log.pn_1 || ''} ${log.name || ''} ${log.target_loc || ''} ${log.note || ''}`.toLowerCase();
                            return searchKey.includes(term);
                        } else {
                            return matchToggle;
                        }
                    });

                    renderAssetHis(filterData);
                }

                if (globalSearch) {
                    globalSearch.oninput = function(e) {
                        clearTimeout(searchTimeout);
                        searchTimeout = setTimeout(() => { applyFilter(); }, 300);
                    };
                }

                if (logFilterBtn) {
                    logFilterBtn.onclick = function() {
                        isFilterActive = !isFilterActive; // 切换状态
                        if (isFilterActive) {
                            logFilterBtn.classList.remove('active');
                            logFilterBtn.innerHTML = `<i class="material-icons" style="font-size: 1.2rem;">filter</i> 查看全部`;
                        } else {
                            logFilterBtn.classList.add('active');
                            logFilterBtn.innerHTML = `<i class="material-icons" style="font-size: 1.2rem;">filter_none</i> 查看全部`;
                        }
                        applyFilter(); // 立即应用过滤
                    };
                }
                window.triggerHistoryFilter = applyFilter;
            }
        } catch (error) {
            console.error("Data Loaded Fail", error);
            document.querySelector('tbody').innerHTML = `<div style="text-align:center; color:red;">加载失败，请刷新重试</div>`;
        }
    };

    function renderAssetHis(data) {
        const tBody = document.getElementById('assetHistoryTbody');
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
            const logNote = log.note.trim();
            let actionStatus;
            if (logNote.includes('Initial') || logNote.includes('初始')) {
                actionStatus = `<span class="color-init">${t('asset_history.status_init')}</span>`;
            } else if (logNote.includes('Scrap') || logNote.includes('报废')) {
                actionStatus = `<span class="color-scrap">${t('asset_history.status_scrap')}</span>`;
            } else if (logNote.includes('Stopped') || logNote.includes('停用')) {
                actionStatus = `<span class="color-stopped">${t('asset_history.status_stopped')}</span>`;
            } else if (logNote.includes('Enable') || logNote.includes('复用')) {
                actionStatus = `<span class="color-enable">${t('asset_history.status_enable')}</span>`;
            } else if (logNote.includes('Correction')) {
                actionStatus = `<span class="color-correction">${t('asset_history.status_correction')}</span>`;
            } else if (log.status === true) {
                actionStatus = `<span class="color-in">${t('asset_history.status_return')}</span>`;
            } else if (log.status === false) {
                actionStatus = `<span class="color-out">${t('asset_history.status_takeout')}</span>`;
            } else {
                actionStatus = `<span class="color-init">${t('asset_history.status_change')}</span>`;
            }

            let safeLoc;
            if (log.target_loc.trim().includes('-')) {
                safeLoc = log.target_loc.split('-')[0];
            } else {
                safeLoc = log.target_loc.trim();
            }
            return `
                <tr>
                    <td style="font-size: 0.85rem; text-align: center; color: var(--text-muted);">${log.date}</td>
                    <td class="font-monospace" style="text-align: center; font-size: 1.1rem; color: var(--primary); font-weight: bold;">${log.ctrl_no}</td>
                    <td class="font-monospace" style="text-align: center; font-weight: 500; font-size: 1.1rem">${log.pn_1}</td>
                    <td style="text-align: left; font-size: 0.9rem;" title="${log.name}">${log.name || '-'}</td>
                    <td style="text-align: center;">${actionStatus}</td>
                    <td style="text-align: center; font-weight: 500; color: var(--primary); cursor: pointer;" onclick="openFooterMap('${safeLoc}')">
                        ${log.target_loc ? `<i class="material-icons" style="font-size: 1.05rem; vertical-align: middle; color: var(--primary);">place</i> ${log.target_loc}`: `-`}
                    </td>

                    <td style="font-size: 0.85rem; color: #555;" title="${log.note}">${log.note || '-'}</td>
                </tr>
            `;
        }).join('');
        tBody.innerHTML = rowsHtml;
    }
})();