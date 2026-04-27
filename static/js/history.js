// ==========================================
// 🌟 历史记录专用：性能优化版全局搜索 (防抖 + DOM 缓存)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. 页面加载时，缓存所有数据行的文字
    document.querySelectorAll('tbody tr').forEach(row => {
        row._cachedSearchText = row.innerText.toLowerCase();
    });

    const globalSearch = document.getElementById('globalSearch');
    let searchTimeout; // 防抖计时器

    if (globalSearch) {
        globalSearch.addEventListener('input', function(e) {
            let term = e.target.value.toLowerCase().trim();

            // 2. 防抖机制
            clearTimeout(searchTimeout);

            searchTimeout = setTimeout(() => {
                // 优化：如果搜索框空了，直接全部显示
                if (term === "") {
                    document.querySelectorAll('tbody tr').forEach(row => row.style.display = '');
                    return;
                }

                // 执行搜索：直接遍历所有行，极其纯粹和快速
                document.querySelectorAll('tbody tr').forEach(row => {
                    let rowText = row._cachedSearchText || "";

                    // 包含关键词就显示，不包含就隐藏
                    if (rowText.includes(term)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            }, 250); // 250ms 黄金防抖时间
        });
    }
});