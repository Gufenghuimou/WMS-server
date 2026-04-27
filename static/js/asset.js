// ==========================================
// 🌟 极速卡片联动与渲染引擎 (Hydration)
// ==========================================
window.switchAssetType = function(groupId) {

    // 1. 移除所有卡片的高亮态，并高亮当前点击的卡片
    document.querySelectorAll('.asset-card').forEach(el => el.classList.remove('active'));
    let targetCard = document.getElementById('card-' + groupId);
    if (targetCard) targetCard.classList.add('active');

    let tbody = document.getElementById('dynamicDetailTbody');

    // 2. 🌟 从全局极速数据源拉取当前组数据
    let groupData = window.ASSET_DATA[groupId];

    // 如果没有数据，直接在表格内渲染空状态
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

    // 3. ⚡️ 极速渲染核心表格数据
    let rowsHtml = groupData.items.map(item => {
        // 状态计算
        let statusHtml = '';
        if (item.is_stop) {
            statusHtml = `<span style="background: rgba(149, 165, 166, 0.15); color: #7f8c8d; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; text-decoration: line-through; white-space: nowrap">${ASSET_I18N.status_stop}</span>`;
        } else if (item.is_stock) {
            statusHtml = `<span style="background: rgba(29, 185, 84, 0.15); color: #158e40; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; white-space: nowrap">${ASSET_I18N.status_in_stock}</span>`;
        } else {
            statusHtml = `<span style="background: rgba(231, 76, 60, 0.15); color: #c0392b; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; white-space: nowrap">${ASSET_I18N.status_out_stock}</span>`;
        }

        // 处理可能存在的单引号，防止打破 onclick 方法
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
        if (item.po_type === 'common') { poTypeHtml = '<span style="font-size: 0.7rem; color: #333333; border: none;">Common</span>'; }
        else if (item.po_type === 'reimburse') { poTypeHtml = '<span style="font-size: 0.7rem; color: #158e40; border: none;">Reimburse</span>'; }
        else if (item.po_type === 'consign') { poTypeHtml = '<span style="font-size: 0.7rem; color: #a0522d; border: none;">Consign</span>'; }

        // 领用/归还按钮 (按钮1)
        let btn1Bg = !item.is_stock ? '#1db954' : '#f39c12';
        let btn1Icon = item.is_stock ? 'output' : 'keyboard_return';
        let btn1Text = item.is_stock ? ASSET_I18N.btn_take_out : ASSET_I18N.btn_return_in;
        let btn1 = `<button type="button" class="btn-primary btn-sm" style="background-color: ${btn1Bg}; width: 100px; ${disabledStyle}" onclick="openToggleModal(${item.id}, '${isStockStr}')"><i class="material-icons">${btn1Icon}</i> ${btn1Text}</button>`;

        // 个体编辑按钮 (按钮2)
        let btn2 = `<button type="button" class="btn-primary btn-sm" style="background-color: #aaaaaa; ${disabledStyle}" onclick="openItemEditModal(${item.id}, '${safeCtrl}', '${safeLoc}', '${safeDate}', '${safePoType}')"><i class="material-icons">edit_note</i> ${ASSET_I18N.btn_edit}</button>`;

        // 停用/复用按钮 (按钮3)
        let btn3 = '';
        if (!item.is_stop && !item.is_stock) {
            btn3 = `<button type="button" class="btn-primary btn-sm" style="width: 85px; background-color: #bdc3c7; color: #fff; box-shadow: none;" onclick="alert('${ASSET_I18N.btn_stop_deny}')"><i class="material-icons">do_not_disturb</i> ${ASSET_I18N.btn_stop}</button>`;
        } else {
            let btn3Bg = item.is_stop ? '#95a5a6' : 'var(--danger-red)';
            let btn3Icon = item.is_stop ? 'settings_backup_restore' : 'do_not_disturb';
            let btn3Text = item.is_stop ? ASSET_I18N.btn_reuse : ASSET_I18N.btn_stop;
            btn3 = `<button type="button" class="btn-primary btn-sm" style="width: 85px; background-color: ${btn3Bg};" onclick="openStopConfirmModal(${item.id}, '${safeCtrl}', '${isStopStr}')"><i class="material-icons">${btn3Icon}</i> ${btn3Text}</button>`;
        }

        // 组装最终 HTML
        return `
        <tr>
            <td class="font-monospace" style="font-weight: 600; font-size: 1.15rem;">${item.ctrl_no}</td>
            <td>
                <span style="cursor:pointer; color:var(--primary); font-weight: 500; display: inline-flex; align-items: center; gap: 4px;" 
                      onclick="event.stopPropagation(); if(window.openFooterMap && '${rackName}') window.openFooterMap('${rackName}');">
                    <i class="material-icons" style="font-size: 1rem;">place</i>
                    ${rawLoc || ASSET_I18N.loc_unassigned}
                </span>
            </td>
            <td style="font-size: 0.9rem; color: #555;">${item.first_in_date || '-'}</td>
            <td>${statusHtml}</td>
            <td style="font-size: 0.75rem;">${poTypeHtml}</td>
            <td style="display: flex; gap: 10px; justify-content: center;">
                ${btn1}
                ${btn2}
                ${btn3}
            </td>
        </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;
};

// ==========================================
// 3. 智能出借/归还模态框控制引擎
// ==========================================
window.openToggleModal = function(itemId, isStockStr) {
    const modal = document.getElementById('toggleModal');
    const form = document.getElementById('toggleForm');
    const hintBox = document.getElementById('toggleHintBox');
    const locInput = document.getElementById('locInput');
    const title = document.getElementById('toggleTitle');

    form.action = `/asset_out/${itemId}`;
    locInput.value = '';

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

    modal.style.display = 'flex';
    setTimeout(() => locInput.focus(), 100);
};

window.closeToggleModal = function() {
    document.getElementById('toggleModal').style.display = 'none';
};

// ==========================================
// 🌟 停用/复用 模态框控制引擎 (纯净版)
// ==========================================
window.openStopConfirmModal = function(itemId, ctrlNo, isStopStr) {
    const modal = document.getElementById('stopConfirmModal');
    const form = document.getElementById('stopForm');
    const title = document.getElementById('stopModalTitle');
    const text = document.getElementById('stopModalText');
    const icon = document.getElementById('stopModalIcon');
    const submitBtn = document.getElementById('stopSubmitBtn');
    const radio = document.getElementById('raisonRadio')

    form.action = `/api/asset_stop_toggle/${itemId}`;

    if (isStopStr === 'True') {
        icon.innerHTML = '<i class="material-icons" style="font-size: 3.5rem; color: #1db954;">settings_backup_restore</i>';
        title.innerText = ASSET_I18N.stop_reuse_title;
        text.innerHTML = ASSET_I18N.stop_reuse_text.replace('{ctrlNo}', ctrlNo);
        radio.style.visibility = 'hidden';
        submitBtn.style.backgroundColor = '#1db954';
        submitBtn.innerHTML = `<i class="material-icons">check_circle</i> ${ASSET_I18N.btn_reuse}`;
    } else {
        icon.innerHTML = '<i class="material-icons" style="font-size: 3.5rem; color: var(--danger-red);">do_not_disturb_on</i>';
        title.innerText = ASSET_I18N.stop_freeze_title;
        text.innerHTML = ASSET_I18N.stop_freeze_text.replace('{ctrlNo}', ctrlNo);
        radio.style.visibility = 'visible';
        submitBtn.style.backgroundColor = 'var(--danger-red)';
        submitBtn.innerHTML = `<i class="material-icons">block</i> ${ASSET_I18N.btn_stop}`;
    }

    modal.style.display = 'flex';
};

window.closeStopConfirmModal = function() {
    document.getElementById('stopConfirmModal').style.display = 'none';
};

// ==========================================
// 🌟 紧凑型个体属性编辑模态框
// ==========================================
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

// 监听事件：ESC键关闭
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if(window.closeToggleModal) window.closeToggleModal();
        if(window.closeStopConfirmModal) window.closeStopConfirmModal();
        if(window.closeItemEditModal) window.closeItemEditModal();
    }
});

// ==========================================
// 页面初始化及全局事件绑定
// ==========================================
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

// ==========================================
// 🌟 3D 卡片翻转引擎与动态高度适应
// ==========================================
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

// ==========================================
// 🌟 局部的无感图片上传引擎
// ==========================================
window.uploadCardImage = async function(inputElem, pn1, itemId) {
    if (!inputElem.files || inputElem.files.length === 0) return;

    let formData = new FormData();
    formData.append('file', inputElem.files[0]);

    try {
        let res = await fetch(`/api/asset_upload_image/${encodeURIComponent(pn1)}`, {
            method: 'POST',
            body: formData
        });
        let data = await res.json();

        if (data.status === 'success') {
            let previewBack = document.getElementById(`edit-preview-${itemId}`);
            let placeholderBack = document.getElementById(`edit-placeholder-${itemId}`);
            if (previewBack) {
                previewBack.src = data.url;
                previewBack.style.display = 'block';
            }
            if (placeholderBack) placeholderBack.style.display = 'none';

            let cardFront = document.getElementById(`card-${pn1.replace(/ /g, '-').replace(/\//g, '-')}`);
            if (cardFront) {
                let imgFront = cardFront.querySelector('.left-part img.card-img');
                let placeholderFront = cardFront.querySelector('.left-part div.card-img');

                if (imgFront) {
                    imgFront.src = data.url;
                    imgFront.style.display = 'block';
                }
                if (placeholderFront) placeholderFront.style.display = 'none';
            }
        } else {
            alert(ASSET_I18N.upload_fail);
        }
    } catch(e) {
        alert(ASSET_I18N.upload_net_err);
    }
};

// ==========================================
// 🌟 全局无刷新表单拦截引擎 (Ajax 核心)
// ==========================================
document.addEventListener('submit', async function(e) {
    const form = e.target;

    // 判断是否是我们想要拦截的核心表单
    const isGroupEdit = form.closest('.card-back'); // 判断是否是左侧卡片翻转后的群体编辑表单
    const isTargetForm = (form.id === 'toggleForm' || form.id === 'stopForm' || form.id === 'itemEditForm' || isGroupEdit);

    if (!isTargetForm) return; // 如果不是这些表单，放行（比如搜索框等）

    e.preventDefault(); // 🛑 核心：阻断浏览器默认的整体页面刷新行为！

    // 按钮 Loading 状态
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

            // 1. 关掉所有可能开着的模态框
            if (form.id === 'toggleForm' && window.closeToggleModal) closeToggleModal();
            if (form.id === 'stopForm' && window.closeStopConfirmModal) closeStopConfirmModal();
            if (form.id === 'itemEditForm' && window.closeItemEditModal) closeItemEditModal();

            // 2. ⚡️ 黑科技：篡改内存中的 window.ASSET_DATA
            if (isGroupEdit) {
                // 如果是群体更新（卡片翻转表单）
                let card = form.closest('.asset-card');
                if (card) {
                    window.cancelEdit(new Event('click'), card.id); // 自动翻转回正面
                    updateCardFrontUI(card, result.data); // 无感刷新左侧卡片文字
                }
            } else {
                // 如果是单体更新（出入库、停用、个体属性）
                updateLocalAssetItem(result.data);
            }

            // 3. 瞬间重绘右侧表格！
            let activeCard = document.querySelector('.asset-card.active');
            if (activeCard) {
                let groupId = activeCard.id.replace('card-', '');
                window.switchAssetType(groupId); // 重新触发你的极速渲染引擎
            }

        } else {
            alert(result.message || ASSET_I18N.backend_fail);
        }
    } catch (err) {
        alert(ASSET_I18N.net_req_fail);
        console.error("AJAX Submit Error:", err);
    } finally {
        // 恢复按钮状态
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
});

// ⚡️ 内存篡改器：更新单体资产
function updateLocalAssetItem(updatedItem) {
    if (!updatedItem || !updatedItem.id) return;

    // 遍历 ASSET_DATA 字典，找对应 ID 的物体
    for (let groupId in window.ASSET_DATA) {
        let group = window.ASSET_DATA[groupId];
        let itemIndex = group.items.findIndex(i => i.id == updatedItem.id);

        if (itemIndex !== -1) {
            // 将后端的最新数据直接覆盖到内存对象上
            Object.assign(group.items[itemIndex], updatedItem);
            return; // 找到就退出循环，追求极致性能
        }
    }
}

// ⚡️ DOM 篡改器：无感更新左侧卡片表面文字
function updateCardFrontUI(cardElement, data) {
    if (!data) return;

    // 更新标题 PN2
    let titleNode = cardElement.querySelector('h3');
    if (titleNode && data.pn_2 !== undefined) {
        let pn1 = titleNode.innerText.split('|')[0].trim();
        titleNode.innerText = `${pn1} | ${data.pn_2}`;
    }

    // 更新品名
    let nameNode = cardElement.querySelector('.right-part .card-header .card-info div:nth-child(2)');
    if (nameNode && data.name !== undefined) nameNode.innerText = data.name || ASSET_I18N.unnamed;

    // 更新 分类/去向/描述
    let descDivs = cardElement.querySelectorAll('.right-part > div:nth-child(2) span, .right-part > div:nth-child(2) div');
    if (descDivs.length >= 3) {
        if (data.description_1 !== undefined) descDivs[0].innerText = `${ASSET_I18N.category_lbl} ${data.description_1 || '-'}`;
        if (data.use_for !== undefined) descDivs[1].innerText = `${ASSET_I18N.dest_lbl} ${data.use_for || '-'}`;
        if (data.description_2 !== undefined) descDivs[2].innerText = `${ASSET_I18N.desc_lbl} ${data.description_2 || '-'}`;
    }
}