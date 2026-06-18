// 表格排序 无搜索冲突

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
    });
}

// 全局搜索

document.addEventListener('DOMContentLoaded', () => {
    const tBody = document.querySelector('#advancedTable tbody');
    if (!tBody) return;
    const mainRows = tBody.querySelectorAll('.main-row');
    mainRows.forEach(mainRow => {
        mainRow._cachedSearchText = mainRow.textContent.toLowerCase();
    });

    const globalSearch = document.getElementById('globalSearch');
    let searchTimeout;

    if (globalSearch) {
        globalSearch.addEventListener('input', function(e) {
            let term = e.target.value.toLowerCase().trim();

            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                mainRows.forEach(mainRow => {
                    let rowText = mainRow._cachedSearchText || "";
                    let isMatch = rowText.includes(term);
                    mainRow.style.display = isMatch ? '' : 'none';
                });
            }, 250);
        });
    }
});

// 定义滑动报废变量
let isDraggingSlider = false;
let startX = 0;
let maxDrag = 0;
const ZOOM_LEVEL = 0.67;

// Modals Control

window.openToggleModal = function(itemId, isStockStr) {
    const modal = document.getElementById('toggleModal');
    const form = document.getElementById('toggleForm');
    const title = document.getElementById('toggleTitle');
    const hintBox = document.getElementById('toggleHintBox');
    const fieldBox = document.getElementById('toggleFields');
    const locInput = document.getElementById('locInput');
    const userInput = document.getElementById('userInput');
    const projectInput = document.getElementById('projectInput');

    form.action = `/simcard_out/${itemId}`

    if (isStockStr === 'True') {
        title.innerHTML = `<i class="material-icons" style="color:#1db954;">output</i> ${ASSET_I18N.toggle_out_title}`;
        hintBox.innerHTML = ASSET_I18N.toggle_out_hint;
        fieldBox.style.display = 'flex';
        locInput.value = '';
        locInput.required = true;
        userInput.value = '';
        projectInput.value = '';
    } else {
        title.innerHTML = `<i class="material-icons" style="color:#f39c12;">keyboard_return</i> ${ASSET_I18N.toggle_in_title}`;
        hintBox.innerHTML = ASSET_I18N.toggle_in_hint;
        fieldBox.style.display = 'none';
        locInput.value = '';
        locInput.required = false;
        userInput.value = '';
        projectInput.value = '';
    }
    modal.style.display = 'flex';
}

window.openItemEditModal = function(itemId, icc, carrier, phone, loc, user, proj, note) {
    const modal = document.getElementById('itemEditModal');
    document.getElementById('itemEditForm').action = `/simcard_edit/${itemId}`;

    document.getElementById('editIccid').value = icc;
    document.getElementById('editCarrier').value = carrier;
    document.getElementById('editPhone').value = phone;
    document.getElementById('editLoc').value = loc;
    document.getElementById('editUser').value = user || '';
    document.getElementById('editProject').value = proj || '';
    document.getElementById('editNote').value = note || '';

    modal.style.display = 'flex';
}

window.openActiveToggleModal = function(itemId, isActiveStr) {
    const modal = document.getElementById('activeToggleModal');
    const form = document.getElementById('activeToggleForm');
    const title = document.getElementById('activeModalTitle');
    const text = document.getElementById('activeModalText');
    const icon = document.getElementById('activeModalIcon');
    const submitBtn = document.getElementById('activeSubmitBtn');

    form.action = `/simcard_active_toggle/${itemId}`;

    if (isActiveStr === 'True') {
        icon.innerHTML = '<i class="material-icons" style="font-size: 3.5rem; color: var(--danger-red);">do_not_disturb_on</i>';
        title.innerHTML = SIMCARD_I18N.simcard_disable;
        text.innerHTML = SIMCARD_I18N.disabled_notice;
        submitBtn.innerHTML = `<i class="material-icons">block</i> ${SIMCARD_I18N.btn_disable}`;
        submitBtn.style.backgroundColor = 'var(--danger-red)';
    } else {
        icon.innerHTML = '<i class="material-icons" style="font-size: 3.5rem; color: #1db954;">settings_backup_restore</i>';
        title.innerHTML = SIMCARD_I18N.simcard_enable;
        text.innerHTML = SIMCARD_I18N.enable_notice;
        submitBtn.innerHTML = `<i class="material-icons">check_circle</i> ${SIMCARD_I18N.btn_enable}`;
        submitBtn.style.backgroundColor = 'var(--primary-green)';
    }
    modal.style.display = 'flex';
}

window.openScrapModal = function(itemId, isActiveStr) {
    const modal = document.getElementById('scrapModal');
    const form = document.getElementById('scrapForm');

    form.action = `/simcard_delete/${itemId}`
    if (isActiveStr === 'True') return;

    resetSlider();
    modal.style.display = 'flex';

    const handle = document.getElementById('sliderHandle');
    const container = document.getElementById('sliderContainer');
    maxDrag = container.clientWidth - handle.clientWidth - 6;

    handle.onmousedown = startSlide;
}

