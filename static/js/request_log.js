// Tab Switching Engine
window.switchLogTab = function(tabName, el) {
    document.querySelectorAll('.log-tab').forEach(tab => {
        tab.classList.remove('active');
        tab.classList.add('inactive');
    });

    el.classList.remove('inactive');
    el.classList.add('active');

    document.getElementById('tab-consumable').style.display = tabName === 'consumable' ? 'block' : 'none';
    document.getElementById('tab-asset').style.display = tabName === 'asset' ? 'block' : 'none';
};

// Global Search Engine
document.addEventListener('DOMContentLoaded', () => {
    const globalSearch = document.getElementById('globalSearch');
    let searchTimeout;

    if (globalSearch) {
        globalSearch.addEventListener('input', function(e) {
            let term = e.target.value.toLowerCase().trim();
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (term === '') {
                    renderInvReqLog(window.INV_REQ_LOG);
                    renderAssetReqLog(window.ASSET_REQ_LOG);
                    return;
                }

                let filterDataInv = window.INV_REQ_LOG.filter(log => {
                    let searchKey = `${log.created_at || ''} ${log.pn_1 || ''} ${log.name || ''} ${log.applicant || ''} ${log.department || ''} ${log.note || ''}`.toLowerCase();
                    return searchKey.includes(term);
                });
                renderInvReqLog(filterDataInv);
                let invCurrentTr = document.querySelectorAll('#reqTable tbody tr');
                const switchTabConsumable = document.getElementById('switchTabConsumable');
                const switchTabAsset = document.getElementById('switchTabAsset');
                if (invCurrentTr.length === 0) {
                    window.switchLogTab('asset', switchTabAsset);
                }

                let filterDataAsset = window.ASSET_REQ_LOG.filter(log => {
                    let searchKey = `${log.created_at || ''} ${log.pn_1 || ''} ${log.ctrl_no || ''} ${log.name || ''} ${log.applicant || ''} ${log.department || ''} ${log.note || ''}`.toLowerCase();
                    return searchKey.includes(term);
                });
                renderAssetReqLog(filterDataAsset);
                let assetCurrentTr = document.querySelectorAll('#assetTable tbody tr');
                if (assetCurrentTr.length === 0) {
                    window.switchLogTab('consumable', switchTabConsumable);
                }
            }, 300);
        });
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/request_log');
        const result = await response.json();
        if (result.status === 'success') {
            const logData = result.data;
            window.INV_REQ_LOG = logData.inv_req_log;
            window.ASSET_REQ_LOG = logData.asset_req_log;
            renderInvReqLog(logData.inv_req_log);
            renderAssetReqLog(logData.asset_req_log);

            // 初始化页面标签
            const tabsContainer = document.querySelector('.log-tabs-container');
            tabsContainer.innerHTML = `
                <div class="log-tab active" id="switchTabConsumable" onclick="switchLogTab('consumable', this)">
                    <h3><i class="material-icons">inventory_2</i> ${LOG_I18N.consumables}</h3>
                    <span class="count-badge">${logData.inv_req_log.length}</span>
                </div>
                <div class="log-tab inactive" id="switchTabAsset" onclick="switchLogTab('asset', this)">
                    <h3><i class="material-icons">devices</i> ${LOG_I18N.assets}</h3>
                    <span class="count-badge">${logData.asset_req_log.length}</span>
                </div>
            `;

            // 修改指示灯
            const indicator = document.getElementById('indicator');
            const indicatorData = parseInt(logData.processed_inv) + parseInt(logData.processed_asset);
            indicator.innerHTML = `
                <i class="material-icons" style="font-size: 1.45rem; color: var(--primary-green);">done_all</i>
                ${LOG_I18N.request_log}:
                <span style="font-size: 1.2rem; font-weight: bold; color: var(--primary-green); margin-left: 4px;">
                    ${indicatorData || 0}
                </span>
            `;
        }
    } catch (error) {
        console.error("Data Loaded Fail", error);
        document.querySelector('.log-container').innerHTML = `<div style="text-align:center; color:red;">加载失败，请刷新重试</div>`;
    } finally {
        if (typeof window.hideGlobalLoader === 'function') {
            setTimeout(window.hideGlobalLoader, 50);
        }
    }
});

