// Global Toast Engine
window.showToast = function(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-card toast-${type}`;
    const icon = type === 'success' ? 'check_circle' : 'error';

    toast.innerHTML = `<i class="material-icons" style="font-size: 1.2rem;">${icon}</i> <span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastFadeOut 0.4s ease-in forwards';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
};

// Hydration Engine
window.switchAssetType = function(groupId) {
    document.querySelectorAll('.asset-card').forEach(el => el.classList.remove('active'));
    let targetCard = document.getElementById('card-' + groupId);
    if (targetCard) targetCard.classList.add('active');

    let tbody = document.getElementById('dynamicDetailTbody');
    let groupData = window.ASSET_DATA[groupId];

    if (!groupData || !groupData.items || groupData.items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 120px 0; color: #ccc; border: none;">
                    <i class="material-icons" style="font-size: 4rem; margin-bottom: 15px; display: block;">inventory_2</i>
                    <span style="font-size: 1.1rem;">${ASSET_I18N.no_detail_data}</span>
                </td>
            </tr>`;
        return;
    }

    let rowsHtml = groupData.items.map(item => {
        let statusHtml = '';
        if (item.is_stop) {
            statusHtml = `<span style="background: rgba(149, 165, 166, 0.15); color: #7f8c8d; padding: 4px 10px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; text-decoration: line-through; white-space: nowrap">${ASSET_I18N.status_stop}</span>`;
        } else if (item.is_stock) {
            statusHtml = `<span style="background: rgba(29, 185, 84, 0.15); color: #158e40; padding: 4px 10px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; white-space: nowrap">${ASSET_I18N.status_in_stock}</span>`;
        } else {
            statusHtml = `<span style="background: rgba(231, 76, 60, 0.15); color: #c0392b; padding: 4px 10px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; white-space: nowrap">${ASSET_I18N.status_out_stock}</span>`;
        }

        let safeCtrl = item.ctrl_no.replace(/'/g, "\\'");
        let rawLoc = item.location ? String(item.location).trim() : '';
        let safeLoc = rawLoc.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        let rackName = "";
        if (rawLoc && rawLoc !== '-' && rawLoc.toLowerCase() !== 'none') {
            rackName = rawLoc.split('-')[0].toUpperCase().replace(/'/g, "\\'").replace(/"/g, "&quot;")
        }
        let safeDate = item.first_in_date ? item.first_in_date.replace(/'/g,"\\'"): '';
        let safePoType = item.po_type ? String(item.po_type).replace(/'/g, "\\'") : '';
        let isStockStr = item.is_stock ? 'True' : 'False';
        let isStopStr = item.is_stop ? 'True' : 'False';
        let disabledStyle = item.is_stop ? 'opacity: 0.5; pointer-events: none;' : '';

        let poTypeHtml = '';
        if (item.po_type === 'common') { poTypeHtml = '<span style="font-size: 0.9rem; color: #333333; background-color: rgba(51, 51, 51, 0.15); padding: 4px 10px; white-space: nowrap; border-radius: 12px;">Common</span>'; }
        else if (item.po_type === 'reimburse') { poTypeHtml = '<span style="font-size: 0.9rem; color: #0899C2; background-color: rgba(8, 153, 194, 0.15); padding: 4px 10px; white-space: nowrap; border-radius: 12px;">Reimburse</span>'; }
        else if (item.po_type === 'consign') { poTypeHtml = '<span style="font-size: 0.9rem; color: #C20884; background-color: rgba(194, 8, 132, 0.15); padding: 4px 10px; white-space: nowrap; border-radius: 12px;">Consign</span>'; }

        const isAdmin = (window.USER_ROLE === 'superadmin' || window.USER_ROLE === 'admin');
        let btnGroupHtml = '';
        if (isAdmin) {
            let btn1Bg = !item.is_stock ? '#1db954' : '#f39c12';
            let btn1Icon = item.is_stock ? 'output' : 'login';
            let btn1Text = item.is_stock ? ASSET_I18N.btn_take_out : ASSET_I18N.btn_return_in;
            let btn1 = `<button type="button" class="btn-primary btn-sm" title=" ${btn1Text}" style="background-color: ${btn1Bg}; ${disabledStyle};" onclick="openToggleModal(${item.id}, '${isStockStr}')"><i class="material-icons" style="margin-top: 2px;">${btn1Icon}</i></button>`;

            let btn2 = `<button type="button" class="btn-primary btn-sm" title="${ASSET_I18N.btn_edit}" style="background-color: #ccc; color: #333; ${disabledStyle}" onclick="openItemEditModal(${item.id}, '${safeCtrl}', '${safeLoc}', '${safeDate}', '${safePoType}')"><i class="material-icons" style="margin-top: 2px;">edit_note</i></button>`;

            let btn3 = '';
            if (!item.is_stop && !item.is_stock) {
                btn3 = `<button type="button" class="btn-primary btn-sm" title="${ASSET_I18N.btn_stop}" style="background-color: #bdc3c7; color: #fff; box-shadow: none;" onclick="alert('${ASSET_I18N.btn_stop_deny}')"><i class="material-icons" style="margin-top: 2px;">do_not_disturb</i></button>`;
            } else {
                let btn3Bg = item.is_stop ? '#95a5a6' : 'var(--danger-red)';
                let btn3Icon = item.is_stop ? 'settings_backup_restore' : 'do_not_disturb';
                let btn3Text = item.is_stop ? ASSET_I18N.btn_reuse : ASSET_I18N.btn_stop;
                btn3 = `<button type="button" class="btn-primary btn-sm" title="${btn3Text}" style="background-color: ${btn3Bg};" onclick="openStopConfirmModal(${item.id}, '${safeCtrl}', '${isStopStr}')"><i class="material-icons" style="margin-top: 2px;">${btn3Icon}</i></button>`;
            }
            btnGroupHtml = btn1 + btn2 + btn3;
        } else {
            if (!item.is_stock && !item.is_stop) {
                let btn4 = `<button type="button" class="btn-primary btn-sm" title="Request Return" style="background-color: #1db954;" onclick="openToggleModal(${item.id}, 'False', '${safeCtrl}', true)"><i class="material-icons" style="margin-top: 2px;">assignment_return</i></button>`;
                let btn5 = `<button type="button" class="btn-primary btn-sm" title="Report Broken" style="background-color: var(--danger-red);" onclick="openStopConfirmModal(${item.id}, '${safeCtrl}', 'False', true)"><i class="material-icons" style="margin-top: 2px;">build</i></button>`;
                btnGroupHtml = btn4 + btn5;
            } else {
                btnGroupHtml = `<span style="font-size:0.8rem; color:#aaa;">No Actions</span>`;
            }
        }

        return `
        <tr>
            <td class="font-monospace" style="font-weight: 600; font-size: 1.15rem; white-space: nowrap;">${item.ctrl_no}</td>
            <td>
                <span style="cursor:pointer; color:var(--primary); font-weight: 500; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;" 
                      onclick="event.stopPropagation(); if(window.openFooterMap && '${rackName}') window.openFooterMap('${rackName}');">
                    <i class="material-icons" style="font-size: 1rem;">place</i>
                    ${rawLoc || ASSET_I18N.loc_unassigned}
                </span>
            </td>
            <td style="font-size: 0.9rem; color: #555; white-space: nowrap;">${item.first_in_date || '-'}</td>
            <td style="white-space: nowrap; text-align: center;">${statusHtml}</td>
            <td style="font-size: 0.75rem; white-space: nowrap; text-align: center;">${poTypeHtml}</td>
            <td style="display: flex; gap: 10px; justify-content: center; white-space: nowrap;">${btnGroupHtml}</td>
        </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;

    let searchInput = document.getElementById('globalSearch');
    let keyword = searchInput ? searchInput.value.toLowerCase().trim() : '';
    if (keyword) {
        let firstMatchRow = null;
        let rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            let ctrlText = row.querySelector('td:nth-child(1)')?.textContent.toLowerCase() || '';
            let locText = row.querySelector('td:nth-child(2)')?.textContent.toLowerCase() || '';
            if (ctrlText.includes(keyword) || locText.includes(keyword)) {
                row.classList.add('search-highlight')
                if (!firstMatchRow) { firstMatchRow = row; }
            }
        });
        if (firstMatchRow) {
            setTimeout(() => firstMatchRow.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        }
    }
};

