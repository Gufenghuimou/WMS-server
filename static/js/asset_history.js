// ==========================================
// 🌟 历史记录专用：性能优化版全局搜索 (防抖 + DOM 缓存)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. 页面加载时，缓存所有数据行的文字
    // 资产搜索通常需要搜：Ctrl No, PN, 品名, 库位，直接将整行文字缓存
    const searchInput = document.getElementById('globalSearch');
    const logFilterButton = document.getElementById('logFilter');
    const rows = document.querySelectorAll('#historyTable tbody tr');
    rows.forEach(row => {
        row._cachedSearchText = row.innerText.toLowerCase();
        row._isScrapOrCorrection = row.querySelector('.color-scrap, .color-correction') !== null; // 检查是否为报废或更正记录
    });

    let searchTimeout; // 防抖计时器
    let isFilterActive = true;

    function applyFilters() {
        let term = searchInput ? searchInput.value.toLowerCase().trim() : "";
        rows.forEach(row => {
            let matchSearch = (term === "") || row._cachedSearchText.includes(term);
            let matchToggle = isFilterActive ? !row._isScrapOrCorrection : true;
            row.style.display = (matchSearch && matchToggle) ? '' : 'none';
        });
    }
    applyFilters(); // 页面加载时应用初始过滤

    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            // 2. 防抖机制
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(applyFilters, 250); // 250ms 防抖时间
        });
    }

    if (logFilterButton) {
        logFilterButton.addEventListener('click', () => {
            isFilterActive = !isFilterActive; // 切换状态
            if (isFilterActive) {
                logFilterButton.classList.remove('active');
                logFilterButton.innerHTML = `<i class="material-icons" style="font-size: 1.2rem;">filter</i> 查看全部`;
            } else {
                logFilterButton.classList.add('active');
                logFilterButton.innerHTML = `<i class="material-icons" style="font-size: 1.2rem;">filter_none</i> 查看全部`;
            }
            applyFilters(); // 立即应用过滤
        });
    }
});