function renderInvReqLog(data) {
    const tabConsumable = document.getElementById('tab-consumable');
    if (!tabConsumable) return;
    if (!data | data.length === 0) {
        tabConsumable.innerHTML = `
            <div style="text-align: center; padding: 60px 0; color: #bdc3c7; background: var(--surface); height: 100%;">
                <i class="material-icons" style="font-size: 4rem; opacity: 0.5;">inbox</i>
                <h3 style="margin-top: 15px; font-weight: normal;">${LOG_I18N.empty}</h3>
            </div>
        `;
        return;
    }
    
    const tHeadInv = `
        <tr>
            <th style="width: 150px;">${LOG_I18N.th_time}</th>
            <th>${LOG_I18N.th_pn1}</th>
            <th style="min-width: 150px;">${LOG_I18N.th_name}</th>
            <th style="text-align: center;">${LOG_I18N.th_qty}</th>
            <th>${LOG_I18N.th_dept}</th>
            ${window.USER_ROLE.includes('admin') ? `<th>${LOG_I18N.th_applicant}</th>` : ''}
            <th>${LOG_I18N.th_note}</th>
            <th style="text-align: center;">${LOG_I18N.th_status}</th>
        </tr>
    `;
    const tBodyInv = data.map(log => {
        let logStatus = `<span class="status-badge" style="background:#eee; color:#666;">${log.status}</span>`;
        if (log.status === 'Pending') {
            logStatus = `<span class="status-badge status-pending"><i class="material-icons" style="font-size: 0.9rem;">schedule</i> ${LOG_I18N.status_pending}</span>`;
        } else if (log.status === 'Approved') {
            logStatus = `<span class="status-badge status-approved"><i class="material-icons" style="font-size: 0.9rem;">check_circle</i> ${LOG_I18N.status_approved}</span>`;
        } else if (log.status === 'Rejected') {
            logStatus = `<span class="status-badge status-rejected"><i class="material-icons" style="font-size: 0.9rem;">cancel</i> ${LOG_I18N.status_rejected}</span>`;
        }
        return `
            <tr>
                <td style="color: #7f8c8d; font-size: 0.85rem;">${log.created_at}</td>
                <td style="font-weight: bold; color: var(--primary-blue);">${log.pn_1}</td>
                <td>${log.item_name || '-'}</td>
                <td style="text-align: center; font-size: 1.1rem; font-weight: bold;">${log.req_qty}</td>
                <td><span style="background: #f0f2f5; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem;">${log.department}</span></td>
                ${window.USER_ROLE.includes('admin') ? `<td style="color: #34495e; font-weight: 500;">${log.applicant}</td>` : ''}
                <td style="color: #7f8c8d; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${log.note}">${log.note || '-'}</td>
                <td style="text-align: center;">${logStatus}</td>
            </tr>
        `;
    }).join('');
    tabConsumable.innerHTML = `
        <table class="req-table" id="reqTable">
            <thead>${tHeadInv}</thead>
            <tbody>${tBodyInv}</tbody>
        </table>
    `;
}

function renderAssetReqLog(data) {
    const tabAsset = document.getElementById('tab-asset');
    if (!tabAsset) return;
    if (!data || data.length === 0) {
        tabAsset.innerHTML = `
            <div style="text-align: center; padding: 60px 0; color: #bdc3c7; background: var(--surface); height: 100%;">
                <i class="material-icons" style="font-size: 4rem; opacity: 0.5;">inbox</i>
                <h3 style="margin-top: 15px; font-weight: normal;">No Asset Requests Found</h3>
            </div>
        `;
        return;
    }

    const tHeadAsset = `
        <tr>
            <th style="width: 150px;">${LOG_I18N.th_time}</th>
            <th>Type</th>
            <th>PN / SN</th>
            <th style="min-width: 150px;">${LOG_I18N.th_name}</th>
            <th style="text-align: center;">${LOG_I18N.th_qty}</th>
            <th>${LOG_I18N.th_dept}</th>
            ${window.USER_ROLE.includes('admin') ? `<th>${LOG_I18N.th_applicant}</th>` : ''}
            <th>${LOG_I18N.th_note}</th>
            <th style="text-align: center;">${LOG_I18N.th_status}</th>
        </tr>
    `;
    const tBodyAsset = data.map(log => {
        let logMatter = `<span class="asset-badge badge-broken"><i class="material-icons" style="font-size:14px;">build</i> Broken</span>`;
        if (log.matter === 'require') {
            logMatter = `<span class="asset-badge badge-require"><i class="material-icons" style="font-size:14px;">add_shopping_cart</i> Require</span>`;
        } else if (log.matter === 'return') {
            logMatter = `<span class="asset-badge badge-return"><i class="material-icons" style="font-size:14px;">assignment_return</i> Return</span>`;
        }
        let logStatus = `<span class="status-badge" style="background:#eee; color:#666;">${log.status}</span>`;
        if (log.status === 'Pending') {
            logStatus = `<span class="status-badge status-pending"><i class="material-icons" style="font-size: 0.9rem;">schedule</i> ${LOG_I18N.status_pending}</span>`;
        } else if (log.status === 'Approved') {
            logStatus = `<span class="status-badge status-approved"><i class="material-icons" style="font-size: 0.9rem;">check_circle</i> ${LOG_I18N.status_approved}</span>`;
        } else if (log.status === 'Rejected') {
            logStatus = `<span class="status-badge status-rejected"><i class="material-icons" style="font-size: 0.9rem;">cancel</i> ${LOG_I18N.status_rejected}</span>`;
        }
        return `
            <tr>
                <td style="color: #7f8c8d; font-size: 0.85rem;">${log.created_at}</td>
                <td>${logMatter}</td>
                <td>
                    <span style="font-weight: bold; color: var(--primary-blue);">${log.pn_1}</span>
                    ${log.ctrl_no ? `<br><span style="font-size: 0.8rem; font-family: monospace; color: #7f8c8d; background: #eee; padding: 2px 4px; border-radius: 4px;">${log.ctrl_no}</span>` : ''}
                </td>
                <td>${log.asset_name || '-'}</td>
                <td style="text-align: center; font-size: 1.1rem; font-weight: bold;">${log.req_qty}</td>
                <td><span style="background: #f0f2f5; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem;">${log.department}</span></td>
                ${window.USER_ROLE.includes('admin') ? `<td style="color: #34495e; font-weight: 500;">${log.applicant}</td>` : ''}
                <td style="color: #7f8c8d; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${log.note}">${log.note || '-'}</td>
                <td style="text-align: center;">${logStatus}</td>
            </tr>
        `;
    }).join('');
    tabAsset.innerHTML = `
        <table class="req-table" id="assetTable">
            <thead>${tHeadAsset}</thead>
            <tbody>${tBodyAsset}</tbody>
        </table>
    `;
}