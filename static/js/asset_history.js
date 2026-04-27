// ==========================================
// 🌟 历史记录专用：性能优化版全局搜索 (防抖 + DOM 缓存)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. 页面加载时，缓存所有数据行的文字
    // 资产搜索通常需要搜：Ctrl No, PN, 品名, 库位，直接将整行文字缓存
    document.querySelectorAll('tbody tr').forEach(row => {
        row._cachedSearchText = row.innerText.toLowerCase();
    });

    let searchTimeout; // 防抖计时器
    const searchInput = document.getElementById('globalSearch');

    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            let term = e.target.value.toLowerCase().trim();

            // 2. 防抖机制
            clearTimeout(searchTimeout);

            searchTimeout = setTimeout(() => {
                // 优化：如果搜索框为空，直接全部显示
                if (term === "") {
                    document.querySelectorAll('tbody tr').forEach(row => row.style.display = '');
                    return;
                }

                // 执行搜索：直接遍历所有行，基于缓存内容匹配
                document.querySelectorAll('tbody tr').forEach(row => {
                    let rowText = row._cachedSearchText || "";

                    // 包含关键词则显示，否则隐藏
                    if (rowText.includes(term)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            }, 250); // 250ms 防抖时间
        });
    }
});