// Modals Control
window.openToggleModal = function(itemId, isStockStr, ctrlNo, isUserRequest = false) {
    const modal = document.getElementById('toggleModal');
    const form = document.getElementById('toggleForm');
    const hintBox = document.getElementById('toggleHintBox');
    const locInput = document.getElementById('locInput');
    const title = document.getElementById('toggleTitle');
    const adminLocBox = locInput.parentElement;
    const userFieldsBox = document.getElementById('toggleUserFields');

    if (isUserRequest) {
        form.action = `/api/request_asset/${ctrlNo}`;
        title.innerHTML = `<i class="material-icons" style="color:#1db954;">assignment_return</i> Request Return`;
        hintBox.innerHTML = `Submit a return request for asset <strong>${ctrlNo}</strong>.`;
        adminLocBox.style.display = 'none';
        locInput.required = false;
        userFieldsBox.style.display = 'block';
        document.getElementById('toggleDept').required = true;
    } else {
        form.action = `/asset_out/${itemId}`;
        adminLocBox.style.display = 'block';
        userFieldsBox.style.display = 'none';
        document.getElementById('toggleDept').required = false;
        if (isStockStr === 'True') {
            title.innerHTML = `<i class="material-icons" style="color:#f39c12;">output</i> ${ASSET_I18N.toggle_out_title}`;
            hintBox.innerHTML = ASSET_I18N.toggle_out_hint;
            locInput.placeholder = ASSET_I18N.toggle_out_ph;
            locInput.required = true;
        } else {
            title.innerHTML = `<i class="material-icons" style="color:#1db954;">keyboard_return</i> ${ASSET_I18N.toggle_in_title}`;
            hintBox.innerHTML = ASSET_I18N.toggle_in_hint;
            locInput.placeholder = ASSET_I18N.toggle_in_ph;
            locInput.required = false;
        }
    }

    modal.style.display = 'flex';
};

