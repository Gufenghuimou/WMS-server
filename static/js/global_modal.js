// static/js/global_modal.js

(() => {
    let currentMode = 'inv';
    let cropper = null;
    let currentCropContext = { pn1: null, itemId: null };
    
    // 滑动报废专属变量
    let isDraggingSlider = false;
    let startX = 0;
    let maxDrag = 0;
    const ZOOM_LEVEL = 0.67; // 如果有缩放布局的修正

    // ==========================================
    // 1. 初始化入口
    // ==========================================
    window.initGlobalModals = function() {
        // 1. 消耗品自动完成与纠偏逻辑
        const invInput = document.getElementById('invPn1');
        if (invInput) {
            invInput.onkeydown = async function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const val = this.value.trim().toUpperCase();
                    const status = document.getElementById('invStatus');
                    const pn2 = document.getElementById('invPn2');
                    const name = document.getElementById('invName');

                    if (!val) { status.innerHTML = ''; pn2.value = ''; name.value = ''; return; }
                    status.innerHTML = `<span style="color:#888;">${t('reprint.msg_querying')}</span>`;

                    try {
                        let res = await fetch(`/api/item/${val}`);
                        let data = await res.json();

                        if (data.error) {
                            status.innerHTML = `<span class="msg-error">❌ ${data.error}</span>`;
                            pn2.value = ''; name.value = '';
                        } else {
                            if (data.matched_by === 'pn_2') {
                                status.innerHTML = `<span class="msg-warning">${t('reprint.msg_correct_pn2')}</span>`;
                                invInput.value = data.pn_1;
                                pn2.value = data.pn_2 || '';
                            } else {
                                status.innerHTML = `<span class="msg-success">${t('reprint.msg_match_success')}</span>`;
                                invInput.value = data.pn_1;
                                pn2.value = data.pn_2 || '';
                            }
                            name.value = data.name || '-';
                        }
                    } catch (err) {
                        status.innerHTML = `<span class="msg-error"> ${t('reprint.msg_net_fail')}</span>`;
                    }
                }
            };
        }

        // 2. 资产自动完成逻辑
        const assetInput = document.getElementById('assetCtrl');
        if (assetInput) {
            assetInput.onkeydown = async function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const val = this.value.trim().toUpperCase();
                    this.value = val;
                    const status = document.getElementById('assetStatus');
                    const pn1 = document.getElementById('assetPn1');
                    const name = document.getElementById('assetName');

                    if (!val) { status.innerHTML = ''; pn1.value = ''; name.value = ''; return; }
                    status.innerHTML = `<span style="color:#888;">${t('reprint.msg_querying')}</span>`;

                    try {
                        let res = await fetch(`/api/asset_info/${val}`);
                        let data = await res.json();

                        if (data.error) {
                            status.innerHTML = `<span class="msg-error">❌ ${data.error}</span>`;
                            pn1.value = ''; name.value = '';
                        } else {
                            status.innerHTML = `<span class="msg-success">${t('reprint.msg_match_success')}</span>`;
                            pn1.value = data.pn_1 || '';
                            name.value = data.name || '-';
                        }
                    } catch (err) {
                        status.innerHTML = `<span class="msg-error"> ${t('reprint.msg_net_fail')}</span>`;
                    }
                }
            };
        }
    };

    // ==========================================
    // 2. 二维码授权 Modal 控制
    // ==========================================
    window.openMobileUploadAuth = async function(event) {
        let btn = event.currentTarget;
        let originalHtml = btn.innerHTML;

        btn.innerHTML = `<i class="material-icons" style="font-size: 1.2rem; animation: spin 1s linear infinite;">autorenew</i> ${t('base.generating')}`;
        btn.disabled = true;

        try {
            let res = await fetch('/api/generate_mobile_token', { method: 'POST' });
            let data = await res.json();

            if (data.status === 'success' && data.token) {
                let currentHost = window.location.host
                let mobileUrl = `https://${currentHost}/mobile/login?token=${data.token}`;

                let canvas = document.getElementById('qrcodeCanvas');
                new QRious({
                    element: canvas,
                    value: mobileUrl,
                    size: 220,
                    level: 'H'
                });
                document.getElementById('qrModal').style.display = 'flex';
            } else {
                alert(data.message || t('base.unknown_error'));
            }
        } catch(e) {
            console.error(e);
            alert(t('base.network_error_qr'));
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    };

    window.closeQrModal = function() {
        document.getElementById('qrModal').style.display = 'none';
    };


    // ==========================================
    // 3. 打印标签 Modal 控制
    // ==========================================
    window.openReprintModal = function() {
        document.getElementById('printModal').style.display = 'flex';
    };

    window.closeReprintModal = function() {
        document.getElementById('printModal').style.display = 'none';
    };

    window.switchMode = function(mode) {
        currentMode = mode;
        document.getElementById('tabInv').classList.toggle('active', mode === 'inv');
        document.getElementById('tabAsset').classList.toggle('active', mode === 'asset');
        document.getElementById('formInv').style.display = mode === 'inv' ? 'block' : 'none';
        document.getElementById('formAsset').style.display = mode === 'asset' ? 'block' : 'none';

        if(mode === 'inv') document.getElementById('invPn1').focus();
        if(mode === 'asset') document.getElementById('assetCtrl').focus();
    };

    window.doPrint = async function(mode) {
        let formData = new FormData();

        if (mode === 'inv') {
            let pn1 = document.getElementById('invPn1').value;
            let pn2 = document.getElementById('invPn2').value;
            if (!pn1) return alert(t('reprint.alert_no_pn1'));
            formData.append('right_barcode', pn1);
            formData.append('left_text', pn2);
        } else {
            let ctrl = document.getElementById('assetCtrl').value;
            let pn1 = document.getElementById('assetPn1').value;
            if (!ctrl) return alert(t('reprint.alert_no_ctrl'));
            formData.append('right_barcode', ctrl);
            formData.append('left_text', pn1);
        }

        try {
            let res = await fetch('/api/trigger_print', { method: 'POST', body: formData });
            let data = await res.json();

            if (data.status === 'success') {
                if(typeof window.showToast === 'function') window.showToast(data.message, 'success');
                if(mode === 'inv') {
                    document.getElementById('invPn1').value = '';
                    document.getElementById('invPn1').dispatchEvent(new Event('input'));
                    document.getElementById('invPn1').focus();
                } else {
                    document.getElementById('assetCtrl').value = '';
                    document.getElementById('assetCtrl').dispatchEvent(new Event('input'));
                    document.getElementById('assetCtrl').focus();
                }
            } else {
                if(typeof window.showToast === 'function') window.showToast(data.message, 'error');
            }
        } catch (e) {
            alert(t('reprint.alert_print_fail'));
        }
    };

    window.checkPrinterStatusManual = async function() {
        const icon = document.getElementById('printerStatusIcon');
        if (icon) icon.innerHTML = 'sync';

        try {
            let res = await fetch('/api/printer_status');
            let data = await res.json();

            const ipInput = document.getElementById('printerIp');
            const portInput = document.getElementById('printerPort');
            if (ipInput && data.config) ipInput.value = data.config.ip;
            if (portInput && data.config) portInput.value = data.config.port;

            if (data.status === 'online') {
                if (icon) {
                    icon.innerHTML = 'print';
                    icon.style.color = '#1db954';
                }
            } else {
                if (icon) {
                    icon.innerHTML = 'print_disabled';
                    icon.style.color = '#e74c3c';
                }
            }
        } catch (e) {
            if (icon) {
                icon.innerHTML = 'error_outline';
                icon.style.color = '#e74c3c';
            }
        }
    };

    window.savePrinterConfig = async function(e) {
        e.preventDefault();

        let ip = document.getElementById('printerIp').value.trim();
        let port = document.getElementById('printerPort').value.trim();

        if (!ip || !port) return alert(t('reprint.alert_empty_ip'));

        let formData = new FormData();
        formData.append('ip', ip);
        formData.append('port', port);

        try {
            let res = await fetch('/api/update_printer_config', {
                method: 'POST',
                body: formData
            });
            let data = await res.json();

            if (data.status === 'success') {
                if(typeof window.showToast === 'function') window.showToast(data.message, 'success');
                window.checkPrinterStatusManual(); 
            } else {
                alert(t('reprint.alert_save_fail') + (data.message || "Unknown error"));
            }
        } catch (err) {
            alert(t('reprint.alert_save_net_err'));
        }
    };

    // ==========================================
    // 4. 图片裁剪 Modal 控制 (Asset / Inventory)
    // ==========================================
    window.uploadCardImage = function(inputElem, pn1, itemId) {
        if (!inputElem.files || inputElem.files.length === 0) return;

        let file = inputElem.files[0];
        let reader = new FileReader();

        currentCropContext.pn1 = pn1;
        currentCropContext.itemId = itemId;

        reader.onload = function(e) {
            document.getElementById('cropImageTarget').src = e.target.result;
            document.getElementById('cropModal').style.display = 'flex';
            document.getElementById('confirmCrop').setAttribute('onclick', 'window.confirmAssetCrop()');

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

    window.confirmAssetCrop = function() {
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
                    window.closeCropModal();
                    document.getElementById('confirmCrop').onclick = null;
                    if(typeof window.showToast === 'function') window.showToast('Image updated successfully!', 'success');
                    
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
                    if(typeof window.showToast === 'function') window.showToast(t('asset_view.upload_fail'), 'error');
                }
            } catch(e) {
                if(typeof window.showToast === 'function') window.showToast(t('asset_view.upload_net_err'), 'error');
            }
        }, 'image/jpeg', 0.8);
    };

    window.handleImageSelect = function(event) {
        let file = event.target.files[0];
        if (!file) return;

        let reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('cropImageTarget').src = e.target.result;
            document.getElementById('cropModal').style.display = 'block';
            document.getElementById('confirmCrop').setAttribute('onclick', 'window.confirmInventoryCrop()');

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

    window.confirmInventoryCrop = function() {
        if (!cropper) return;

        cropper.getCroppedCanvas({
            maxWidth: 800,
            maxHeight: 800,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        }).toBlob(function(blob) {
            let formData = new FormData();
            formData.append('file', blob, 'image.jpg');

            // 注意：依赖 inventory_card.js 里面暴露的 window.currentEditItemId
            fetch(`/api/upload_image/${window.currentEditItemId}`, {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if(data.status === 'success') {
                    window.closeCropModal();
                    document.getElementById('confirmCrop').onclick = null;
                    if(typeof window.showToast === 'function') window.showToast(data.message, 'success');
                    
                    let freshUrl = data.url + '?t=' + new Date().getTime();

                    let imgPreview = document.getElementById('editImagePreview');
                    if (imgPreview) {
                        imgPreview.src = freshUrl;
                        imgPreview.style.display = 'block';
                    }
                    let ph = document.getElementById('editImagePlaceholder');
                    if (ph) ph.style.display = 'none';

                    let cardImg = document.querySelector(`.card-item-img[data-itemid="${window.currentEditItemId}"]`);
                    if (cardImg) {
                        cardImg.src = freshUrl;
                        cardImg.style.display = 'block';
                        if(cardImg.nextElementSibling) cardImg.nextElementSibling.style.display = 'none';
                    }
                }
            })
            .catch(err => alert(t('asset_view.upload_fail') + err));

        }, 'image/jpeg', 0.8);
    };

    window.closeCropModal = function() {
        document.getElementById('cropModal').style.display = 'none';
        if(cropper) cropper.destroy();
    };

    // ==========================================
    // 5. 滑动报废 Modal 控制
    // ==========================================
    window.openScrapModal = function(itemId) {
        const modal = document.getElementById('scrapModal');
        const form = document.getElementById('scrapForm');

        let currentPage = document.querySelector('.nav-item.active');
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
    };

    window.closeScrapModal = function() {
        document.getElementById('scrapModal').style.display = 'none';
        resetSlider();
        isDraggingSlider = false;
        document.onmousemove = null;
        document.onmouseup = null;
    };

    function resetSlider(animate = false) {
        const container = document.getElementById('sliderContainer');
        const handle = document.getElementById('sliderHandle');
        const bg = document.getElementById('sliderBg');
        const text = document.getElementById('sliderText');

        container.classList.remove('unlocked');
        text.innerText = t('asset_scrap.slider_text') || 'Slide to confirm';

        if (animate) {
            handle.style.transition = 'left 0.3s ease';
            bg.style.transition = 'width 0.3s ease';
        } else {
            handle.style.transition = 'none';
            bg.style.transition = 'none';
        }

        handle.style.left = '3px';
        bg.style.width = '0';
    }

    function unlockSuccess() {
        isDraggingSlider = false;
        document.onmousemove = null;

        const container = document.getElementById('sliderContainer');
        container.classList.add('unlocked');
        document.getElementById('sliderText').innerText = 'Releasing...';

        setTimeout(() => {
            // 🌟 核心修复：使用 requestSubmit() 触发完整的 JS 拦截闭环，防止原生的暴力刷新页面
            const scrapForm = document.getElementById('scrapForm');
            if (scrapForm && scrapForm.requestSubmit) {
                scrapForm.requestSubmit();
            } else if (scrapForm) {
                scrapForm.submit(); // 老浏览器兜底
            }
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

    // ==========================================
    // 6. 其他小部件 Modal 
    // ==========================================
    window.openShowImgModal = function(itemId, pn1, name) {
        const modal = document.getElementById('showImgModal');
        const imgPn = document.getElementById('showImgModalPn');
        const imgText = document.getElementById('showImgModalText');
        const imgMain = document.getElementById('showImgModalMain');
        
        let currentPage = document.querySelector('.nav-item.active');

        imgPn.innerText = `${pn1}`;
        imgText.innerHTML = `<span style="color: var(--text-muted); font-size: 0.95rem">${name}</span>`;
        
        let sysVer = window.GLOBAL_SYS_VER || window.SYS_VER || new Date().getTime();

        if (currentPage.getAttribute('href') === '/all' || currentPage.getAttribute('href') === '/inventory_table') {
            imgMain.innerHTML = `<img style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;" src="/static/item_images/${itemId}.jpg?t=${sysVer}">`;
        } else if (currentPage.getAttribute('href') === '/asset') {
            imgMain.innerHTML = `<img style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px;" src="/static/asset_images/${pn1}.jpg?t=${sysVer}">`;
        }

        modal.style.display = 'flex';
    };

    window.closeShowImgModal = function() {
        document.getElementById('showImgModal').style.display = 'none';
    };

    // Asset 操作按钮模态框
    window.openActionModal = async function(groupId, itemId) {
        try {
            const response = await fetch(`/api/status_check/${itemId}`, {method: 'POST'});
            const result = await response.json();

            if (result.status !== 'success') {
                if(typeof window.showToast === 'function') window.showToast(result.message, 'error');

                let groupData = window.ASSET_DATA[groupId];
                if (groupData && groupData.items) {
                    let item = groupData.items.find(i => i.id === itemId);
                    if (item) {
                        item.is_request = true;
                    }
                }
                window.switchAssetType(groupId);
                return;
            }
        } catch (err) {
            if(typeof window.showToast === 'function') window.showToast('Network error during status check', 'error');
            console.error("Status check failed:", err);
            return;
        }

        let groupData = window.ASSET_DATA[groupId];
        let item = groupData.items.find(i => i.id === itemId);
        if (!item) return;

        let safePn = groupData.pn1 ? String(groupData.pn1).replace(/'/g, "\\'") : '';
        let safeCtrl = item.ctrl_no.replace(/'/g, "\\'");
        let rawLoc = item.location ? String(item.location).trim() : '';
        let safeLoc = rawLoc.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        let safeDate = item.first_in_date ? item.first_in_date.replace(/'/g,"\\'"): '';
        let safePoType = item.po_type ? String(item.po_type).replace(/'/g, "\\'") : '';
        let isStockStr = item.is_stock ? 'True' : 'False';
        let isStopStr = item.is_stop ? 'True' : 'False';
        let disabledStyle = item.is_stop ? 'opacity: 0.5; pointer-events: none;' : '';
        let remarks = item.remarks ? String(item.remarks) : '';
        
        let activeSibling = groupData.items.find(i => i.is_stock && i.location && i.location.toLowerCase() !== 'none' && i.location !== '-');
        let siblingLoc = activeSibling ? activeSibling.location.replace(/'/g, "\\'").replace(/"/g, "&quot;") : '';
        let rackName = rawLoc.includes('-') ? rawLoc.split('-')[0].toUpperCase() : rawLoc;
        rackName = rackName.replace(/'/g, "\\'").replace(/"/g, "&quot;");

        document.getElementById('actionModalCtrlNo').innerHTML = `<i class="material-icons" style="vertical-align: middle; color: var(--primary-blue);">tune</i> ${item.ctrl_no}`;
        document.getElementById('actionModalPn').innerText = `${safePn}`;
        document.getElementById('actionModalName').innerText = `${groupData.name}`;

        const isAdmin = (window.CURRENT_USER && ['superadmin', 'admin'].includes(window.CURRENT_USER.role));
        let btnGroupHtml = '';

        if (isAdmin) {
            let btn1Bg = !item.is_stock ? '#1db954' : '#f39c12';
            let btn1Icon = item.is_stock ? 'output' : 'login';
            let btn1Text = item.is_stock ? t('asset_view.btn_take_out') : t('asset_view.btn_return_in');
            let btn1 = `<button class="btn-primary" style="background-color: ${btn1Bg}; ${disabledStyle}; width:100%; display:flex; justify-content:center; align-items:center; gap:8px;" onclick="window.openAssetToggleModal(${item.id}, '${isStockStr}', '${safeCtrl}', false, '', '${siblingLoc}')"><i class="material-icons">${btn1Icon}</i> ${btn1Text}</button>`;

            let btn2 = `<button class="btn-primary" style="background-color: #3498db; width:100%; display:flex; justify-content:center; align-items:center; gap:8px;" onclick="window.openAssetItemEditModal(${item.id}, '${safePn}', '${safeCtrl}', '${safeLoc}', '${safeDate}', '${safePoType}', '${remarks}')"><i class="material-icons">edit_note</i> ${t('asset_view.btn_edit')}</button>`;
            
            let btn3 = '';
            if (!item.is_stop && !item.is_stock) {
                btn3 = `<button class="btn-primary" style="background-color: #bdc3c7; color: #fff; width:100%; display:flex; justify-content:center; align-items:center; gap:8px;" onclick="alert(window.t('asset_view.btn_stop_deny'))"><i class="material-icons">do_not_disturb</i> ${t('asset_view.btn_stop')}</button>`;
            } else {
                let btn3Bg = item.is_stop ? '#95a5a6' : 'var(--danger-red)';
                let btn3Icon = item.is_stop ? 'settings_backup_restore' : 'do_not_disturb';
                let btn3Text = item.is_stop ? t('asset_view.btn_reuse') : t('asset_view.btn_stop');
                btn3 = `<button class="btn-primary" style="background-color: ${btn3Bg}; width:100%; display:flex; justify-content:center; align-items:center; gap:8px;" onclick="window.openStopConfirmModal(${item.id}, '${safeCtrl}', '${isStopStr}', false, '${siblingLoc}')"><i class="material-icons">${btn3Icon}</i> ${btn3Text}</button>`;
            }
            btnGroupHtml = btn1 + btn2 + btn3;
        } else {
            if (!item.is_stock && !item.is_stop) {
                let btn4 = `<button class="btn-primary" style="background-color: #1db954; width:100%; display:flex; justify-content:center; align-items:center; gap:8px;" onclick="window.openAssetToggleModal(${item.id}, 'False', '${safeCtrl}', true, '${rackName}', '')"><i class="material-icons">assignment_return</i> ${t('asset_view.request_return_title')}</button>`;
                let btn5 = `<button class="btn-primary" style="background-color: var(--danger-red); width:100%; display:flex; justify-content:center; align-items:center; gap:8px;" onclick="window.openStopConfirmModal(${item.id}, '${safeCtrl}', 'False', true, '${rackName}')"><i class="material-icons">build</i> ${t('asset_view.report_broken_title')}</button>`;
                btnGroupHtml = btn4 + btn5;
            } else {
                btnGroupHtml = `<span style="font-size:0.9rem; color:#aaa; padding: 20px 0;">${t('asset_view.no_actions') || 'No Actions'}</span>`;
            }
        }

        document.getElementById('actionModalButtons').innerHTML = btnGroupHtml;
        document.getElementById('actionModal').style.display = 'flex';
    };

    window.closeActionModal = function() {
        document.getElementById('actionModal').style.display = 'none';
    };

    // 其他对应的开关事件
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
            title.innerHTML = `<i class="material-icons" style="color:#1db954;">assignment_return</i> ${t('asset_view.request_return_title')}`;
            hintBox.innerHTML = `${t('asset_view.request_return')} <strong>${ctrlNo}</strong>.`;
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
                title.innerHTML = `<i class="material-icons" style="color:#f39c12;">output</i> ${t('asset_view.toggle_out_title')}`;
                hintBox.innerHTML = t('asset_view.toggle_out_hint');
                locInput.placeholder = t('asset_view.toggle_out_ph');
                locInput.value = '';
                locInput.required = true;
            } else {
                title.innerHTML = `<i class="material-icons" style="color:#1db954;">keyboard_return</i> ${t('asset_view.toggle_in_title')}`;
                hintBox.innerHTML = t('asset_view.toggle_in_hint');
                locInput.placeholder = originalLoc ? originalLoc : t('asset_view.toggle_in_ph');
                locInput.value = originalLoc;
                locInput.required = false;
            }
        }
        modal.style.display = 'flex';
    };

    window.closeAssetToggleModal = function() {
        document.getElementById('assetToggleModal').style.display = 'none';
    };

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
            title.innerText = `${t('asset_view.report_broken_title')}`;
            text.innerHTML = `${t('asset_view.report_broken')} <strong>${ctrlNo}</strong>`;
            radio.style.display = 'none';
            radio.querySelectorAll('input').forEach(input => {input.required = false;});
            userFieldsBox.style.display = 'block';
            stopDeptInput.required = true;
            stopDeptInput.value = defaultRack;
            stopDeptInput.placeholder = defaultRack;
            submitBtn.style.backgroundColor = 'var(--danger-red)';
            submitBtn.innerHTML = `<i class="material-icons">send</i> ${t('asset_view.btn_submit')}`;
        } else {
            form.action = `/api/asset_stop_toggle/${itemId}`;
            userFieldsBox.style.display = 'none';
            stopDeptInput.required = false;
            stopDeptInput.value = '';
            if (isStopStr === 'True') {
                icon.innerHTML = '<i class="material-icons" style="font-size: 3.5rem; color: #1db954;">settings_backup_restore</i>';
                title.innerText = t('asset_view.stop_reuse_title');
                text.innerHTML = t('asset_view.stop_reuse_text').replace('{ctrlNo}', ctrlNo);
                locReuseContainer.style.display = 'block';
                locReuse.placeholder = defaultRack;
                locReuse.required = true;
                locReuse.value = defaultRack;
                radio.style.display = 'none';
                radio.querySelectorAll('input').forEach(i => i.required = false);
                submitBtn.style.backgroundColor = '#1db954';
                submitBtn.innerHTML = `<i class="material-icons">check_circle</i> ${t('asset_view.btn_reuse')}`;
            } else {
                icon.innerHTML = '<i class="material-icons" style="font-size: 3.5rem; color: var(--danger-red);">do_not_disturb_on</i>';
                title.innerText = t('asset_view.stop_freeze_title');
                text.innerHTML = t('asset_view.stop_freeze_text').replace('{ctrlNo}', ctrlNo);
                locReuseContainer.style.display = 'none';
                locReuse.placeholder = '';
                locReuse.value = '';
                radio.style.display = 'flex';
                radio.querySelectorAll('input').forEach(i => i.required = true);
                submitBtn.style.backgroundColor = 'var(--danger-red)';
                submitBtn.innerHTML = `<i class="material-icons">block</i> ${t('asset_view.btn_stop')}`;
            }
        }
        modal.style.display = 'flex';
    };

    window.closeStopConfirmModal = function() {
        document.getElementById('stopConfirmModal').style.display = 'none';
    };

    window.openAssetItemEditModal = function(itemId, pn, ctrlNo, location, dateStr, poType, remarks) {
        const modal = document.getElementById('assetItemEditModal');
        document.getElementById('assetItemEditForm').action = `/asset_edit_item/${itemId}`;
        document.getElementById('modalCtrlNoDisplay').innerText = `[${ctrlNo}]`;
        document.getElementById('editPn').value = pn || '';
        document.getElementById('editCtrlNo').value = ctrlNo || '';
        document.getElementById('editLocation').value = (location === 'None' || !location) ? '' : location;
        document.getElementById('editDate').value = (dateStr === 'None' || !dateStr) ? '' : dateStr;
        document.getElementById('editPoType').value = (poType === 'None' || !poType) ? '' : poType;
        document.getElementById('applyPoToAllCheckbox').checked= false;
        document.getElementById('editRemarks').value = remarks || '';
        modal.style.display = 'flex';
    };

    window.closeAssetItemEditModal = function() {
        document.getElementById('assetItemEditModal').style.display = 'none';
    };

    window.openApproveModal = function(reqId, pn, name, reqQty, sysStock, location) {
        const form = document.getElementById('approveForm');
        form.action = '/request_queue/approve/' + reqId;
        form.dataset.reqId = reqId;
        document.getElementById('modalPn').innerText = pn;
        document.getElementById('modalName').innerText = name;
        document.getElementById('modalSysStock').innerText = sysStock;
        document.getElementById('modalReqQty').innerText = reqQty;

        const locBtn = document.getElementById('modalLocation');
        locBtn.innerText = location;
        let safeLoc = location.split('-')[0];
        locBtn.onclick = function() { if(window.openFooterMap) window.openFooterMap(safeLoc); };

        let stockInput = document.getElementById('realStock');
        stockInput.value = '';
        stockInput.style.backgroundColor = 'transparent';
        document.getElementById('approveError').style.display = 'none';
        document.getElementById('approveForm').classList.remove('shake-animation');

        document.getElementById('approveModal').style.display = 'flex';

        if (location && location.trim() !== '' && location !== '-' && location !== 'None') {
            let rackName = location.split('-')[0].toUpperCase();
            if (window.openFooterMap) window.openFooterMap(rackName);
        }

        setTimeout(() => stockInput.focus(), 100);
    };

    window.closeApproveModal = function() {
        document.getElementById('approveModal').style.display = 'none';
    };

    window.openAssetApproveModal = function(reqId, matter, pn, reqQty, ctrlNo) {
        const modal = document.getElementById('assetApproveModal');
        const form = document.getElementById('assetApproveForm');
        const title = document.getElementById('assetModalTitle');
        const dynamicBox = document.getElementById('assetDynamicInput');

        form.action = `/request_queue/asset_approve/${reqId}`;
        form.dataset.matter = matter;
        form.dataset.reqQty = reqQty;
        form.dataset.pn = pn;
        form.dataset.reqId = reqId;

        document.getElementById('assetModalPn').innerText = pn;
        let ctrlBox = document.getElementById('assetModalCtrlNoBox');
        if (ctrlNo && ctrlNo !== 'None') {
            ctrlBox.style.display = 'block';
            document.getElementById('assetModalCtrlNo').innerText = ctrlNo;
        } else {
            ctrlBox.style.display = 'none';
        }

        if (matter === 'require') {
            title.innerHTML = `<i class="material-icons" style="color: var(--primary-blue);">add_shopping_cart</i> ${t('queue.dispatch_asset')}`;
            dynamicBox.innerHTML = `
                <label style="display: block; font-weight: bold; color: var(--text-main); margin-bottom: 8px;">${t('queue.scan_area_label').replace('{reqQty}', reqQty)} <span style="color: red;">*</span></label>
                <input type="text" id="scanSnInput" name="ctrl_nos" required placeholder="JPE160001"
                       style="width: 100%; height: 42px; font-size: 1rem; padding: 0 10px; border: 2px solid var(--primary-blue); border-radius: 6px; outline: none; box-sizing: border-box;">
                <p style="font-size: 0.75rem; color: #888; margin-top: 5px;">${t('queue.scab_area_note')}</p>
            `;
            setTimeout(() => {
                const snInput = document.getElementById('scanSnInput');
                if (snInput) {
                    snInput.focus();
                    snInput.onkeydown = function(e) {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            let val = this.value.trim();
                            if (val !== '' && !val.endsWith(',')) { this.value = val + ','; }
                        }
                    };
                }
            }, 10);
        } else if (matter === 'return') {
            title.innerHTML = `<i class="material-icons" style="color: var(--primary-green);">assignment_return</i> ${t('queue.confirm_return')}`;
            dynamicBox.innerHTML = `
                <label style="display: block; font-weight: bold; color: var(--text-main); margin-bottom: 8px;">${t('queue.target_location')}</label>
                <input type="text" id="scanLocInput" name="target_location" placeholder="${t('queue.target_location_ph')}"
                       style="width: 100%; height: 42px; font-size: 1rem; padding: 0 10px; border: 2px solid var(--primary); border-radius: 6px; outline: none; box-sizing: border-box;">
            `;
            setTimeout(() => {
                const locInput = document.getElementById('scanLocInput');
                if (locInput) {
                    locInput.focus();
                    locInput.onkeydown = function(e) {
                        if (e.key === 'Enter') e.preventDefault();
                    };
                }
            }, 10);
        } else if (matter === 'broken') {
            title.innerHTML = `<i class="material-icons" style="color:#d93025;">build</i> ${t('queue.confirm_broken')}`;
            dynamicBox.innerHTML = `
                <div style="background: #fce8e6; color: #d93025; padding: 15px; border-radius: 6px; border: 1px dashed #fadbd8; text-align: center;">
                    <i class="material-icons" style="font-size: 2rem; margin-bottom: 5px;">warning</i><br>
                    ${t('queue.broken_note')}
                </div>
            `;
        }
        modal.style.display = 'flex';
    };

    window.closeAssetApproveModal = function() {
        document.getElementById('assetApproveModal').style.display = 'none';
    };

    // Simcard 相关
    window.openSimcardActionModal = function(itemId) {
        let item = window.SIMCARD_DATA.find(i => i.id == itemId);
        let safeIccid = item.icc_id.replace(/\s+/g, "");

        document.getElementById('actionModalCtrlNo').innerHTML = `<i class="material-icons" style="vertical-align: middle; color: var(--primary-blue);">tune</i> ${safeIccid}`;
        document.getElementById('actionModalPn').innerText = `${item.phone_number}`;
        document.getElementById('actionModalName').innerText = `${item.carrier}`;

        const isAdmin = (window.CURRENT_USER && ['superadmin', 'admin'].includes(window.CURRENT_USER.role));
        let btnGroupHtml = '';

        if (isAdmin) {
            let btn1Bg = item.is_active ? (!item.is_stock ? '#1db954' : '#f39c12') : 'var(--danger-red)';
            let btn1Icon = item.is_active ? (item.is_stock ? 'output' : 'login') : 'delete';
            let btn1Text = item.is_active ? (item.is_stock ? t('asset_view.btn_take_out') : t('asset_view.btn_return_in')) : t('card.btn_scrap');
            let btn1func = item.is_active ? `window.openSimcardToggleModal(${item.id}, ${item.is_stock})` : `window.openScrapModal(${item.id})`;
            let btn1 = `<button class="btn-primary" style="background-color: ${btn1Bg}; width:100%; display:flex; justify-content:center; align-items:center; gap:8px;" onclick="${btn1func}"><i class="material-icons">${btn1Icon}</i> ${btn1Text}</button>`;

            let btn2 = `<button class="btn-primary" style="background-color: #3498db; width:100%; display:flex; justify-content:center; align-items:center; gap:8px;" onclick="window.openSimcardItemEditModal(${item.id}, '${item.icc_id}', '${item.carrier}', '${item.phone_number}', '${item.location || ""}', '${item.direct_user || ""}', '${item.project || ""}', '${item.note || ""}')"><i class="material-icons">edit_note</i> ${t('asset_view.btn_edit')}</button>`;

            let btn3Bg = item.is_active ? '#e74c3c' : '#95a5a6';
            let btn3Icon = item.is_active ? 'do_not_disturb' : 'settings_backup_restore';
            let btn3Text = item.is_active ? t('asset_view.btn_stop') : t('asset_view.btn_reuse');
            let btn3 = `<button type="button" class="btn-primary" title="Active" style="background-color: ${btn3Bg}; color: #fff; width:100%; display:flex; justify-content:center; align-items:center; gap:8px;" onclick="window.openActiveToggleModal(${item.id}, ${item.is_active})"><i class="material-icons" style="margin-top: 2px;">${btn3Icon}</i>${btn3Text}</button>`;
            
            btnGroupHtml = btn1 + btn2 + btn3;
        }

        document.getElementById('actionModalButtons').innerHTML = btnGroupHtml;
        document.getElementById('actionModal').style.display = 'flex';
    };

    window.openSimcardToggleModal = function(itemId, isStock) {
        const modal = document.getElementById('simcardToggleModal');
        const form = document.getElementById('simcardToggleForm');
        const title = document.getElementById('simcardToggleTitle');
        const hintBox = document.getElementById('simcardToggleHintBox');
        const fieldBox = document.getElementById('toggleFields');
        const locInput = document.getElementById('simcardLocInput');
        const userInput = document.getElementById('userInput');
        const projectInput = document.getElementById('projectInput');

        form.action = `/simcard_out/${itemId}`

        if (isStock === true) {
            title.innerHTML = `<i class="material-icons" style="color:#f39c12;">output</i> ${t('asset_view.toggle_out_title')}`;
            hintBox.innerHTML = t('asset_view.toggle_out_hint');
            fieldBox.style.display = 'flex';
            locInput.value = '';
            locInput.required = true;
            userInput.value = '';
            projectInput.value = '';
        } else {
            title.innerHTML = `<i class="material-icons" style="color:#1db954;">login</i> ${t('asset_view.toggle_in_title')}`;
            hintBox.innerHTML = t('asset_view.toggle_in_hint');
            fieldBox.style.display = 'none';
            locInput.value = '';
            locInput.required = false;
            userInput.value = '';
            projectInput.value = '';
        }
        modal.style.display = 'flex';
    };

    window.closeSimcardToggleModal = function() {
        document.getElementById('simcardToggleModal').style.display = 'none';
    };

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
    };

    window.closeSimcardEditModal = function() {
        document.getElementById('simcardEditModal').style.display = 'none';
    };

    window.openActiveToggleModal = function(itemId, isActive) {
        const modal = document.getElementById('activeToggleModal');
        const form = document.getElementById('activeToggleForm');
        const title = document.getElementById('activeModalTitle');
        const text = document.getElementById('activeModalText');
        const icon = document.getElementById('activeModalIcon');
        const submitBtn = document.getElementById('activeSubmitBtn');

        form.action = `/simcard_active_toggle/${itemId}`;

        if (isActive === true) {
            icon.innerHTML = '<i class="material-icons" style="font-size: 3.5rem; color: var(--danger-red);">do_not_disturb_on</i>';
            title.innerHTML = t('simcard.simcard_disable');
            text.innerHTML = t('simcard.disabled_notice');
            submitBtn.innerHTML = `<i class="material-icons">block</i> ${t('simcard.btn_disable')}`;
            submitBtn.style.backgroundColor = 'var(--danger-red)';
        } else {
            icon.innerHTML = '<i class="material-icons" style="font-size: 3.5rem; color: #1db954;">settings_backup_restore</i>';
            title.innerHTML = t('simcard.simcard_enable');
            text.innerHTML = t('simcard.enable_notice');
            submitBtn.innerHTML = `<i class="material-icons">check_circle</i> ${t('simcard.btn_enable')}`;
            submitBtn.style.backgroundColor = 'var(--primary-green)';
        }
        modal.style.display = 'flex';
    };

    window.closeActiveToggleModal = function() {
        document.getElementById('activeToggleModal').style.display = 'none';
    };

    window.closeRepeatedConfirmModal = function() {
        const modal = document.getElementById('repeatedConfirmModal');
        if (modal) modal.style.display = 'none';
    };

    // ==========================================
    // 7. 全局 Escape 键关闭事件
    // ==========================================
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.custom-modal').forEach(m => {
                if (m.style.display !== 'none') {
                    // 对于需要特殊处理的关闭（如清空 canvas/销毁 cropper）
                    if (m.id === 'cropModal' && typeof window.closeCropModal === 'function') window.closeCropModal();
                    else if (m.id === 'scrapModal' && typeof window.closeScrapModal === 'function') window.closeScrapModal();
                    else m.style.display = 'none'; // 粗暴但有效的兜底关闭
                }
            });
        }
    });

})();