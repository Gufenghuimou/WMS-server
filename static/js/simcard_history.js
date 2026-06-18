document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('tbody tr').forEach(row => {
        row._cachedSearchText = row.innerText.toLowerCase();
    });

    const globalSearch = document.getElementById('globalSearch');
    let searchTimeout;

    if (globalSearch) {
        globalSearch.addEventListener('input', function(e) {
            let term = e.target.value.toLowerCase().trim();

            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (term === "") {
                    document.querySelectorAll('tbody tr').forEach(row => { row.style.display = '' });
                    return;
                }
                document.querySelectorAll('tbody tr').forEach(row => {
                    let rowText = row._cachedSearchText || "";
                    if (rowText.includes(term)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            }, 250);
        });
    }
});