window.closeToggleModal = function() {
    document.getElementById('toggleModal').style.display = 'none';
};

window.openStopConfirmModal = function(itemId, ctrlNo, isStopStr, isUserRequest = false) {
    const modal = document.getElementById('stopConfirmModal');
    const form = document.getElementById('stopForm');
    const title = document.getElementById('stopModalTitle');
    const text = document.getElementById('stopModalText');
    const icon = document.getElementById('stopModalIcon');
    const submitBtn = document.getElementById('stopSubmitBtn');
    const radio = document.getElementById('raisonRadio')
    const userFieldsBox = document.getElementById('stopUserFields');

    if (isUserRequest) {
        form.action = `/api/request_asset/${ctrlNo}`;
        icon.innerHTML = '<i class="material-icons" style="font-size: 3.5rem; color: var(--danger-red);">build</i>';
        title.innerText = "Report Broken Asset";
        text.innerHTML = `Submit a broken report for asset <strong>${ctrlNo}</strong>`;
        radio.style.display = 'none';
        radio.querySelectorAll('input').forEach(input => {input.required = false;});
        userFieldsBox.style.display = 'block';
        document.getElementById('stopDept').required = true;
        submitBtn.style.backgroundColor = 'var(--danger-red)';
        submitBtn.innerHTML = '<i class="material-icons">send</i> Submit';
    } else {
        form.action = `/api/asset_stop_toggle/${itemId}`;
        userFieldsBox.style.display = 'none';
        document.getElementById('stopDept').required = false;
        if (isStopStr === 'True') {
            icon.innerHTML = '<i class="material-icons" style="font-size: 3.5rem; color: #1db954;">settings_backup_restore</i>';
            title.innerText = ASSET_I18N.stop_reuse_title;
            text.innerHTML = ASSET_I18N.stop_reuse_text.replace('{ctrlNo}', ctrlNo);
            radio.style.display = 'none';
            radio.querySelectorAll('input').forEach(i => i.required = false);
            submitBtn.style.backgroundColor = '#1db954';
            submitBtn.innerHTML = `<i class="material-icons">check_circle</i> ${ASSET_I18N.btn_reuse}`;
        } else {
            icon.innerHTML = '<i class="material-icons" style="font-size: 3.5rem; color: var(--danger-red);">do_not_disturb_on</i>';
            title.innerText = ASSET_I18N.stop_freeze_title;
            text.innerHTML = ASSET_I18N.stop_freeze_text.replace('{ctrlNo}', ctrlNo);
            radio.style.display = 'flex';
            radio.querySelectorAll('input').forEach(i => i.required = true);
            submitBtn.style.backgroundColor = 'var(--danger-red)';
            submitBtn.innerHTML = `<i class="material-icons">block</i> ${ASSET_I18N.btn_stop}`;
        }
    }

    modal.style.display = 'flex';
};

window.closeStopConfirmModal = function() {
    document.getElementById('stopConfirmModal').style.display = 'none';
};

