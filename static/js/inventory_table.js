// 表格排序 搜索无冲突版

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

    mainRows.forEach(mainRow => {
        tbody.appendChild(mainRow);
        const itemId = mainRow.getAttribute('data-id');
        const detailRow = document.getElementById(`detail-${itemId}`);
        if (detailRow) {
            tbody.appendChild(detailRow);
        }
    });
};

// 无感静默保存

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
            showToast(result.message, "success");
            tr.classList.remove('row-saved');
            void tr.offsetWidth;
            tr.classList.add('row-saved');
        }
    } catch (err) {
        alert(TABLE_I18N.net_err_save);
    }
};

// 全局搜索

document.addEventListener('DOMContentLoaded', () => {
    // 💡 优化 1：精确定位到 advancedTable，防止误伤页面内可能存在的其他表格
    const tableBody = document.querySelector('#advancedTable tbody');
    if (!tableBody) return;

    // 一次性获取所有行，提升搜索时的循环性能
    const mainRows = tableBody.querySelectorAll('.main-row');

    // 💡 优化 2：页面加载时，使用 textContent 缓存文字，速度提升 10 倍
    mainRows.forEach(mainRow => {
        const itemId = mainRow.getAttribute('data-id');
        const detailRow = document.getElementById(`detail-${itemId}`)

        let combinedText = mainRow.textContent.toLowerCase();
        if (detailRow) {
            const template = detailRow.querySelector('.detail-template');
            if (template) {
                 combinedText += " " + template.content.textContent.toLowerCase();
            }
        }
        mainRow._cachedSearchText = combinedText;
    });

    const globalSearch = document.getElementById('globalSearch');
    let searchTimeout;

    if (globalSearch) {
        globalSearch.addEventListener('input', function(e) {
            let term = e.target.value.toLowerCase().trim();

            clearTimeout(searchTimeout);

            searchTimeout = setTimeout(() => {
                // 执行搜索：基于内存中的 DOM 引用直接操作，极速且不受排序干扰
                mainRows.forEach(mainRow => {
                    let rowText = mainRow._cachedSearchText || "";
                    let isMatch = rowText.includes(term);
                    mainRow.style.display = isMatch ? '' : 'none';

                    const itemId = mainRow.getAttribute('data-id');
                    const detailRow = document.getElementById(`detail-${itemId}`);
                    if (detailRow) {
                        detailRow.style.display = isMatch ? '' : 'none';
                    }
                });
            }, 250);
        });
    }
});

// ==========================================
// 🌟 手风琴表格展开
// ==========================================

document.querySelector('#advancedTable tbody').addEventListener('click', (e) => {
    if (e.target.closest('input, label, button')) {
        return;
    }
    const mainRow = e.target.closest('.main-row');
    if (!mainRow) return;
    const itemId = mainRow.getAttribute('data-id');
    const detailRow = document.getElementById(`detail-${itemId}`);
    const detailContainer = document.querySelector(`#detail-${itemId} .detail-container`);
    if (!detailContainer) return;

    const allContainers = document.querySelectorAll('#advancedTable .detail-container');
    allContainers.forEach(container => {
        if (container !== detailContainer && container.style.maxHeight && container.style.maxHeight !== '0px') {
            const cancelBtn = container.querySelector('.cancel-btn');
            if (cancelBtn && cancelBtn.style.display !== 'none') {
                cancelBtn.click();
            }
            container.style.maxHeight = '0px';
        }
    });

    let isFirstLoad = false;

    if (!detailContainer.querySelector('.detail-inner')) {
        const template = detailRow.querySelector('.detail-template');
        if (template) {
             detailContainer.appendChild(template.content.cloneNode(true));
             isFirstLoad = true;
        }
    }

    setTimeout(() => {
        if (detailContainer.style.maxHeight && detailContainer.style.maxHeight !== '0px') {
        detailContainer.style.maxHeight = '0px';
        } else {
            detailContainer.style.maxHeight = detailContainer.scrollHeight + 'px';

            const img = detailContainer.querySelector('.lazy-image');
            if (img && ! img.getAttribute('src')) {
                const realUrl = img.getAttribute('data-src') + '?t=' + new Date().getTime();
                img.setAttribute('src', realUrl);

                img.onerror = function () {this.style.display = 'none';};
            }
        }
    }, isFirstLoad ? 10 : 0);
});

