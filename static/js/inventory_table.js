// ==========================================
// 🌟 极速前端表格排序引擎 (搜索无冲突版)
// ==========================================
let sortDirection = {}; // 记录每一列当前的排序方向

window.sortTable = function(columnIndex, dataType) {
    const table = document.getElementById("advancedTable");
    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.querySelectorAll("tr"));

    // 切换排序方向
    const isAscending = sortDirection[columnIndex] !== 'asc';
    sortDirection[columnIndex] = isAscending ? 'asc' : 'desc';

    // 刷新表头的 UI 图标
    document.querySelectorAll('.sort-icon').forEach(icon => icon.innerText = 'unfold_more');
    const currentIcon = table.querySelectorAll('th')[columnIndex].querySelector('.sort-icon');
    if (currentIcon) currentIcon.innerText = isAscending ? 'expand_less' : 'expand_more';

    // 核心排序逻辑
    rows.sort((a, b) => {
        // 💡 核心修复：使用 textContent 替代 innerText，无视搜索造成的 display:none
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

    // 瞬间将排好序的节点重新塞入表格
    tbody.append(...rows);
};

// ==========================================
// 🌟 无感静默保存引擎
// ==========================================
window.autoSave = async function(itemId) {
    const tr = document.getElementById(`row-${itemId}`);
    if (!tr) return;

    const warningVal = tr.querySelector('.warning-input').value;
    const isMvaChecked = tr.querySelector('.mva-checkbox').checked;

    const formData = new FormData();
    formData.append('warning_level', warningVal || 0);
    formData.append('is_mva', isMvaChecked ? 'true' : 'false');

    try {
        // 发送数据到后台
        let response = await fetch(`/api/update_advanced/${itemId}`, {
            method: 'POST',
            body: formData
        });
        let result = await response.json();

        if (result.status === 'success') {
            // 触发一个极短的“绿光闪烁”特效，给用户心理上的“保存成功”确认感
            tr.classList.remove('row-saved');
            void tr.offsetWidth; // 触发重绘
            tr.classList.add('row-saved');
        }
    } catch (err) {
        alert(TABLE_I18N.net_err_save);
    }
};

// ==========================================
// 🌟 性能优化版全局搜索 (精准定位防冲突版)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 💡 优化 1：精确定位到 advancedTable，防止误伤页面内可能存在的其他表格
    const tableBody = document.querySelector('#advancedTable tbody');
    if (!tableBody) return;

    // 一次性获取所有行，提升搜索时的循环性能
    const allRows = tableBody.querySelectorAll('tr');

    // 💡 优化 2：页面加载时，使用 textContent 缓存文字，速度提升 10 倍
    allRows.forEach(row => {
        row._cachedSearchText = row.textContent.toLowerCase();
    });

    const globalSearch = document.getElementById('globalSearch');
    let searchTimeout; // 防抖计时器

    if (globalSearch) {
        globalSearch.addEventListener('input', function(e) {
            let term = e.target.value.toLowerCase().trim();

            clearTimeout(searchTimeout);

            searchTimeout = setTimeout(() => {
                // 执行搜索：基于内存中的 DOM 引用直接操作，极速且不受排序干扰
                allRows.forEach(row => {
                    let rowText = row._cachedSearchText || "";
                    // 包含关键词就显示，不包含就隐藏
                    row.style.display = rowText.includes(term) ? '' : 'none';
                });
            }, 250);
        });
    }
});