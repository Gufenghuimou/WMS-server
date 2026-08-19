window.openMobileUploadAuth = async function(event) {
    let btn = event.currentTarget;
    let originalHtml = btn.innerHTML;

    // 按钮变成加载状态
    btn.innerHTML = `<i class="material-icons" style="font-size: 1.2rem; animation: spin 1s linear infinite;">autorenew</i> ${MODAL_I18N.generating}`;
    btn.disabled = true;

    try {
        // ⚠️ 注意：这里向后端请求 Token，你需要确保后端写了这个接口！
        let res = await fetch('/api/generate_mobile_token', { method: 'POST' });
        let data = await res.json();

        if (data.status === 'success' && data.token) {
            // 拼接移动端专属页面的 URL (包含 token 身份验证)
            let currentHost = window.location.host
            let mobileUrl = `https://${currentHost}/mobile/login?token=${data.token}`;

            // 清空并生成新的二维码
            let canvas = document.getElementById('qrcodeCanvas');
            new QRious({
                element: canvas,
                value: mobileUrl,
                size: 220,
                level: 'H'
            });

            // 呼出弹窗
            document.getElementById('qrModal').style.display = 'flex';
        } else {
            alert(MODAL_I18N.auth_fail + (data.message || MODAL_I18N.unknown_error));
        }
    } catch(e) {
        console.error(e);
        alert(MODAL_I18N.network_error_qr);
    } finally {
        // 恢复按钮状态
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
};

window.closeQrModal = function() {
    document.getElementById('qrModal').style.display = 'none';
};

// qrModal控制结束

// cropModal控制开始

let cropper = null;
let currentCropContext = { pn1: null, itemId: null };

// Open asset cropModal
window.uploadCardImage = function(inputElem, pn1, itemId) {
    if (!inputElem.files || inputElem.files.length === 0) return;

    let file = inputElem.files[0];
    let reader = new FileReader();

    currentCropContext.pn1 = pn1;
    currentCropContext.itemId = itemId;

    reader.onload = function(e) {
        document.getElementById('cropImageTarget').src = e.target.result;
        document.getElementById('cropModal').style.display = 'flex';

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
                showToast(MODAL_I18N.upload_fail, 'error');
            }
        } catch(e) {
            showToast(MODAL_I18N.upload_net_err, 'error');
        }

    }, 'image/jpeg', 0.8);
};

// Open inventory cropModal

window.handleImageSelect = function(event) {
    let file = event.target.files[0];
    if (!file) return;

    let reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('cropImageTarget').src = e.target.result;
        document.getElementById('cropModal').style.display = 'block';

        if (cropper) { cropper.destroy(); }

        let image = document.getElementById('cropImageTarget');
        cropper = new Cropper(image, {
            aspectRatio: 16 / 9,
            viewMode: 1,
            autoCropArea: 0.9,
            dragMode: 'move',
        });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
};

window.confirmCrop = function() {
    if (!cropper) return;

    cropper.getCroppedCanvas({
        maxWidth: 800,
        maxHeight: 800,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
    }).toBlob(function(blob) {
        let formData = new FormData();
        formData.append('file', blob, 'image.jpg');

        fetch(`/api/upload_image/${window.currentEditItemId}`, {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') {
                closeCropModal();
                showToast(data.message, 'success');
                let freshUrl = data.url + '?t=' + new Date().getTime();

                let imgPreview = document.getElementById('editImagePreview');
                imgPreview.src = freshUrl;
                imgPreview.style.display = 'block';
                document.getElementById('editImagePlaceholder').style.display = 'none';

                let cardImg = document.querySelector(`.card-item-img[data-itemid="${window.currentEditItemId}"]`);
                if (cardImg) {
                    cardImg.src = freshUrl;
                    cardImg.style.display = 'block';
                    cardImg.nextElementSibling.style.display = 'none';
                }
            }
        })
        .catch(err => alert(MODAL_I18N.upload_fail + err));

    }, 'image/jpeg', 0.8);
};