window.openItemEditModal = function(itemId, ctrlNo, location, dateStr, poType) {
    const modal = document.getElementById('itemEditModal');

    document.getElementById('itemEditForm').action = `/asset_edit_item/${itemId}`;
    document.getElementById('modalCtrlNoDisplay').innerText = `[${ctrlNo}]`;
    document.getElementById('editCtrlNo').value = ctrlNo || '';
    document.getElementById('editLocation').value = (location === 'None' || !location) ? '' : location;
    document.getElementById('editDate').value = (dateStr === 'None' || !dateStr) ? '' : dateStr;
    document.getElementById('editPoType').value = (poType === 'None' || !poType) ? '' : poType;

    modal.style.display = 'flex';
};

window.closeItemEditModal = function() {
    document.getElementById('itemEditModal').style.display = 'none';
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if(window.closeToggleModal) window.closeToggleModal();
        if(window.closeStopConfirmModal) window.closeStopConfirmModal();
        if(window.closeItemEditModal) window.closeItemEditModal();
    }
});

// Initialization & Events
document.addEventListener("DOMContentLoaded", () => {
    let firstCard = document.querySelector('.asset-card');
    if (firstCard) {
        firstCard.click();
    }

    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            let keyword = e.target.value.toLowerCase().trim();
            let visibleCount = 0;
            let firstVisibleCard = null;

            document.querySelectorAll('.asset-card').forEach(card => {
                let keys = card.getAttribute('data-search-keys');
                if (keys.includes(keyword)) {
                    card.style.display = 'block';
                    visibleCount++;
                    if (!firstVisibleCard) firstVisibleCard = card;
                } else {
                    card.style.display = 'none';
                }
            });

            if (firstVisibleCard && keyword !== '') {
                firstVisibleCard.click();
            } else if (keyword === '') {
                let currentFirstCard = document.querySelector('.asset-card');
                if (currentFirstCard) currentFirstCard.click();
            }
        });
    }
});

window.flipToEdit = function(event, cardId) {
    event.stopPropagation();
    let card = document.getElementById(cardId);
    if (!card) return;

    let front = card.querySelector('.card-front');
    let back = card.querySelector('.card-back');

    if (!card.dataset.frontHeight) {
        card.dataset.frontHeight = front.offsetHeight + 'px';
    }

    card.style.height = back.offsetHeight + 'px';
    card.classList.add('is-flipped');
};

window.cancelEdit = function(event, cardId) {
    event.stopPropagation();
    let card = document.getElementById(cardId);
    if (!card) return;

    card.classList.remove('is-flipped');
    card.style.height = card.dataset.frontHeight;

    setTimeout(() => {
        if (!card.classList.contains('is-flipped')) {
            card.style.height = '';
        }
    }, 600);
};

// Image Cropper Engine
let cropper = null;
let currentCropContext = { pn1: null, itemId: null };

window.uploadCardImage = function(inputElem, pn1, itemId) {
    if (!inputElem.files || inputElem.files.length === 0) return;

    let file = inputElem.files[0];
    let reader = new FileReader();

    currentCropContext.pn1 = pn1;
    currentCropContext.itemId = itemId;

    reader.onload = function(e) {
        document.getElementById('cropImageTarget').src = e.target.result;
        document.getElementById('cropModal').style.display = 'block';

        if (cropper) { cropper.destroy(); }

        let image = document.getElementById('cropImageTarget');
        cropper = new Cropper(image, {
            aspectRatio: 1 / 1,
            viewMode: 1,
            autoCropArea: 0.9,
            dragMode: 'move',
        });
    };
    reader.readAsDataURL(file);
    inputElem.value = '';
};

window.confirmCrop = function() {
    if (!cropper || !currentCropContext.pn1) return;

    cropper.getCroppedCanvas({
        maxWidth: 800,
        maxHeight: 800,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
    }).toBlob(async function(blob) {
        let formData = new FormData();
        formData.append('file', blob, 'image.jpg');

        try {
            let res = await fetch(`/api/asset_upload_image/${encodeURIComponent(currentCropContext.pn1)}`, {
                method: 'POST',
                body: formData
            });
            let data = await res.json();

            if (data.status === 'success') {
                closeCropModal();
                showToast('Image updated successfully!', 'success');
                let freshUrl = data.url + '?t=' + new Date().getTime();

                let previewBack = document.getElementById(`edit-preview-${currentCropContext.itemId}`);
                let placeholderBack = document.getElementById(`edit-placeholder-${currentCropContext.itemId}`);
                if (previewBack) {
                    previewBack.src = freshUrl;
                    previewBack.style.display = 'block';
                }
                if (placeholderBack) placeholderBack.style.display = 'none';

                let cardFront = document.getElementById(`card-${currentCropContext.pn1.replace(/ /g, '-').replace(/\//g, '-')}`);
                if (cardFront) {
                    let imgFront = cardFront.querySelector('.left-part img.card-img');
                    let placeholderFront = cardFront.querySelector('.left-part div.card-img');

                    if (imgFront) {
                        imgFront.src = freshUrl;
                        imgFront.style.display = 'block';
                    }
                    if (placeholderFront) placeholderFront.style.display = 'none';
                }
            } else {
                showToast(ASSET_I18N.upload_fail, 'error');
            }
        } catch(e) {
            showToast(ASSET_I18N.upload_net_err, 'error');
        }

    }, 'image/jpeg', 0.8);
};

