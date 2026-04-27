document.addEventListener('DOMContentLoaded', () => {
    // 获取 base.html 中的全局搜索框
    const globalSearch = document.getElementById('globalSearch');

    if (globalSearch) {
        // 动态修改 placeholder 以适应当前页面，使用 I18N 变量
        globalSearch.placeholder = LOG_I18N.search_ph;

        // 🌟 纯前端极速搜索过滤
        globalSearch.addEventListener('input', function(e) {
            let term = e.target.value.toLowerCase().trim();
            let rows = document.querySelectorAll('#reqTable tbody tr');

            rows.forEach(row => {
                // 将整行的文本拼起来转小写，判断是否包含搜索词
                let rowText = row.innerText.toLowerCase();
                if (rowText.includes(term)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }
});