window.closeCropModal = function() {
    document.getElementById('cropModal').style.display = 'none';
    if(cropper) cropper.destroy();
};

// cropModal控制结束

// 滑动报废Modal控制开始
// 定义滑动报废变量
let isDraggingSlider = false;
let startX = 0;
let maxDrag = 0;
const ZOOM_LEVEL = 0.67;

// 滑动删除

window.openScrapModal = function(itemId) {
    const modal = document.getElementById('scrapModal');
    const form = document.getElementById('scrapForm');

    let currentPage = document.querySelector('.nav-item.active');
    // console.log(currentPage);
    if (currentPage.getAttribute('href') === '/all') {
        form.action = `/delete/${itemId}`;
    } else if (currentPage.getAttribute('href') === '/simcard') {
        form.action = `/simcard_delete/${itemId}`;
    }

    resetSlider();
    modal.style.display = 'flex';

    const handle = document.getElementById('sliderHandle');
    const container = document.getElementById('sliderContainer');
    maxDrag = container.clientWidth - handle.clientWidth - 6;

    handle.onmousedown = startSlide;
}

window.closeScrapModal = function() {
    document.getElementById('scrapModal').style.display = 'none';
    resetSlider();
    isDraggingSlider = false;
    document.onmousemove = null;
    document.onmouseup = null;
}

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

// 滑动报废控制结束