window.closeCropModal = function() {
    document.getElementById('cropModal').style.display = 'none';
    if(cropper) cropper.destroy();
};

// Global Ajax Interceptor
document.addEventListener('submit', async function(e) {
    const form = e.target;
    const isGroupEdit = form.closest('.card-back');
    const isTargetForm = (form.id === 'toggleForm' || form.id === 'stopForm' || form.id === 'itemEditForm' || isGroupEdit);

    if (!isTargetForm) return;

    e.preventDefault();

    let submitBtn = form.querySelector('button[type="submit"]');
    let originalBtnText = submitBtn ? submitBtn.innerHTML : '保存';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="material-icons" style="animation: spin 1s linear infinite;">autorenew</i> ${ASSET_I18N.btn_processing}`;
    }

    try {
        let formData = new FormData(form);
        let response = await fetch(form.action, {
            method: 'POST',
            body: formData
        });

        let result = await response.json();

        if (result.status === 'success') {
            showToast(result.message || 'Success!', 'success');

            if (form.id === 'toggleForm' && window.closeToggleModal) closeToggleModal();
            if (form.id === 'stopForm' && window.closeStopConfirmModal) closeStopConfirmModal();
            if (form.id === 'itemEditForm' && window.closeItemEditModal) closeItemEditModal();

            if (form.action.includes('/api/request_asset')) {
                let card = form.closest('.asset-card');
                if (card) window.cancelEdit(new Event('click'), card.id);
                return;
            }

            if (isGroupEdit) {
                let card = form.closest('.asset-card');
                if (card) {
                    window.cancelEdit(new Event('click'), card.id);
                    updateCardFrontUI(card, result.data);
                }
            } else {
                updateLocalAssetItem(result.data);
            }

            let activeCard = document.querySelector('.asset-card.active');
            if (activeCard) {
                let groupId = activeCard.id.replace('card-', '');
                window.switchAssetType(groupId);
            }
        } else {
            showToast(result.message || ASSET_I18N.backend_fail, 'error');
        }
    } catch (err) {
        showToast(ASSET_I18N.net_req_fail, 'error');
        console.error("AJAX Submit Error:", err);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
});

// Memory Update
function updateLocalAssetItem(updatedItem) {
    if (!updatedItem || !updatedItem.id) return;

    for (let groupId in window.ASSET_DATA) {
        let group = window.ASSET_DATA[groupId];
        let itemIndex = group.items.findIndex(i => i.id == updatedItem.id);

        if (itemIndex !== -1) {
            Object.assign(group.items[itemIndex], updatedItem);
            return;
        }
    }
}

// UI Update
function updateCardFrontUI(cardElement, data) {
    if (!data) return;

    let titleNode = cardElement.querySelector('h3');
    if (titleNode && data.pn_2 !== undefined) {
        let pn1 = titleNode.innerText.split('|')[0].trim();
        titleNode.innerText = `${pn1} | ${data.pn_2}`;
    }

    let nameNode = cardElement.querySelector('.right-part .card-header .card-info div:nth-child(2)');
    if (nameNode && data.name !== undefined) nameNode.innerText = data.name || ASSET_I18N.unnamed;

    let descDivs = cardElement.querySelectorAll('.right-part > div:nth-child(2) span, .right-part > div:nth-child(2) div');
    if (descDivs.length >= 3) {
        if (data.description_1 !== undefined) descDivs[0].innerText = `${ASSET_I18N.category_lbl} ${data.description_1 || '-'}`;
        if (data.use_for !== undefined) descDivs[1].innerText = `${ASSET_I18N.dest_lbl} ${data.use_for || '-'}`;
        if (data.description_2 !== undefined) descDivs[2].innerText = `${ASSET_I18N.desc_lbl} ${data.description_2 || '-'}`;
    }
}