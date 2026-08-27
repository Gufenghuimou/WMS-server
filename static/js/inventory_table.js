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

            let isAlarming = false;
            if (window.INV_TAB_DATA) {
                const dataItem = window.INV_TAB_DATA.find(i => i.id == itemId);
                if (dataItem) {
                    dataItem.warning_level = warningVal ? parseFloat(warningVal) : 0;
                    dataItem.is_mva = isMvaChecked;
                    isAlarming = dataItem.warning_level > 0 && dataItem.stock < dataItem.warning_level;
                }
            }

            // 保存后重绘该行
            const badgeTr = tr.querySelector('.alarm-badge');
            if (badgeTr) {
                const td = badgeTr.parentElement;
                if (isAlarming) {
                    td.setAttribute('data-sort', '1');
                    td.innerHTML = `<span class="alarm-badge alarm-yes"><i class="material-icons" style="font-size: 0.8rem; vertical-align: middle;">warning</i> ${TABLE_I18N.alarm_yes}</span>`;
                } else {
                    td.setAttribute('data-sort', '0');
                    td.innerHTML = `<span class="alarm-badge alarm-no"><i class="material-icons" style="font-size: 0.8rem; vertical-align: middle;">check</i> ${TABLE_I18N.alarm_no}</span>`;
                }
            }

            // 重绘指示灯
            if (window.INV_TAB_DATA) {
                const newAlarmCount = window.INV_TAB_DATA.filter(item => item.warning_level > 0 && item.stock < item.warning_level).length;
                const indicator = document.getElementById('indicator');
                if (indicator) {
                    indicator.innerHTML = `
                        <i class="material-icons" style="font-size: 1.45rem; color: var(--danger-red);">report_problem</i>
                        ${BASE_I18N.inventory_table}:
                        <span style="font-size: 1.2rem; font-weight: bold; color: var(--danger-red); margin-left: 4px;">
                            ${newAlarmCount || 0}
                        </span>
                    `;
                }
            }

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
    const globalSearch = document.getElementById('globalSearch');
    let searchTimeout;

    if (globalSearch) {
        globalSearch.addEventListener('input', function(e) {
            let term = e.target.value.toLowerCase().trim();

            clearTimeout(searchTimeout);

            searchTimeout = setTimeout(() => {
                if (term === '') {
                    renderInvTab(window.INV_TAB_DATA);
                    return;
                }
                let filterData = window.INV_TAB_DATA.filter(item => {
                    let searchKey = `${ item.pn_1 || ''} ${ item.name || ''} ${ item.location || ''} ${ item.pn_2 || ''} ${item.description_1 || ''} ${item.description_2 || ''} ${item.remarks || ''}`.toLowerCase();
                    return searchKey.includes(term);
                });
                renderInvTab(filterData);
            }, 300);
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

                    if (window.INV_TAB_DATA) {
                        const dataItem = window.INV_TAB_DATA.find(i => i.id == itemId);
                        if (dataItem) {
                            dataItem.name = nameInput ? nameInput.value.trim() : dataItem.name;
                            detailInner.querySelectorAll('input[name]').forEach(input => {
                                dataItem[input.name] = input.value.trim();
                            });
                        }
                    }

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
        openScrapModal(itemId);
        // if (confirm(TABLE_I18N.scrap_warn)) {
        //     let form = document.createElement('form');
        //     form.method = 'POST';
        //     form.action = '/delete/' + itemId;
        //     form.style.display = 'none';
        //     document.body.appendChild(form);
        //     form.submit();
        // }
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

// 捞取后端数据
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/inventory_table');
        const result = await response.json();

        if (result.status === 'success') {
            const invData = result.data;
            window.INV_TAB_DATA = invData.items;
            renderInvTab(invData.items);

            // 修改左下指示灯
            const indicator = document.getElementById('indicator');
            const indicatorData = invData.alarmCount;
            indicator.innerHTML = `
                <i class="material-icons" style="font-size: 1.45rem; color: var(--danger-red);">report_problem</i>
                ${BASE_I18N.inventory_table}:
                <span style="font-size: 1.2rem; font-weight: bold; color: var(--danger-red); margin-left: 4px;">
                    ${indicatorData || 0}
                </span>
            `;
        }
    } catch (error) {
        console.error("Data Loaded Fail", error);
        document.querySelector('tbody').innerHTML = `<div style="text-align:center; color:red;">加载失败，请刷新重试</div>`;
    } finally {
        if (typeof window.hideGlobalLoader === 'function') {
            setTimeout(window.hideGlobalLoader, 50);
        }
    }
});