// Asset 操作按钮模态框控制开始
window.openActionModal = function(groupId, itemId) {
    let groupData = window.ASSET_DATA[groupId];
    let item = groupData.items.find(i => i.id === itemId);
    if (!item) return;

    // 2. 准备安全字符串
    let safePn = groupData.pn1 ? String(groupData.pn1).replace(/'/g, "\\'") : '';
    let safeCtrl = item.ctrl_no.replace(/'/g, "\\'");
    let rawLoc = item.location ? String(item.location).trim() : '';
    let safeLoc = rawLoc.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    let safeDate = item.first_in_date ? item.first_in_date.replace(/'/g,"\\'"): '';
    let safePoType = item.po_type ? String(item.po_type).replace(/'/g, "\\'") : '';
    let isStockStr = item.is_stock ? 'True' : 'False';
    let isStopStr = item.is_stop ? 'True' : 'False';
    let disabledStyle = item.is_stop ? 'opacity: 0.5; pointer-events: none;' : '';

    let activeSibling = groupData.items.find(i => i.is_stock && i.location && i.location.toLowerCase() !== 'none' && i.location !== '-');
    let siblingLoc = activeSibling ? activeSibling.location.replace(/'/g, "\\'").replace(/"/g, "&quot;") : '';
    let rackName = rawLoc.includes('-') ? rawLoc.split('-')[0].toUpperCase() : rawLoc;
    rackName = rackName.replace(/'/g, "\\'").replace(/"/g, "&quot;");

    // 3. 更新弹窗里的标题
    document.getElementById('actionModalCtrlNo').innerText = `Ctrl No: ${item.ctrl_no}`;

    // 4. 根据权限和状态动态生成 5 个按钮（因为现在在模态框里，按钮可以做成宽按钮，更好看）
    const isAdmin = (window.USER_ROLE === 'superadmin' || window.USER_ROLE === 'admin');
    let btnGroupHtml = '';

    if (isAdmin) {
        let btn1Bg = !item.is_stock ? '#1db954' : '#f39c12';
        let btn1Icon = item.is_stock ? 'output' : 'login';
        let btn1Text = item.is_stock ? ASSET_I18N.btn_take_out : ASSET_I18N.btn_return_in;
        let btn1 = `<button class="btn-primary" style="background-color: ${btn1Bg}; ${disabledStyle}; width:100%; display:flex; justify-content:center; align-items:center; gap:8px;" onclick="closeActionModal(); openAssetToggleModal(${item.id}, '${isStockStr}', '${safeCtrl}', false, '', '${siblingLoc}')"><i class="material-icons">${btn1Icon}</i> ${btn1Text}</button>`;

        let btn2 = `<button class="btn-primary" style="background-color: #3498db; width:100%; display:flex; justify-content:center; align-items:center; gap:8px;" onclick="closeActionModal(); openAssetItemEditModal(${item.id}, '${safePn}', '${safeCtrl}', '${safeLoc}', '${safeDate}', '${safePoType}')"><i class="material-icons">edit_note</i> ${ASSET_I18N.btn_edit}</button>`;
        
        let btn3 = '';
        if (!item.is_stop && !item.is_stock) {
            btn3 = `<button class="btn-primary" style="background-color: #bdc3c7; color: #fff; width:100%; display:flex; justify-content:center; align-items:center; gap:8px;" onclick="alert(ASSET_I18N.btn_stop_deny)"><i class="material-icons">do_not_disturb</i> ${ASSET_I18N.btn_stop}</button>`;
        } else {
            let btn3Bg = item.is_stop ? '#95a5a6' : 'var(--danger-red)';
            let btn3Icon = item.is_stop ? 'settings_backup_restore' : 'do_not_disturb';
            let btn3Text = item.is_stop ? ASSET_I18N.btn_reuse : ASSET_I18N.btn_stop;
            btn3 = `<button class="btn-primary" style="background-color: ${btn3Bg}; width:100%; display:flex; justify-content:center; align-items:center; gap:8px;" onclick="closeActionModal(); openStopConfirmModal(${item.id}, '${safeCtrl}', '${isStopStr}', false, '${siblingLoc}')"><i class="material-icons">${btn3Icon}</i> ${btn3Text}</button>`;
        }
        btnGroupHtml = btn1 + btn2 + btn3;
    } else {
        if (!item.is_stock && !item.is_stop) {
            let btn4 = `<button class="btn-primary" style="background-color: #1db954; width:100%; display:flex; justify-content:center; align-items:center; gap:8px;" onclick="closeActionModal(); openToggleModal(${item.id}, 'False', '${safeCtrl}', true, '${rackName}', '')"><i class="material-icons">assignment_return</i> ${ASSET_I18N.request_return_title}</button>`;
            let btn5 = `<button class="btn-primary" style="background-color: var(--danger-red); width:100%; display:flex; justify-content:center; align-items:center; gap:8px;" onclick="closeActionModal(); openStopConfirmModal(${item.id}, '${safeCtrl}', 'False', true, '${rackName}')"><i class="material-icons">build</i> ${ASSET_I18N.report_broken_title}</button>`;
            btnGroupHtml = btn4 + btn5;
        } else {
            btnGroupHtml = `<span style="font-size:0.9rem; color:#aaa; padding: 20px 0;">${ASSET_I18N.no_actions}</span>`;
        }
    }

    // 5. 注入按钮并显示模态框
    document.getElementById('actionModalButtons').innerHTML = btnGroupHtml;
    document.getElementById('actionModal').style.display = 'flex';
}

window.closeActionModal = function() {
    document.getElementById('actionModal').style.display = 'none';
};

// Asset 操作按钮模态框控制结束

// Asset出入库Modal控制

window.openAssetToggleModal = function(itemId, isStockStr, ctrlNo, isUserRequest = false, defaultRack = '', originalLoc = '') {
    const modal = document.getElementById('assetToggleModal');
    const form = document.getElementById('assetToggleForm');
    const hintBox = document.getElementById('assetToggleHintBox');
    const locInput = document.getElementById('assetLocInput');
    const title = document.getElementById('assetToggleTitle');
    const adminLocBox = locInput.parentElement;
    const userFieldsBox = document.getElementById('toggleUserFields');
    const toggleDeptInput = document.getElementById('toggleDept');

    if (isUserRequest) {
        form.action = `/api/request_asset/${ctrlNo}`;
        title.innerHTML = `<i class="material-icons" style="color:#1db954;">assignment_return</i> ${MODAL_I18N.request_return_title}`;
        hintBox.innerHTML = `${MODAL_I18N.request_return} <strong>${ctrlNo}</strong>.`;
        adminLocBox.style.display = 'none';
        locInput.required = false;
        userFieldsBox.style.display = 'block';
        toggleDeptInput.required = true;
        toggleDeptInput.value = defaultRack;
        toggleDeptInput.placeholder = defaultRack;
    } else {
        form.action = `/asset_out/${itemId}`;
        adminLocBox.style.display = 'block';
        userFieldsBox.style.display = 'none';
        toggleDeptInput.required = false;
        toggleDeptInput.value = '';
        if (isStockStr === 'True') {
            title.innerHTML = `<i class="material-icons" style="color:#f39c12;">output</i> ${MODAL_I18N.toggle_out_title}`;
            hintBox.innerHTML = MODAL_I18N.toggle_out_hint;
            locInput.placeholder = MODAL_I18N.toggle_out_ph;
            locInput.value = '';
            locInput.required = true;
        } else {
            title.innerHTML = `<i class="material-icons" style="color:#1db954;">keyboard_return</i> ${MODAL_I18N.toggle_in_title}`;
            hintBox.innerHTML = MODAL_I18N.toggle_in_hint;
            locInput.placeholder = originalLoc ? originalLoc : MODAL_I18N.toggle_in_ph;
            locInput.value = originalLoc;
            locInput.required = false;
        }
    }

    modal.style.display = 'flex';
};

window.closeAssetToggleModal = function() {
    document.getElementById('assetToggleModal').style.display = 'none';
};

// Asset出入库Modal控制结束

// 停用确认Modal开始

window.openStopConfirmModal = function(itemId, ctrlNo, isStopStr, isUserRequest = false, defaultRack = '') {
    const modal = document.getElementById('stopConfirmModal');
    const form = document.getElementById('stopForm');
    const title = document.getElementById('stopModalTitle');
    const text = document.getElementById('stopModalText');
    const icon = document.getElementById('stopModalIcon');
    const locReuseContainer = document.getElementById('locReuseContainer');
    const locReuse = document.getElementById('locReuse');
    const submitBtn = document.getElementById('stopSubmitBtn');
    const radio = document.getElementById('raisonRadio')
    const userFieldsBox = document.getElementById('stopUserFields');
    const stopDeptInput = document.getElementById('stopDept');

    if (isUserRequest) {
        form.action = `/api/request_asset/${ctrlNo}`;
        icon.innerHTML = '<i class="material-icons" style="font-size: 3.5rem; color: var(--danger-red);">build</i>';
        title.innerText = `${MODAL_I18N.report_broken_title}`;
        text.innerHTML = `${MODAL_I18N.report_broken} <strong>${ctrlNo}</strong>`;
        radio.style.display = 'none';
        radio.querySelectorAll('input').forEach(input => {input.required = false;});
        userFieldsBox.style.display = 'block';
        stopDeptInput.required = true;
        stopDeptInput.value = defaultRack;
        stopDeptInput.placeholder = defaultRack;
        submitBtn.style.backgroundColor = 'var(--danger-red)';
        submitBtn.innerHTML = `<i class="material-icons">send</i> ${MODAL_I18N.btn_submit}`;
    } else {
        form.action = `/api/asset_stop_toggle/${itemId}`;
        userFieldsBox.style.display = 'none';
        stopDeptInput.required = false;
        stopDeptInput.value = '';
        if (isStopStr === 'True') {
            icon.innerHTML = '<i class="material-icons" style="font-size: 3.5rem; color: #1db954;">settings_backup_restore</i>';
            title.innerText = MODAL_I18N.stop_reuse_title;
            text.innerHTML = MODAL_I18N.stop_reuse_text.replace('{ctrlNo}', ctrlNo);
            locReuseContainer.style.display = 'block';
            locReuse.placeholder = defaultRack;
            locReuse.required = true;
            locReuse.value = defaultRack;
            radio.style.display = 'none';
            radio.querySelectorAll('input').forEach(i => i.required = false);
            submitBtn.style.backgroundColor = '#1db954';
            submitBtn.innerHTML = `<i class="material-icons">check_circle</i> ${MODAL_I18N.btn_reuse}`;
        } else {
            icon.innerHTML = '<i class="material-icons" style="font-size: 3.5rem; color: var(--danger-red);">do_not_disturb_on</i>';
            title.innerText = MODAL_I18N.stop_freeze_title;
            text.innerHTML = MODAL_I18N.stop_freeze_text.replace('{ctrlNo}', ctrlNo);
            locReuseContainer.style.display = 'none';
            locReuse.placeholder = '';
            locReuse.value = '';
            radio.style.display = 'flex';
            radio.querySelectorAll('input').forEach(i => i.required = true);
            submitBtn.style.backgroundColor = 'var(--danger-red)';
            submitBtn.innerHTML = `<i class="material-icons">block</i> ${MODAL_I18N.btn_stop}`;
        }
    }

    modal.style.display = 'flex';
};

window.closeStopConfirmModal = function() {
    document.getElementById('stopConfirmModal').style.display = 'none';
};

// 停用确认Modal结束

// Asset编辑Modal开始

window.openAssetItemEditModal = function(itemId, pn, ctrlNo, location, dateStr, poType) {
    const modal = document.getElementById('assetItemEditModal');

    document.getElementById('assetItemEditForm').action = `/asset_edit_item/${itemId}`;
    document.getElementById('modalCtrlNoDisplay').innerText = `[${ctrlNo}]`;
    document.getElementById('editPn').value = pn || '';
    document.getElementById('editCtrlNo').value = ctrlNo || '';
    document.getElementById('editLocation').value = (location === 'None' || !location) ? '' : location;
    document.getElementById('editDate').value = (dateStr === 'None' || !dateStr) ? '' : dateStr;
    document.getElementById('editPoType').value = (poType === 'None' || !poType) ? '' : poType;
    document.getElementById('applyPoToAllCheckbox').checked= false;

    modal.style.display = 'flex';
};

window.closeAssetItemEditModal = function() {
    document.getElementById('assetItemEditModal').style.display = 'none';
};

// Asset编辑Modal结束

// 物料审批Modal 开始

window.openApproveModal = function(reqId, pn, name, reqQty, sysStock, location) {
    document.getElementById('approveForm').action = '/request_queue/approve/' + reqId;
    document.getElementById('modalPn').innerText = pn;
    document.getElementById('modalName').innerText = name;
    document.getElementById('modalSysStock').innerText = sysStock;
    document.getElementById('modalReqQty').innerText = reqQty;
    document.getElementById('modalLocation').innerText = location;
    let currentReqQty = parseInt(reqQty);

    // 重置所有输入和报错状态
    let stockInput = document.getElementById('realStock');
    stockInput.value = '';
    stockInput.style.backgroundColor = 'transparent';
    document.getElementById('approveError').style.display = 'none';
    document.getElementById('approveForm').classList.remove('shake-animation');

    document.getElementById('approveModal').style.display = 'flex';

    // 自动呼叫底部地图对焦
    if (location && location.trim() !== '' && location !== '-' && location !== 'None') {
        let rackName = location.split('-')[0].toUpperCase();
        if (window.openFooterMap) window.openFooterMap(rackName);
    }

    setTimeout(() => stockInput.focus(), 100);
};

window.closeApproveModal = function() {
    document.getElementById('approveModal').style.display = 'none';
};

// 物料审批Modal 结束

// 资产审批Modal 开始

window.openAssetApproveModal = function(reqId, matter, pn, reqQty, ctrlNo) {
    const modal = document.getElementById('assetApproveModal');
    const form = document.getElementById('assetApproveForm');
    const title = document.getElementById('assetModalTitle');
    const dynamicBox = document.getElementById('assetDynamicInput');

    form.action = `/request_queue/asset_approve/${reqId}`;
    form.dataset.matter = matter;
    form.dataset.reqQty = reqQty;
    form.dataset.pn = pn;

    document.getElementById('assetModalPn').innerText = pn;
    let ctrlBox = document.getElementById('assetModalCtrlNoBox');
    if (ctrlNo && ctrlNo !== 'None') {
        ctrlBox.style.display = 'block';
        document.getElementById('assetModalCtrlNo').innerText = ctrlNo;
    } else {
        ctrlBox.style.display = 'none';
    }
    if (matter === 'require') {
        title.innerHTML = `<i class="material-icons" style="color: var(--primary-blue);">add_shopping_cart</i> ${MODAL_I18N.dispatch_asset}`;
        dynamicBox.innerHTML = `
            <label style="display: block; font-weight: bold; color: var(--text-main); margin-bottom: 8px;">Scan Serial Numbers (Expected: ${reqQty})${MODAL_I18N.scan_area_label.replace('{reqQty}', reqQty)} <span style="color: red;">*</span></label>
            <input type="text" id="scanSnInput" name="ctrl_nos" required placeholder="JPE160001"
                   style="width: 100%; height: 42px; font-size: 1rem; padding: 0 10px; border: 2px solid var(--primary-blue); border-radius: 6px; outline: none; box-sizing: border-box;">
            <p style="font-size: 0.75rem; color: #888; margin-top: 5px;">${MODAL_I18N.scab_area_note}</p>
        `;

        // 拦截回车
        setTimeout(() => {
            const snInput = document.getElementById('scanSnInput');
            if (snInput) {
                snInput.focus();
                snInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();

                        let val = this.value.trim();
                        if (val !== '' && !val.endsWith(',')) { this.value = val + ','; }
                    }
                });
            }
        }, 10);
    }
    else if (matter === 'return') {
        title.innerHTML = `<i class="material-icons" style="color: var(--primary-green);">assignment_return</i> ${MODAL_I18N.confirm_return}`;
        dynamicBox.innerHTML = `
            <label style="display: block; font-weight: bold; color: var(--text-main); margin-bottom: 8px;">${MODAL_I18N.target_location}</label>
            <input type="text" id="scanLocInput" name="target_location" placeholder="${MODAL_I18N.target_location_ph}"
                   style="width: 100%; height: 42px; font-size: 1rem; padding: 0 10px; border: 2px solid var(--primary); border-radius: 6px; outline: none; box-sizing: border-box;">
        `;
        // 拦截回车
        setTimeout(() => {
            const locInput = document.getElementById('scanLocInput');
            if (locInput) {
                locInput.focus();
                locInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                    }
                });
            }
        }, 10);
    }
    else if (matter === 'broken') {
        title.innerHTML = `<i class="material-icons" style="color:#d93025;">build</i> ${MODAL_I18N.confirm_broken}`;
        dynamicBox.innerHTML = `
            <div style="background: #fce8e6; color: #d93025; padding: 15px; border-radius: 6px; border: 1px dashed #fadbd8; text-align: center;">
                <i class="material-icons" style="font-size: 2rem; margin-bottom: 5px;">warning</i><br>
                ${MODAL_I18N.broken_note}
            </div>
        `;
    }
    modal.style.display = 'flex';
};

