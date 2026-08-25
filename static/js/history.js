// document.addEventListener('DOMContentLoaded', () => {
//     // 1. 页面加载时，缓存所有数据行的文字
//     document.querySelectorAll('tbody tr').forEach(row => {
//         row._cachedSearchText = row.innerText.toLowerCase();
//     });

//     const globalSearch = document.getElementById('globalSearch');
//     let searchTimeout; // 防抖计时器

//     if (globalSearch) {
//         globalSearch.addEventListener('input', function(e) {
//             let term = e.target.value.toLowerCase().trim();

//             // 2. 防抖机制
//             clearTimeout(searchTimeout);

//             searchTimeout = setTimeout(() => {
//                 // 优化：如果搜索框空了，直接全部显示
//                 if (term === "") {
//                     document.querySelectorAll('tbody tr').forEach(row => { row.style.display = '' });
//                     return;
//                 }

//                 // 执行搜索：直接遍历所有行，极其纯粹和快速
//                 document.querySelectorAll('tbody tr').forEach(row => {
//                     let rowText = row._cachedSearchText || "";

//                     // 包含关键词就显示，不包含就隐藏
//                     if (rowText.includes(term)) {
//                         row.style.display = '';
//                     } else {
//                         row.style.display = 'none';
//                     }
//                 });
//             }, 250);
//         });
//     }
// });

// 新的全局搜索逻辑
document.addEventListener('DOMContentLoaded', () => {
    const globalSearch = document.getElementById('globalSearch');
    let searchTimeout;
    if (globalSearch) {
        globalSearch.addEventListener('input', function(e) {
            let term = e.target.value.toLowerCase().trim();
            clearTimeout(searchTimeout);

            searchTimeout = setTimeout(() => {
                if (term === '') {
                    renderHistory(window.HISTORY_DATA);
                    return;
                }

                let filterData = window.HISTORY_DATA.filter(log => {
                    let searchKey = `${log.ctrl_no || ''} ${log.pn_1 || ''} ${log.name || ''} ${log.applicant || ''} ${log.department || ''} ${log.note || ''}`.toLowerCase();
                    return searchKey.includes(term);
                }); 
                renderHistory(filterData);
            }, 300);
        })
    }
});

// 从后端捞取数据
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/history');
        const result = await response.json();
        
        window.HISTORY_DATA = result.data;
        renderHistory(result.data);
    } catch (error) {
        console.error("Data Loaded Fail", error);
        document.querySelector('tbody').innerHTML = `<div style="text-align:center; color:red;">加载失败，请刷新重试</div>`;
    } finally {
        if (typeof window.hideGlobalLoader === 'function') {
            setTimeout(window.hideGlobalLoader, 50);
        }
    }
});

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
        if (window.USER_ROLE.includes('admin') && logStatus === 'normalLog') {
            undoBtn = `
                <form action="/undo/${log.id}" method="post" style="margin: 0;" class="undo-form">
                    <button type="submit" class="btn-undo">${HISTORY_I18N.undo}</button>
                </form>
            `;
        } else {
            undoBtn = `
                <i class="material-icons" style="color: #eee; font-size: 1.2rem;">block</i>
            `;
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
document.addEventListener('submit', async function(e) {
    const form = e.target;
    if (!form.classList.contains('undo-form')) return;
    e.preventDefault();
    if(!confirm(HISTORY_I18N.confirm_undo)) return;

    try {
        let response = await fetch(form.action, { method: 'POST' });
        let result = await response.json();

        if (result.status === 'success') {
            showToast(result.message, 'success');
            fetch('/api/history').then(res => res.json()).then(res => {
                window.HISTORY_DATA = res.data;
                renderHistory(res.data);
            });
        } else {
            showToast(result.message, 'error');
        }
    } catch (error) {
        showToast('Loading Fail', 'error');
    }
});