function renderInvTab(data) {
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

    const rowsHtml = data.map(item => {
        let alarmBadge = '';
        let is_alarming = false;
        if (item.warning_level > 0 && item.stock < item.warning_level) is_alarming = true;
        if (is_alarming) {
            alarmBadge = `<span class="alarm-badge alarm-yes"><i class="material-icons" style="font-size: 0.8rem; vertical-align: middle;">warning</i> ${TABLE_I18N.alarm_yes}</span>`;
        } else {
            alarmBadge = `<span class="alarm-badge alarm-no"><i class="material-icons" style="font-size: 0.8rem; vertical-align: middle;">check</i> ${TABLE_I18N.alarm_no}</span>`;
        }
        let hasImage = '';
        if (item.has_image) {
            hasImage = `<img class="lazy-image" data-src="/static/item_images/${item.id}.jpg?t=${window.GLOBAL_SYS_VER}" loading="lazy" alt="Item Image" onclick="openShowImgModal('${item.id}', '${item.pn_1}', '${item.name}')">`;
        }
        return `
            <tr class="main-row" data-id="${item.id}" id="row-${item.id}">
                    <td class="font-monospace" style="font-size: 1.1rem; font-weight: bold;">${item.pn_1}</td>
                    <td title="${item.name || '-'}">
                        <input class="name-input" type="text" value="${item.name || '-'}" readonly name="name">
                    </td>
                    <td data-sort="${item.stock}" style="font-weight: bold; font-size: 1rem;">${item.stock }</td>
                    <td data-sort="${item.usage_1y}">${item.usage_1y}</td>
                    <td data-sort="${item.usage_2y}">${item.usage_2y}</td>
                    <td data-sort="${item.usage_3y}">${item.usage_3y}</td>
                    <td data-sort="${item.first_in_date}"><span style="color: #7f8c8d;">${item.first_in_date || '-'}</span></td>
                    <td data-sort="${is_alarming ? 1 : 0}">${alarmBadge}</td>
                    <td><input type="number" class="inline-input warning-input" value="${item.warning_level || 0}" min="0" onchange="autoSave('${item.id}')"></td>

                    <td style="text-align: center;">
                        <label class="switch">
                            <input type="checkbox" class="mva-checkbox" onchange="autoSave('${item.id}')" ${item.is_mva ? "checked" : ""}>
                            <span class="slider"></span>
                        </label>
                    </td>
                </tr>
                <tr class="detail-row" data-id="${item.id}" id="detail-${item.id}">
                    <td colspan="10">
                        <div class="detail-container">
                            <template class="detail-template">
                                <div class="detail-inner">
                                    <div class="detail-image-box">${hasImage}</div>
                                    <div class="detail-text">
                                        <label>PN2:
                                            <input class="detail-input" type="text" value="${item.pn_2}" readonly name="pn_2">
                                        </label>
                                    </div>
                                    <div class="detail-long-text">
                                        <label>${TABLE_I18N.description_2}:
                                            <input class="detail-input" type="text" value="${item.description_2}" readonly name="description_2">
                                        </label>
                                    </div>
                                    <div class="detail-text">
                                        <label>${TABLE_I18N.description_1}:
                                            <input class="detail-input" type="text" value="${item.description_1}" readonly name="description_1">
                                        </label>
                                    </div>
                                    <div class="detail-long-text">
                                          <label>${TABLE_I18N.remarks}:
                                            <input class="detail-input" type="text" value="${item.remarks}" readonly name="remarks">
                                        </label>
                                    </div>

                                    <div class="detail-text">
                                        <label style="display: flex; justify-content: center; gap: 20px;">
                                            <i class="material-icons location-map-btn" style="color: var(--primary); cursor: pointer;">place</i>
                                            <input class="detail-input" type="text" value="${item.location}" readonly name="location" style="flex: 0; width: 80px;">
                                        </label>
                                    </div>
                                    <div class="detail-text" style="display: flex; justify-content: space-around;">
                                        <div>
                                            <span>${TABLE_I18N.total_in}: </span>
                                            <span style="font-size: 1.05rem; font-weight: 600;">${item.total_in}</span>
                                        </div>
                                        <div>
                                            <span>${TABLE_I18N.total_out}: </span>
                                        <span style="font-size: 1.05rem; font-weight: 600;">${item.total_out}</span>
                                        </div>
                                        <input type="hidden" name="pn_1" value="${item.pn_1}">
                                        <input type="hidden" name="stock" value="${item.stock}">
                                    </div>
                                    <div class="btn-container">
                                        <div class="detail-edit-btn">
                                            <div class="action-btn">
                                                <button class="btn-primary scrap-btn" style="background-color: var(--danger-red);">${TABLE_I18N.scrap_btn}</button>
                                                <button class="btn-primary save-btn" style="background-color: var(--primary-blue);">${TABLE_I18N.save_btn}</button>
                                                <button class="btn-primary cancel-btn" style="background-color: #f1f3f4; color: var(--text-main);">${TABLE_I18N.cancel_btn}</button>
                                            </div>
                                            <button class="btn-primary edit-btn" style="background-color: var(--primary-green);">${TABLE_I18N.edit_btn}</button>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </td>
                </tr>
        `;
    }).join('');
    tBody.innerHTML = rowsHtml;
}