window.closeAssetApproveModal = function() {
    document.getElementById('assetApproveModal').style.display = 'none';
};

// 资产审批Modal 结束

// Simcard 分配Modal 开始

window.openSimcardToggleModal = function(itemId, isStockStr) {
    const modal = document.getElementById('simcardToggleModal');
    const form = document.getElementById('simcardToggleForm');
    const title = document.getElementById('simcardToggleTitle');
    const hintBox = document.getElementById('simcardToggleHintBox');
    const fieldBox = document.getElementById('toggleFields');
    const locInput = document.getElementById('simcardLocInput');
    const userInput = document.getElementById('userInput');
    const projectInput = document.getElementById('projectInput');

    form.action = `/simcard_out/${itemId}`

    if (isStockStr === 'True') {
        title.innerHTML = `<i class="material-icons" style="color:#1db954;">output</i> ${MODAL_I18N.toggle_out_title}`;
        hintBox.innerHTML = MODAL_I18N.toggle_out_hint;
        fieldBox.style.display = 'flex';
        locInput.value = '';
        locInput.required = true;
        userInput.value = '';
        projectInput.value = '';
    } else {
        title.innerHTML = `<i class="material-icons" style="color:#f39c12;">keyboard_return</i> ${MODAL_I18N.toggle_in_title}`;
        hintBox.innerHTML = MODAL_I18N.toggle_in_hint;
        fieldBox.style.display = 'none';
        locInput.value = '';
        locInput.required = false;
        userInput.value = '';
        projectInput.value = '';
    }
    modal.style.display = 'flex';
}