// ==========================================
// 🌟 手风琴表格编辑
// ==========================================

document.querySelector(`#advancedTable tbody`).addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-btn')
    const cancelBtn = e.target.closest('.cancel-btn');
    const saveBtn = e.target.closest('.save-btn')
    const scrapBtn = e.target.closest('.scrap-btn')
    const locationBtn = e.target.closest('.location-map-btn');
    const detailRow = e.target.closest('.detail-row');
    if (!detailRow) return;
    const mainRow = detailRow.previousElementSibling;
    const nameInput = mainRow.querySelector('.name-input');
    const detailInner = detailRow.querySelector('.detail-inner');
    if (editBtn) {
        detailInner.classList.add('is-editing');
        detailInner.querySelectorAll('.detail-input').forEach(input => {
            input.dataset.originalValue = input.value;
            input.removeAttribute('readonly');
            input.style.backgroundColor = 'var(--text-white)';
            input.style.border = '1px solid var(--primary-blue)';
        });
        if (nameInput) {
            nameInput.dataset.originalValue = nameInput.value;
            nameInput.removeAttribute('readonly');
            nameInput.style.backgroundColor = 'var(--text-white)';
            nameInput.style.border = '1px solid var(--primary-blue)';
        }
        return;
    }

    if (cancelBtn) {
        detailInner.classList.remove('is-editing');
        detailInner.querySelectorAll('.detail-input').forEach(input => {
            if (input.dataset.originalValue !== undefined) {
                input.value = input.dataset.originalValue;
            }
            input.setAttribute('readonly', 'true');
            input.style.backgroundColor = '#f8f9fa';
            input.style.border = '1px solid var(--border-color)';
        });
        if (nameInput) {
            if (nameInput.dataset.originalValue !== undefined) {
                nameInput.value = nameInput.dataset.originalValue;
            }
            nameInput.setAttribute('readonly', 'true');
            nameInput.style.backgroundColor = '#f8f9fa';
            nameInput.style.border = '1px solid var(--border-color)';
        }
        return;
    }

    if (saveBtn) {
        const detailInner = saveBtn.closest('.detail-inner');
        const detailRow = saveBtn.closest('.detail-row');
        const itemId = detailRow.getAttribute('data-id');
        const mainRow = document.getElementById(`row-${itemId}`);
        const formData = new FormData();
        detailInner.querySelectorAll('input[name]').forEach(input => {
            formData.append(input.name, input.value.trim());
        });

        if (nameInput) {
            formData.append(nameInput.name, nameInput.value.trim());
        }
        saveBtn.disabled = true;

        fetch(`/edit/${itemId}`, {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    showToast(data.message, "success")
                    detailInner.querySelectorAll('.detail-input').forEach(input => {
                        input.dataset.originalValue = input.value;
                    });
                    if (nameInput) {
                        nameInput.dataset.originalValue = nameInput.value;
                    }
                    detailInner.querySelector('.cancel-btn').click();
                    detailRow.classList.remove('row-saved');
                    mainRow.classList.remove('row-saved');
                    void detailRow.offsetWidth;
                    void mainRow.offsetWidth;
                    detailRow.classList.add('row-saved');
                    mainRow.classList.add('row-saved');
                } else {
                    alert('Save Failed: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Save Alert: ', error);
                alert('Cannot attach the server');
            })
            .finally(() => {
                saveBtn.disabled = false;
            });
    }

    if (scrapBtn) {
        const detailRow = scrapBtn.closest('.detail-row');
        const itemId = detailRow.getAttribute('data-id');
        if (confirm(TABLE_I18N.scrap_warn)) {
            let form = document.createElement('form');
            form.method = 'POST';
            form.action = '/delete/' + itemId;
            form.style.display = 'none';
            document.body.appendChild(form);
            form.submit();
        }
    }

    if (locationBtn) {
        const detailInner = locationBtn.closest('.detail-inner');
        const locationInput = detailInner.querySelector('input[name="location"]')
        const locValue = locationInput ? locationInput.value.trim() : "";
        if (locValue && locValue.length >= 3 && locValue !== '-') {
            let rackName = locValue.slice(0, 3).toUpperCase();
            if (window.openFooterMap) {
             window.openFooterMap(rackName);
            }
        } else {
            alert('Undefined Location');
        }
    }
});