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

    if (globalSearch) {
        globalSearch.placeholder = LOG_I18N.search_ph;

        globalSearch.addEventListener('input', function(e) {
            let term = e.target.value.toLowerCase().trim();

            let allRows = document.querySelectorAll('.req-table tbody tr');

            allRows.forEach(row => {
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