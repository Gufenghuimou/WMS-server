// 表格排序 无搜索冲突

let sortDirection = {};

window.sortTable = function(columnIndex, dataType) {
    const table = document.getElementById("advancedTable");
    const tbody = table.querySelector("tbody");
    const mainRows = Array.from(tbody.querySelectorAll(".main-row"));

    const isAscending = sortDirection[columnIndex] !== 'asc';
    sortDirection[columnIndex] = isAscending ? 'asc' : 'desc';

    // 刷新表头的UI
    document.querySelectorAll('.sort-icon').forEach(icon => icon.innerText = 'unfold_more');
    const currentIcon = table.querySelectorAll('th')[columnIndex].querySelector('.sort-icon');
    if (currentIcon) currentIcon.innerText = isAscending ? 'expand_less' : 'expand_more';

    mainRows.sort((a, b) => {
        let valA = a.children[columnIndex].getAttribute('data-sort') || a.children[columnIndex].textContent.trim();
        let valB = b.children[columnIndex].getAttribute('data-sort') || b.children[columnIndex].textContent.trim();

        if (dataType === 'number') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
            return isAscending ? (valA - valB) : (valB - valA);
        } else {
            return isAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
    });

    mainRows.forEach(mainRow => {
        tbody.appendChild(mainRow);
    });
}

// 全局搜索

// document.addEventListener('DOMContentLoaded', () => {
//     const tBody = document.querySelector('#advancedTable tbody');
//     if (!tBody) return;
//     const mainRows = tBody.querySelectorAll('.main-row');
//     console.log(mainRows);
//     mainRows.forEach(mainRow => {
//         mainRow._cachedSearchText = mainRow.textContent.toLowerCase();
//     });

//     const globalSearch = document.getElementById('globalSearch');
//     let searchTimeout;

//     if (globalSearch) {
//         globalSearch.addEventListener('input', function(e) {
//             let term = e.target.value.toLowerCase().trim();

//             clearTimeout(searchTimeout);
//             searchTimeout = setTimeout(() => {
//                 mainRows.forEach(mainRow => {
//                     let rowText = mainRow._cachedSearchText || "";
//                     let isMatch = rowText.includes(term);
//                     mainRow.style.display = isMatch ? '' : 'none';
//                 });
//             }, 250);
//         });
//     }
// });

document.addEventListener('DOMContentLoaded', () => {
    const globalSearch = document.getElementById('globalSearch');
    let searchTimeout;
    if (globalSearch) {
        globalSearch.addEventListener('input', function(e) {
            let term = e.target.value.toLowerCase().trim();
            clearTimeout(searchTimeout);

            searchTimeout = setTimeout(() => {
                if (term === '') {
                    renderSimcard(window.SIMCARD_DATA);
                    return;
                }

                let filterData = window.SIMCARD_DATA.filter(item => {
                    let searchKey = `${item.icc_id || ''} ${item.carrier || ''} ${item.phone_number || ''} ${item.location || ''} ${item.direct_user || ''} ${item.project || ''} ${item.note || ''}`.toLowerCase();
                    return searchKey.includes(term);
                });

                renderSimcard(filterData);
            }, 300);
        });
    }
});

// AJAX

document.addEventListener('submit', async function(e){
    const form = e.target;
    if (form.id !== 'simcardToggleForm' && form.id !== 'simcardEditForm' && form.id !== 'activeToggleForm') return;
    e.preventDefault();

    try {
        let formData = new FormData(form);
        let response = await fetch(form.action, {
            method: 'POST',
            body: formData
        });

        let result = await response.json();
        if (result.status === 'success') {
            showToast(result.message, 'success');
            if (form.id === 'simcardToggleForm' && window.closeSimcardToggleModal) window.closeSimcardToggleModal();
            if (form.id === 'simcardEditForm' && window.closeSimcardEditModal) window.closeSimcardEditModal();
            if (form.id === 'activeToggleForm' && window.closeActiveToggleModal) window.closeActiveToggleModal();
            if (window.closeActionModal) window.closeActionModal();
            // closeSimcardToggleModal();
            // closeSimcardEditModal();
            // closeActiveToggleModal();

            updateTableRow(result.data)
        }
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
    }
});

function updateTableRow(data) {
    if (!data || !data.id) return;
    let index = window.SIMCARD_DATA.findIndex(i => i.id === data.id);
    if (index !== -1) {
        window.SIMCARD_DATA[index] = {...window.SIMCARD_DATA[index], ...data};
    }
    renderSimcard(window.SIMCARD_DATA);

    setTimeout(() => {
        let row = document.getElementById(`row-${data.id}`);
        if (row) {
            row.style.transition = "background-color 0.5s ease";
            row.style.backgroundColor = '#d4edda';
            setTimeout(() => row.style.backgroundColor = "", 800)
        }
    }, 50);
}

