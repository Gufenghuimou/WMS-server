// Hydration Engine
window.switchAssetType = function(groupId) {
    document.querySelectorAll('.asset-card').forEach(el => el.classList.remove('active'));
    let targetCard = document.getElementById('card-' + groupId);
    if (targetCard) targetCard.classList.add('active');

    let tbody = document.getElementById('dynamicDetailTbody');
    let groupData = window.ASSET_DATA[groupId];

    // let activeSibling = groupData.items.find(i => i.is_stock && i.location && i.location.toLowerCase() !== 'none' && i.location !== '-');
    // let siblingLoc = activeSibling ? activeSibling.location.replace(/'/g, "\\'").replace(/"/g, "&quot;") : '';

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
        let statusHtml = `<span style="background: rgba(231, 76, 60, 0.15); color: #c0392b; padding: 4px 10px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; white-space: nowrap">${ASSET_I18N.status_out_stock}</span>`;
        if (item.is_stop) {
            statusHtml = `<span style="background: rgba(149, 165, 166, 0.15); color: #7f8c8d; padding: 4px 10px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; text-decoration: line-through; white-space: nowrap">${ASSET_I18N.status_stop}</span>`;
        } else if (item.is_stock) {
            statusHtml = `<span style="background: rgba(29, 185, 84, 0.15); color: #158e40; padding: 4px 10px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; white-space: nowrap">${ASSET_I18N.status_in_stock}</span>`;
        } else if (item.is_request) {
            statusHtml = `<span style="background: rgba(230, 126, 34, 0.1); color: #e67e22; padding: 4px 10px; border-radius: 12px; font-size: 0.9rem; font-weight: 600; white-space: nowrap">${ASSET_I18N.pending}</span>`;
        }

        let rawLoc = item.location ? String(item.location).trim() : '';
        let rackName = "";
        if (rawLoc && rawLoc !== '-' && rawLoc.toLowerCase() !== 'none') {
            if (rawLoc.includes('-')) {
                rackName = rawLoc.split('-')[0].toUpperCase();
            } else {
                rackName = rawLoc;
            }
            rackName = rackName.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        }

        let poTypeHtml = '';
        if (item.po_type === 'common') { poTypeHtml = '<span style="font-size: 0.9rem; color: #333333; background-color: rgba(51, 51, 51, 0.15); padding: 4px 10px; white-space: nowrap; border-radius: 12px;">Common</span>'; }
        else if (item.po_type === 'reimburse') { poTypeHtml = '<span style="font-size: 0.9rem; color: #0899C2; background-color: rgba(8, 153, 194, 0.15); padding: 4px 10px; white-space: nowrap; border-radius: 12px;">Reimburse</span>'; }
        else if (item.po_type === 'consign') { poTypeHtml = '<span style="font-size: 0.9rem; color: #C20884; background-color: rgba(194, 8, 132, 0.15); padding: 4px 10px; white-space: nowrap; border-radius: 12px;">Consign</span>'; }

        // 按钮放进模态框，5个变一个，优化性能
        let btnGroupHtml = `
            <button type="button" class="btn-primary" 
                style="background-color: #f0f2f5; color: #555; box-shadow: none; border: 1px solid #ddd; height: 28px; padding: 0 5px; border-radius: 6px; font-size: 0.75rem;" 
                onclick="openActionModal('${groupId}', ${item.id})">
            <i class="material-icons">more_horiz</i>
        </button>
        `;
        if (item.is_request) {
            btnGroupHtml = `
                <div style="height: 28px; display: inline-flex; align-items: center; justify-content: center; padding: 0 5px;">
                    <i class="material-icons" style="color: #aaa; font-size: 1.2rem;">block</i>
                </div>
            `;
        }

        return `
        <tr>
            <td style="display: flex; gap: 10px; justify-content: center; white-space: nowrap;">${btnGroupHtml}</td>
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
            <td style="font-size: 0.9rem; color: #555; white-space: nowrap;">${item.remarks || '-'}</td>
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
    document.querySelectorAll('.asset-card').forEach(card => {
        card.classList.remove('is-flipped');
        card.style.height = '';
    });

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
    }, 300);
};


// Global Ajax Interceptor
document.addEventListener('submit', async function(e) {
    const form = e.target;
    const isGroupEdit = form.closest('.card-back');
    const isTargetForm = (form.id === 'assetToggleForm' || form.id === 'stopForm' || form.id === 'assetItemEditForm' || isGroupEdit);

    if (!isTargetForm) return;

    e.preventDefault();

    let submitBtn = form.querySelector('button[type="submit"]');
    let originalBtnText = submitBtn ? submitBtn.innerHTML : '保存';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="material-icons" style="animation: spin 1s linear infinite;">autorenew</i> ${ASSET_I18N.btn_processing}`;
    }

    try {
        let response = await fetch(form.action, {
            method: 'POST',
            body: new FormData(form)
        });

        let result = await response.json();
        console.log(result);

        if (result.status === 'success') {
            showToast(result.message || 'Success!', 'success');

            if (form.id === 'assetToggleForm' && window.closeAssetToggleModal) closeAssetToggleModal();
            if (form.id === 'stopForm' && window.closeStopConfirmModal) closeStopConfirmModal();
            if (form.id === 'assetItemEditForm' && window.closeAssetItemEditModal) closeAssetItemEditModal();
            if (window.closeActionModal) window.closeActionModal();

            if (form.action.includes('/api/request_asset_by_pn')) {
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
                let updatedGroupId = updateLocalAssetItem(result.data);
                if (updatedGroupId) { window.updateMiniChartUI(updatedGroupId); }
                if (result.data && result.data.batch_po_type !== null && result.data.batch_po_type !== undefined && result.data.pn_1) {
                    let groupId = result.data.pn_1.replace(/ /g, '-').replace(/\//g, '-');
                    let group = window.ASSET_DATA[groupId];
                    if (group && group.items) {
                        group.items.forEach(i => i.po_type = result.data.batch_po_type);
                    }
                }
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
    if (!updatedItem || !updatedItem.id) return null;

    for (let groupId in window.ASSET_DATA) {
        let group = window.ASSET_DATA[groupId];
        let itemIndex = group.items.findIndex(i => i.id == updatedItem.id);

        if (itemIndex !== -1) {
            Object.assign(group.items[itemIndex], updatedItem);
            return groupId;
        }
    }
}

// UI Update
function updateCardFrontUI(cardElement, data) {
    if (!data) return;

    let titleNode = cardElement.querySelector('.info-pn1');
    if (titleNode && data.pn_2 !== undefined) {
        let pn1 = titleNode.innerText.trim();
        titleNode.innerText = `${pn1}`;
    }
    let subtitleNode = cardElement.querySelector('.info-pn2');
    if (subtitleNode) {
        subtitleNode.innerText = `${data.pn_2}`;
    }

    let nameNode = cardElement.querySelector('info-name');
    if (nameNode && data.name !== undefined) nameNode.innerText = data.name || ASSET_I18N.unnamed;

    // let descDivs = cardElement.querySelectorAll('.right-part > div:nth-child(2) span, .right-part > div:nth-child(2) div');
    let descDivs = cardElement.querySelectorAll('.info-desc1, .info-usefor, .info-desc2');

    if (descDivs.length >= 3) {
        if (data.description_1 !== undefined) descDivs[0].innerText = `${ASSET_I18N.category_lbl} ${data.description_1 || '-'}`;
        if (data.use_for !== undefined) descDivs[1].innerText = `${ASSET_I18N.dest_lbl} ${data.use_for || '-'}`;
        if (data.description_2 !== undefined) descDivs[2].innerText = `${ASSET_I18N.desc_lbl} ${data.description_2 || '-'}`;
    }
}

// 条形图渲染
window.updateMiniChartUI = function (groupId) {
    let group = window.ASSET_DATA[groupId];
    let container = document.getElementById('chart-container-' + groupId);
    if (!group || !group.items || !container) return;

    let total_qty = group.items.length;
    let broken_qty = 0;
    let used_qty = 0;
    let good_qty = 0;

    for (let i = 0; i < total_qty; i++) {
        let item = group.items[i];
        if (item.is_stop) broken_qty++;
        else if (item.is_stock) good_qty++;
        else used_qty++;
    }

    let used_pct = total_qty > 0 ? (used_qty / total_qty) * 100 : 0;
    let good_pct = total_qty > 0 ? (good_qty / total_qty) * 100 : 0;
    let broken_pct = total_qty > 0 ? (broken_qty / total_qty) * 100 : 0;
    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: bold; margin-bottom: 5px; line-height: 1;">
            <span style="color: #1db954;">${ASSET_I18N.stocking}: ${ good_qty }</span>
            <span style="color: #95a5a6;">${ASSET_I18N.stopped}: ${ broken_qty }</span>
            <span style="color: #e74c3c;">${ASSET_I18N.using}: ${ used_qty }</span>
        </div>
        <div style="width: 100%; height: 6px; background: #ecf0f1; border-radius: 4px; display: flex; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);">        
            ${good_qty > 0 ? `<div style="width: ${good_pct}%; background: rgba(29, 185, 84, 0.5); transition: 0.3s;" title="${ASSET_I18N.stocking}: ${ good_qty }"></div>` : ''}
            ${broken_qty > 0 ? `<div style="width: ${broken_pct}%; background: #95a5a6; transition: 0.3s;" title="${ASSET_I18N.stopped}: ${ broken_qty }"></div>` : ''}
            ${used_qty > 0 ? `<div style="width: ${used_pct}%; background: rgba(231, 76, 60, 0.5); transition: 0.3s;" title="${ASSET_I18N.using}: ${ used_qty }"></div>` : ''}
        </div>
    `
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch('/api/asset');
        const result = await response.json();

        if (result.status === 'success') {
            const assetData = result.data;
            window.ASSET_DATA = assetData.grouped;
            renderAssetCards(assetData.grouped);

            // 修改左下指示灯
            const indicator = document.getElementById('indicator');
            const indicatorData = assetData.stats;
            indicator.innerHTML = `
                <i class="material-icons" style="font-size: 1.45rem; color: var(--primary-green);">category</i>
                ${BASE_I18N.asset_1}:
                <span style="font-size: 1.2rem; font-weight: bold; color: var(--primary-green); margin-left: 4px;">
                    ${indicatorData.categories || 0}
                </span>
                <i class="material-icons" style="font-size: 1.45rem; color: var(--primary-green); margin-left: 15px;">devices</i>
                ${BASE_I18N.asset_2}:
                <span style="font-size: 1.2rem; font-weight: bold; color: var(--primary-green); margin-left: 4px;">
                    ${indicatorData.total || 0}
                </span>
            `;
        }
    } catch (error) {
        console.error("Data Loaded Fail", error);
        document.getElementById('assetCardList').innerHTML = `<div style="text-align:center; color:red;">加载失败，请刷新重试</div>`;
    } finally {
        if (typeof window.hideGlobalLoader === 'function') {
            setTimeout(window.hideGlobalLoader, 50);
        }
    }
});

function renderAssetCards(data) {
    const isAdmin = (window.USER_ROLE === 'superadmin' || window.USER_ROLE === 'admin');
    const listContainer = document.getElementById('assetCardList');
    const groupKeys = Object.keys(data).sort((a, b) => a.localeCompare(b));

    if (groupKeys.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; color: #999;">
                <i class="material-icons" style="font-size: 3rem; opacity: 0.5;">inbox</i>
                <p>暂无数据</p>
            </div>`;
        return;
    }

    let htmlString = '';
    let count = 0;

    for (let groupId of groupKeys) {
        
        let group = data[groupId];
        let first = group.items[0]; // 获取组内第一个物品用于封面展示
        
        // 计算库存状态
        let total_qty = group.items.length;
        let broken_qty = 0; let used_qty = 0; let good_qty = 0;
        for (let i = 0; i < total_qty; i++) {
            if (group.items[i].is_stop) broken_qty++;
            else if (group.items[i].is_stock) good_qty++;
            else used_qty++;
        }
        let good_pct = total_qty > 0 ? (good_qty / total_qty) * 100 : 0;
        let broken_pct = total_qty > 0 ? (broken_qty / total_qty) * 100 : 0;
        let used_pct = total_qty > 0 ? (used_qty / total_qty) * 100 : 0;

        let btnHtml = `
                <button type="button" class="btn-primary" style="height: 26px; font-size: 0.75rem; padding: 0 10px; border-radius: 6px; background: transparent; color: ${isAdmin ? 'var(--text-muted)' : 'var(--primary-blue)'}; border: 1px solid ${isAdmin ? '#ccc' : 'var(--primary-blue)'}; box-shadow: none;" onclick="flipToEdit(event, 'card-${groupId}')">
                    <i class="material-icons" style="font-size: 0.9rem;">${isAdmin ? 'edit' : 'add_shopping_cart'}</i> ${isAdmin ? ASSET_I18N.btn_edit : ASSET_I18N.btn_require}
                </button>
            `;

        let imgChangeLabel = `<label style="font-size:0.75rem; color:#888; text-align:center;"> ${isAdmin ? ASSET_I18N.click_to_change_img : ''}</label>`;

        let cardBackForm = null;
        if (isAdmin) {
            cardBackForm = `
                <form method="post" action="/asset_edit_group/${ group.pn1 }" class="admin-edit-form" style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                    <div class="edit-form-grid">
                        <div><label class="edit-label">${ASSET_I18N.edit_pn1}</label><input type="text" name="pn_1" class="edit-input" value="${ group.pn1 }" readonly style="background:#eee; cursor:not-allowed; color:#888;"></div>
                        <div><label class="edit-label">${ASSET_I18N.edit_pn2}</label><input type="text" name="pn_2" class="edit-input" value="${ group.pn2 || '' }"></div>
                        <div><label class="edit-label">${ASSET_I18N.edit_dest}</label><input type="text" name="use_for" class="edit-input" value="${ group.use_for || '' }"></div>

                        <div style="grid-column: span 3;"><label class="edit-label">${ASSET_I18N.edit_name}</label><input type="text" name="name" class="edit-input" value="${ group.name || '' }"></div>

                        <div style="grid-column: span 1;"><label class="edit-label">${ASSET_I18N.edit_desc1}</label><input type="text" name="description_1" class="edit-input" value="${ group.description_1 || '' }"></div>
                        <div style="grid-column: span 2;"><label class="edit-label">${ASSET_I18N.edit_desc2}</label><input type="text" name="description_2" class="edit-input" value="${ group.description_2 || '' }"></div>

                        <div style="grid-column: span 1;"><label class="edit-label">Model</label><input type="text" name="model" class="edit-input" value="${ group.model || '' }"></div>
                        <div style="display: flex; gap: 8px; grid-column: span 2; align-items: end; justify-content: flex-end;">
                            <button type="button" class="btn-primary" style="background: #e0e0e0; color: #333; box-shadow: none;" onclick="cancelEdit(event, 'card-${groupId}')">${ASSET_I18N.btn_cancel}</button>
                            <button type="submit" class="btn-primary" style="background: #1db954;">${ASSET_I18N.btn_save}</button>
                        </div>
                    </div>
                </form>
            `;
        } else {
            cardBackForm = `
                <form method="post" action="/api/request_asset_by_pn/${group.pn1}" class="require-form" style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                    <input type="hidden" name="matter" value="require">
                    <div class="edit-form-grid" style="grid-template-columns: 1fr 1fr;">
                        <div style="grid-column: span 2; margin-bottom: 5px;">
                            <h4 style="margin: 0; color: var(--primary-blue); font-size: 1.1rem; display: flex; align-items: center; gap: 5px;">
                                <i class="material-icons">add_shopping_cart</i> ${ASSET_I18N.submit_requirement}
                            </h4>
                        </div>

                        <div><label class="edit-label"> ${ASSET_I18N.required_qty} <span style="color:red;">*</span></label><input type="number" name="req_qty" class="edit-input" min="1" required></div>
                        <div><label class="edit-label"> ${ASSET_I18N.target_location} <span style="color:red;">*</span></label><input type="text" name="department" class="edit-input" required></div>
                        <div style="grid-column: span 2;"><label class="edit-label"> ${ASSET_I18N.note} </label><input type="text" name="note" class="edit-input"></div>

                        <div style="display: flex; gap: 8px; grid-column: span 2; align-items: end; justify-content: flex-end; margin-top: 15px;">
                            <button type="button" class="btn-primary" style="background: #e0e0e0; color: #333; box-shadow: none;" onclick="cancelEdit(event, 'card-${groupId}')">${ASSET_I18N.btn_cancel}</button>
                            <button type="submit" class="btn-primary" style="background: var(--primary-blue);">${ASSET_I18N.btn_save}</button>
                        </div>
                    </div>
                </form>
            `;
        }


        // 拼接搜索关键字
        let itemKeys = group.items.map(item => `${item.ctrl_no} ${item.location || ''}`).join(' ');
        let searchKeys = `${group.pn1} ${group.pn2 || ""} ${group.name || ''} ${group.description_1 || ''} ${itemKeys}`.toLowerCase();

        htmlString += `
        <div class="asset-card" id="card-${groupId}" onclick="switchAssetType('${groupId}')" data-search-keys="${searchKeys}">
            <div class="card-front">
                <!-- 左侧图片部分 -->
                <div class="left-part" style="flex-shrink: 0;">
                    <img class="card-img" 
                         src="${group.has_image ? `/static/asset_images/${group.pn1}.jpg?t=${window.SYS_VER}` : 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}" 
                         style="display: ${group.has_image ? 'block' : 'none'}; cursor: pointer;" 
                         loading="lazy" 
                         onclick="openShowImgModal('${groupId}', '${group.pn1}', '${group.name}')"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    
                    <div class="card-img" style="display: ${group.has_image ? 'none' : 'flex'}; justify-content:center; align-items:center; background:#f8f9fa;">
                        <i class="material-icons" style="font-size:2.2rem; color:#dcdcdc;">add_photo_alternate</i>
                    </div>
                </div>
                <!-- 右侧信息部分 -->
                <div class="right-part" style="flex: 1; min-width: 0;">
                    <div class="card-header">
                        <div class="card-info">
                            <div style="display:flex; justify-content:space-between;">
                                <div style="display: flex; gap: 15px; align-items: baseline">
                                    <h3 class="text-truncate font-monospace info-pn1" style="margin:0 0 4px 0; font-size:1.5rem; font-weight: bold; color: var(--text-main); max-width: 300px;">${group.pn1}</h3>
                                    <h3 class="text-truncate font-monospace info-pn2" style="margin:0 0 4px 0; font-size:1.35rem; font-weight: s; color: var(--text-main); max-width: 300px;">${group.pn2 || ""}</h3>
                                </div>
                                <span style="font-size: 1.2rem; font-weight: bold; color: #2980b9; background: #eef2f5; padding: 2px 12px; border-radius: 10px; display: flex; align-items: center">${ total_qty }</span>
                            </div>
                            <div class="text-truncate info-name" style="font-size: 0.9rem; font-weight: 500;" title="${ group.name }">${ group.name || ASSET_I18N.dest_lbl }</div>
                        </div>
                    </div>

                    <div style="font-size: 0.8rem; color: #666; margin-top: 4px; line-height: 1.5;">
                        <div style="display:flex; justify-content:space-between;">
                            <span class="text-truncate info-desc1" style="max-width: 300px;" title="${ group.description_1 }">${ASSET_I18N.category_lbl} ${ group.description_1 || '-' }</span>
                            <span class="text-truncate info-usefor" style="max-width: 300px; color: var(--primary); font-weight: 600;" title="${ group.use_for }">${ASSET_I18N.dest_lbl} ${ group.use_for || '-' }</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span class="text-truncate info-desc2" style="max-width: 300px;" title="${ group.description_2 }">${ASSET_I18N.desc_lbl} ${ group.description_2 || '-' }</span>
                            <span class="text-truncate info-model" style="max-width: 300px; color: var(--primary-blue); font-weight: 600;" title="model">MODEL: ${ group.model || '-' }</span>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; border-top: 1px dashed #eee; padding-top: 5px;">

                        <!-- Minichart部分 -->
                        <div id="chart-container-${groupId}" style="flex: 1; margin-right: 20px; display: flex; flex-direction: column; justify-content: center;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: bold; margin-bottom: 5px; line-height: 1;">
                                <span style="color: #1db954;">${ASSET_I18N.stocking}: ${ good_qty }</span>
                                <span style="color: #95a5a6;">${ASSET_I18N.stopped}: ${ broken_qty }</span>
                                <span style="color: #e74c3c;">${ASSET_I18N.using}: ${ used_qty }</span>
                            </div>
                            <div style="width: 100%; height: 6px; background: #ecf0f1; border-radius: 4px; display: flex; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);">
                                ${good_qty > 0 ? `<div style="width: ${good_pct}%; background: rgba(29, 185, 84, 0.5);"></div>` : ''}
                                ${broken_qty > 0 ? `<div style="width: ${broken_pct}%; background: #95a5a6;"></div>` : ''}
                                ${used_qty > 0 ? `<div style="width: ${used_pct}%; background: rgba(231, 76, 60, 0.5);"></div>` : ''}
                            </div>
                        </div>
                        ${btnHtml}
                    </div>
                </div>
            </div>

            <div class="card-back" onclick="event.stopPropagation();">
                <div style="width: 130px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    ${imgChangeLabel}
                    <div style="position:relative; cursor:pointer;" onclick="document.getElementById('edit-upload-${first.id}').click();">

                        <img id="edit-preview-${first.id}" class="card-img" style="display:${!group.has_image ? 'none' : 'flex'}; width:130px; height:130px; border-radius:8px; object-fit:cover; border: 1px solid #ddd;"
                                src="${ group.has_image ? `/static/asset_images/${ group.pn1 }.jpg?t=${window.SYS_VER}` : 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}" loading="lazy"
                                onerror="this.style.display='none'; document.getElementById('edit-placeholder-${first.id}').style.display='flex';">

                        <div id="edit-placeholder-${first.id}" class="card-img" style="display:${group.has_image ? 'none' : 'flex'}; justify-content: center; align-items: center; background: #f8f9fa; color: #dcdcdc; border: 1px dashed #ddd; width:130px; height:130px; border-radius:8px;">
                            <i class="material-icons" style="font-size: 2.2rem;">${group.has_image ? 'inventory_2' : 'add_photo_alternate'}</i>
                        </div>

                        <div style="position:absolute; bottom:5px; right:5px; background:rgba(0,0,0,0.5); color:#fff; border-radius:50%; width:24px; height:24px; display:flex; justify-content:center; align-items:center;"><i class="material-icons" style="font-size: 14px;">photo_camera</i></div>
                    </div>
                    ${isAdmin ? `<input type="file" id="edit-upload-${first.id}" style="display:none;" accept="image/*" onchange="uploadCardImage(this, '${group.pn1}', '${first.id}')">` : ''}
                </div>
                ${cardBackForm}
            </div>
        </div>`;
        count++;
    }

    // 一次性渲染到页面中
    listContainer.innerHTML = htmlString;
    
    // 默认点开第一张卡片
    let firstCard = document.querySelector('.asset-card');
    if (firstCard) firstCard.click();
}