window.closeToggleModal = function() {
    document.getElementById('toggleModal').style.display = 'none';
}

window.closeItemEditModal = function() {
    document.getElementById('itemEditModal').style.display = 'none';
}

window.closeActiveToggleModal = function() {
    document.getElementById('activeToggleModal').style.display = 'none';
}

window.closeScrapModal = function() {
    document.getElementById('scrapModal').style.display = 'none';
    resetSlider();
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeToggleModal();
        closeItemEditModal();
        closeActiveToggleModal();
        closeScrapModal();
    }
});

// scrapModal 滑动控制

function resetSlider(animate = false) {
    const container = document.getElementById('sliderContainer');
    const handle = document.getElementById('sliderHandle');
    const bg = document.getElementById('sliderBg');
    const text = document.getElementById('sliderText');

    container.classList.remove('unlocked');
    text.innerText = '滑动以确认';

    if (animate) {
        handle.style.transition = 'left 0.3s ease';
        bg.style.transition = 'width 0.3s ease';
    }

    handle.style.left = '3px';
    bg.style.width = '0';
}

function unlockSuccess() {
    isDraggingSlider = false;
    document.onmousemove = null;

    const container = document.getElementById('sliderContainer');
    container.classList.add('unlocked');
    document.getElementById('sliderText').innerText = '释放以报废';

    setTimeout(() => {
        document.getElementById('scrapForm').submit();
    }, 200);
}

function updateSliderPosition(x) {
    const handle = document.getElementById('sliderHandle');
    const bg = document.getElementById('sliderBg');
    handle.style.left = (x + 3) + 'px';
    bg.style.width = (x + 25) + 'px';
}

function onSlide(e) {
    if (!isDraggingSlider) return;
    let moveX = (e.clientX - startX) / ZOOM_LEVEL;

    if (moveX < 0) moveX = 0;
    if (moveX > maxDrag) moveX = maxDrag;

    updateSliderPosition(moveX);

    if (moveX >= maxDrag * 0.98) {
        unlockSuccess();
    }
}

function startSlide(e) {
    isDraggingSlider = true;
    startX = e.clientX;
    document.onmousemove = onSlide;
    document.onmouseup = stopSlide;

    document.getElementById('sliderHandle').style.transition = 'none';
    document.getElementById('sliderBg').style.transition = 'none';
}

function stopSlide(e) {
    if (!isDraggingSlider) return;
    isDraggingSlider = false;
    document.onmousemove = null;
    document.onmouseup = null;

    if (!document.getElementById('sliderContainer').classList.contains('unlocked')) {
        resetSlider(true);
    }
}



// AJAX

document.addEventListener('submit', async function(e){
    const form = e.target;
    if (form.id !== 'toggleForm' && form.id !== 'itemEditForm' && form.id !== 'activeToggleForm') return;
    e.preventDefault();

    try {
        let formData = new FormData(form);
        let response = await fetch(form.action, {
            method: 'POST',
            body: formData
        });

        let result = await response.json();
        if (result.status === 'success') {
            showToast(result.message, 'success');
            closeToggleModal();
            closeItemEditModal();
            closeActiveToggleModal();

            updateTableRow(result.data)
        }
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
    }
});

function updateTableRow(data) {
    if (!data || !data.id) return;
    let row = document.getElementById(`row-${data.id}`);
    if (!row) return;

    let tds = row.querySelectorAll('td');
    if (data.icc_id !== undefined) {
        let icc = String(data.icc_id).trim();
        if (icc.length > 5) {
            tds[0].innerText = icc.slice(0, -5) + ' ' + icc.slice(-5);
        } else {
            tds[0].innerText = icc;
        }
    }
    if (data.carrier !== undefined) tds[1].innerText = data.carrier;
    if (data.phone_number !== undefined) tds[2].innerText = data.phone_number;
    if (data.location !== undefined) tds[3].innerHTML = `<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.95rem;"><i class="material-icons" style="font-size: 1rem;">place</i> ${data.location}</span>`;
    if (data.direct_user !== undefined) tds[4].innerText = data.direct_user;
    if (data.project !== undefined) tds[5].innerText = data.project;
    if (data.is_stock !== undefined) tds[6].innerHTML = data.is_stock ? `<span style="background: rgba(29, 185, 84, 0.15); color: #158e40; padding: 4px 10px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; white-space: nowrap">在库</span>` : `<span style="background: rgba(231, 76, 60, 0.15); color: #c0392b; padding: 4px 10px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; white-space: nowrap">已借出</span>`;
    if (data.note !== undefined) tds[7].innerText = data.note;
    if (data.is_stock !== undefined || data.is_active !== undefined) {
        window.location.reload();
    } else {
        row.style.transition = "background-color 0.5s ease";
        row.style.backgroundColor = '#d4edda';
        setTimeout(() => row.style.backgroundColor = "", 800)
    }
}