// 从后端捞取数据
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/simcard');
        const result = await response.json();

        if (result.status === 'success') {
            window.SIMCARD_DATA = result.data;
            renderSimcard(result.data);
            
            // 修改左下指示灯
            const indicator = document.getElementById('indicator');
            const indicatorData = result.data;
            console.log(indicatorData);
            indicator.innerHTML = `
                <i class="material-icons" style="font-size: 1.45rem; color: var(--primary-green);">sim_card</i>
                ${BASE_I18N.asset_2}:
                <span style="font-size: 1.2rem; font-weight: bold; color: var(--primary-green); margin-left: 4px;">
                    ${indicatorData.length || '-'}
                </span>
            `;
        }
    } catch (error) {
        console.error("Data Loaded Fail", error);
        document.querySelector('.table-header').innerHTML = `<div style="text-align:center; color:red;">加载失败，请刷新重试</div>`;
    } finally {
        if (typeof window.hideGlobalLoader === 'function') {
            setTimeout(window.hideGlobalLoader, 50);
        }
    }
});

function renderSimcard(data) {
    const tBody = document.getElementById('simcardTbody');
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

    const rowsHtml = data.map(item => {
        let statusHtml = item.is_active ? (item.is_stock ? `<span class="status-badge-stock">在库</span>` : `<span class="status-badge-out">已借出</span>`) : `<span class="status-badge-stop">停用</span>`;
        let betterIcc;
        if (item.icc_id && item.icc_id.length > 5) {
            betterIcc = item.icc_id.slice(0, -5) + ' ' + item.icc_id.slice(-5);
        } else {
            betterIcc = item.icc_id;
        }

        let btnGroupHtml = `
            <button type="button" class="btn-primary" 
                style="background-color: #f0f2f5; color: #555; box-shadow: none; border: 1px solid #ddd; height: 28px; padding: 0 5px; border-radius: 6px; font-size: 0.75rem;" 
                onclick="openSimcardActionModal(${item.id})">
            <i class="material-icons">more_horiz</i>
        </button>
        `;

        return `
            <tr class="main-row" data-id="${item.id}" id="row-${item.id}">
                <td style="display: flex; gap: 10px; justify-content: center; white-space: nowrap;">${btnGroupHtml}</td>
                <td class="font-monospace icc-id">${betterIcc}</td>
                <td>${item.carrier}</td>
                <td class='font-monospace phone_number'>${item.phone_number}</td>
                <td style="cursor: pointer; color: var(--primary); font-weight: 500; white-space: nowrap;" onclick="openFooterMap('${item.location}')">
                    <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.95rem;">
                        <i class="material-icons" style="font-size: 1rem;">place</i>
                        ${item.location}
                    </span>
                </td>
                <td>${ item.direct_user }</td>
                <td>${ item.project }</td>
                <td>${ statusHtml }</td>
                <td>${ item.note }</td>
            </tr>
        `;
    }).join('');

    tBody.innerHTML = rowsHtml;
    updateSimcardStates(data);
}

function updateSimcardStates(items) {
    let total = items.length;
    let using = 0;
    let stopped = 0;

    items.forEach(item => {
        if (!item.is_active) stopped++;
        else if (!item.is_stock) using++;
    });
    let usable = total - using - stopped;
    let usableWidth = (usable / total) * 100
    let stoppedWidth = (stopped / total) * 100
    let usingWidth = (using / total) * 100

    document.querySelector('h2').innerHTML = `${total}`;
    document.getElementById('simcardChart').innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: bold; margin-bottom: 5px; line-height: 1; width: 100%;">
            <span style="color: #1db954; width: ${usableWidth}%; min-width: 40px; text-align: left;">${SIMCARD_I18N.simcard_usable}: ${usable}</span>
            <span style="color: #95a5a6; width: ${stoppedWidth}%; min-width: 40px; text-align: center;">${SIMCARD_I18N.simcard_stopped}: ${stopped}</span>
            <span style="color: #e74c3c; width: ${usingWidth}%; min-width: 40px; text-align: right;">${SIMCARD_I18N.simcard_using}: ${using}</span>
        </div>
        <div style="width: 100%; height: 6px; background: #ecf0f1; border-radius: 4px; display: flex; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);">
            <div style="width: ${usableWidth}%; background: rgba(29, 185, 84, 0.5); transition: 0.3s;" title="${SIMCARD_I18N.simcard_usable}: ${usable}"></div>
            <div style="width: ${stoppedWidth}%; background: #95a5a6; transition: 0.3s;" title="${SIMCARD_I18N.simcard_stopped}: ${stopped}"></div>
            <div style="width: ${usingWidth}%; background: rgba(231, 76, 60, 0.5); transition: 0.3s;" title="${SIMCARD_I18N.simcard_using}: ${using}"></div>
        </div>
    `;
}