window.closeSimcardToggleModal = function() {
    document.getElementById('simcardToggleModal').style.display = 'none';
}

// Simcard 分配Modal 结束

// Simcard 编辑Modal 开始

window.openSimcardItemEditModal = function(itemId, icc, carrier, phone, loc, user, proj, note) {
    const modal = document.getElementById('simcardEditModal');
    document.getElementById('simcardEditForm').action = `/simcard_edit/${itemId}`;

    document.getElementById('editIccid').value = icc;
    document.getElementById('editCarrier').value = carrier;
    document.getElementById('editPhone').value = phone;
    document.getElementById('editLoc').value = loc;
    document.getElementById('editUser').value = user || '';
    document.getElementById('editProject').value = proj || '';
    document.getElementById('editNote').value = note || '';

    modal.style.display = 'flex';
}

window.closeSimcardEditModal = function() {
    document.getElementById('simcardEditModal').style.display = 'none';
}

// Simcard 编辑Modal 结束

// Simcard 启用Modal 开始

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
        title.innerHTML = MODAL_I18N.simcard_disable;
        text.innerHTML = MODAL_I18N.disabled_notice;
        submitBtn.innerHTML = `<i class="material-icons">block</i> ${MODAL_I18N.btn_disable}`;
        submitBtn.style.backgroundColor = 'var(--danger-red)';
    } else {
        icon.innerHTML = '<i class="material-icons" style="font-size: 3.5rem; color: #1db954;">settings_backup_restore</i>';
        title.innerHTML = MODAL_I18N.simcard_enable;
        text.innerHTML = MODAL_I18N.enable_notice;
        submitBtn.innerHTML = `<i class="material-icons">check_circle</i> ${MODAL_I18N.btn_enable}`;
        submitBtn.style.backgroundColor = 'var(--primary-green)';
    }
    modal.style.display = 'flex';
}

window.closeActiveToggleModal = function() {
    document.getElementById('activeToggleModal').style.display = 'none';
}

// Simcard 启用Modal 结束

// ESC键控制全部模态框关闭
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (window.closeQrModal) window.closeQrModal();
        if (window.closeCropModal) window.closeCropModal();
        if (window.closeScrapModal) window.closeScrapModal();
        if (window.closeActionModal) window.closeActionModal();
        if (window.closeAssetToggleModal) window.closeAssetToggleModal();
        if (window.closeStopConfirmModal) window.closeStopConfirmModal();
        if (window.closeAssetItemEditModal) window.closeAssetItemEditModal();
        if (window.closeApproveModal) window.closeApproveModal();
        if (window.closeAssetApproveModal) window.closeAssetApproveModal();
        if (window.closeSimcardToggleModal) window.closeSimcardToggleModal();
        if (window.closeSimcardEditModal) window.closeSimcardEditModal();
        if (window.closeActiveToggleModal) window.closeActiveToggleModal();
    }
});