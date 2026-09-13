// Mobile 图片上传：查询补全 → 扫码/选图 → 裁剪压缩 → 上传 → 离页清理。
(() => {
    let scannerSequence = 0;

    window.initMobileUploadPage = function(pageContainer, pageSignal) {
        const ctrlInput = pageContainer.querySelector('#ctrlInput');
        const pn1Input = pageContainer.querySelector('#pn1Input');
        const pn2Input = pageContainer.querySelector('#pn2Input');
        const fileInput = pageContainer.querySelector('#fileInput');
        const noticeBox = pageContainer.querySelector('#uploadNotice');
        const cropModal = pageContainer.querySelector('#cropModal');
        const cropImage = pageContainer.querySelector('#cropImage');
        const scannerModal = pageContainer.querySelector('#scannerModal');
        const existingImagePreview = pageContainer.querySelector('#existingImagePreview');
        const finalPreview = pageContainer.querySelector('#finalPreview');
        const submitButton = pageContainer.querySelector('#submitBtn');
        window.M_UPLOAD_DATA = null;
        let requestVersion = 0;
        let imageVersion = 0;
        let isSubmitting = false;
        let isQuerying = false;
        let isProcessingImage = false;
        let isDestroyed = false;
        let cropper = null;
        let fileReader = null;
        let compressedBlob = null;
        let previewUrl = '';
        let existingImageLoader = null;
        let existingImageUrl = '';
        let scannerSession = null;
        let openModal = null;
        let previousFocus = null;
        let previousOverflow = '';
        const flashTimers = new Map();

        function isPageActive() {
            return !isDestroyed && !pageSignal.aborted && pageContainer.isConnected;
        }

        // 1. 更新按钮和图片状态，翻译切换不重置用户正在编辑的数据。
        function renderUploadState() {
            const isBusy = isSubmitting || isProcessingImage;
            pageContainer.querySelectorAll('[data-query-type], [data-action="scan"], [data-action="choose-photo"], #fileInput').forEach(element => {
                element.disabled = isBusy;
                element.setAttribute('aria-disabled', String(isBusy));
            });
            pageContainer.querySelector('#cameraBtn').style.display = !compressedBlob && !existingImageUrl ? 'flex' : 'none';
            pageContainer.querySelector('#existingImageBtn').style.display = !compressedBlob && existingImageUrl ? 'flex' : 'none';
            pageContainer.querySelector('#previewArea').style.display = compressedBlob || isProcessingImage ? 'block' : 'none';
            submitButton.disabled = isBusy || isQuerying || !compressedBlob;
            submitButton.querySelector('i').textContent = isSubmitting ? 'hourglass_empty' : 'cloud_upload';
            submitButton.querySelector('span').textContent = t(isSubmitting ? 'mobile_upload.msg_uploading' : 'mobile_upload.btn_submit');
            pageContainer.querySelector('#fileInfo').textContent = isProcessingImage ? t('mobile_upload.msg_compressing') :
                compressedBlob ? t('mobile_upload.msg_process_done').replace('{size}', (compressedBlob.size / 1024).toFixed(1)) : '';
        }

        function flashGreen(element) {
            clearTimeout(flashTimers.get(element));
            element.classList.add('correct-flash');
            flashTimers.set(element, setTimeout(() => {
                element.classList.remove('correct-flash');
                flashTimers.delete(element);
            }, 600));
        }

        function clearExistingImage() {
            if (existingImageLoader) {
                existingImageLoader.onload = null;
                existingImageLoader.onerror = null;
                existingImageLoader.removeAttribute('src');
                existingImageLoader = null;
            }
            existingImageUrl = '';
            existingImagePreview.removeAttribute('src');
        }

        // 2. 旧查询接口返回裸对象；保留登录处理并拒绝失效、过期的查询结果。
        async function fetchAutoFill(query, type) {
            if (isSubmitting || !isPageActive()) return;
            const currentVersion = ++requestVersion;
            clearExistingImage();
            window.M_UPLOAD_DATA = null;
            isQuerying = !!query;
            noticeBox.className = '';
            noticeBox.textContent = '';
            renderUploadState();
            if (!query) return;
            const url = type === 'ctrl' ? '/api/asset_info/' : '/api/item/';
            try {
                const response = await fetch(url + encodeURIComponent(query), { signal: pageSignal });
                if (!isPageActive() || currentVersion !== requestVersion) return;
                if (response.status === 401 || (response.redirected && new URL(response.url).pathname.includes('login'))) {
                    window.location.assign('/mobile/login');
                    throw new Error(t('mspa.login'));
                }
                if (!response.headers.get('content-type')?.includes('application/json')) throw new Error(t('mobile_upload.msg_query_fail'));
                const data = await response.json();
                if (!isPageActive() || currentVersion !== requestVersion) return;
                if (!response.ok || data.error) throw new Error(data.error || data.message || t('mobile_upload.msg_query_fail'));
                window.M_UPLOAD_DATA = data;
                const matchType = data.match_type;
                if (type === 'ctrl') {
                    pn1Input.value = data.pn_1 || '';
                    pn2Input.value = data.pn_2 || '';
                    flashGreen(pn1Input);
                    flashGreen(pn2Input);
                } else if (matchType === 'pn_2') {
                    pn1Input.value = data.pn_1 || '';
                    pn2Input.value = data.pn_2 || query;
                    flashGreen(pn1Input);
                    flashGreen(pn2Input);
                } else {
                    pn1Input.value = data.pn_1 || pn1Input.value;
                    pn2Input.value = data.pn_2 || '';
                    flashGreen(type === 'pn1' ? pn2Input : pn1Input);
                }
                if (data.has_image) {
                    const isAsset = type === 'ctrl' || data.item_type === 'asset';
                    const imageName = isAsset ? data.pn_1 : data.id;
                    const imageUrl = '/static/' + (isAsset ? 'asset_images/' : 'item_images/') + encodeURIComponent(imageName) + '.jpg?t=' + Date.now();
                    const imageLoader = new Image();
                    existingImageLoader = imageLoader;
                    imageLoader.onload = function() {
                        if (!isPageActive() || currentVersion !== requestVersion) return;
                        existingImageUrl = imageUrl;
                        existingImagePreview.src = imageUrl;
                        imageLoader.onload = null;
                        imageLoader.onerror = null;
                        existingImageLoader = null;
                        renderUploadState();
                    };
                    imageLoader.onerror = function() {
                        if (!isPageActive() || currentVersion !== requestVersion) return;
                        clearExistingImage();
                        renderUploadState();
                    };
                    imageLoader.src = imageUrl;
                }
            } catch (error) {
                if (!isPageActive() || currentVersion !== requestVersion || error.name === 'AbortError') return;
                noticeBox.className = 'mobile-error';
                noticeBox.textContent = error.message;
            } finally {
                if (isPageActive() && currentVersion === requestVersion) {
                    isQuerying = false;
                    renderUploadState();
                }
            }
        }

        function showModal(modal) {
            previousFocus = document.activeElement;
            previousOverflow = document.body.style.overflow;
            openModal = modal;
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            modal.querySelector('button').focus();
        }

        function hideModal(modal) {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
            if (openModal !== modal) return;
            openModal = null;
            document.body.style.overflow = previousOverflow;
            if (isPageActive() && previousFocus?.isConnected) previousFocus.focus();
        }

        // 3. 选图和裁剪：读取任务、裁剪实例及预览 URL 都随页面释放。
        function cancelCrop() {
            imageVersion++;
            if (fileReader) {
                fileReader.onload = null;
                fileReader.onerror = null;
                if (fileReader.readyState === 1) fileReader.abort();
                fileReader = null;
            }
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
            cropImage.onload = null;
            cropImage.onerror = null;
            cropImage.removeAttribute('src');
            fileInput.value = '';
            hideModal(cropModal);
        }

        function loadPhoto(file) {
            if (!file || isSubmitting || isProcessingImage || !isPageActive()) return;
            cancelCrop();
            const currentVersion = imageVersion;
            noticeBox.className = '';
            noticeBox.textContent = '';
            if (file.type && !file.type.startsWith('image/')) {
                noticeBox.className = 'mobile-error';
                noticeBox.textContent = t('mspa.imageProcessError');
                return;
            }
            const reader = new FileReader();
            fileReader = reader;
            reader.onload = function() {
                if (!isPageActive() || currentVersion !== imageVersion) return;
                fileReader = null;
                cropImage.onload = function() {
                    if (!isPageActive() || currentVersion !== imageVersion) return;
                    cropImage.onload = null;
                    try {
                        cropper = new Cropper(cropImage, {
                            viewMode: 1,
                            dragMode: 'move',
                            aspectRatio: NaN,
                            autoCropArea: 0.9,
                            background: false
                        });
                    } catch (error) {
                        cancelCrop();
                        noticeBox.className = 'mobile-error';
                        noticeBox.textContent = t('mspa.imageProcessError');
                    }
                };
                cropImage.onerror = function() {
                    if (!isPageActive() || currentVersion !== imageVersion) return;
                    cancelCrop();
                    noticeBox.className = 'mobile-error';
                    noticeBox.textContent = t('mspa.imageProcessError');
                };
                showModal(cropModal);
                cropImage.src = reader.result;
            };
            reader.onerror = function() {
                if (!isPageActive() || currentVersion !== imageVersion) return;
                fileReader = null;
                noticeBox.className = 'mobile-error';
                noticeBox.textContent = t('mspa.imageProcessError');
            };
            reader.readAsDataURL(file);
        }

        async function compressToTargetSize(sourceCanvas, currentVersion) {
            let quality = 0.9;
            let scale = 1;
            const canvas = document.createElement('canvas');
            try {
                for (let attempt = 0; attempt < 40; attempt++) {
                    if (!isPageActive() || currentVersion !== imageVersion) return null;
                    canvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
                    canvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
                    canvas.getContext('2d').drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
                    if (!isPageActive() || currentVersion !== imageVersion) return null;
                    if (!blob) throw new Error(t('mspa.imageProcessError'));
                    if (blob.size <= 100 * 1024 || (quality <= 0.3 && scale <= 0.3)) return blob;
                    if (quality > 0.3) quality = Math.max(0.3, quality - 0.15);
                    else {
                        scale *= 0.8;
                        quality = 0.8;
                    }
                }
                throw new Error(t('mspa.imageProcessError'));
            } finally {
                canvas.width = canvas.height = 1;
                sourceCanvas.width = sourceCanvas.height = 1;
            }
        }

        async function confirmCrop() {
            if (!cropper || isProcessingImage || !isPageActive()) return;
            const currentVersion = imageVersion;
            isProcessingImage = true;
            renderUploadState();
            try {
                const canvas = cropper.getCroppedCanvas({ maxWidth: 1600, maxHeight: 1600 });
                if (!canvas?.width || !canvas.height) throw new Error(t('mspa.imageProcessError'));
                cropper.destroy();
                cropper = null;
                cropImage.onload = null;
                cropImage.onerror = null;
                cropImage.removeAttribute('src');
                hideModal(cropModal);
                const blob = await compressToTargetSize(canvas, currentVersion);
                if (!blob || !isPageActive() || currentVersion !== imageVersion) return;
                compressedBlob = blob;
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                previewUrl = URL.createObjectURL(blob);
                finalPreview.src = previewUrl;
                fileInput.value = '';
            } catch (error) {
                if (!isPageActive() || currentVersion !== imageVersion) return;
                noticeBox.className = 'mobile-error';
                noticeBox.textContent = error.message || t('mspa.imageProcessError');
            } finally {
                if (isPageActive() && currentVersion === imageVersion) {
                    isProcessingImage = false;
                    renderUploadState();
                }
            }
        }

        // 4. 上传成功后重置，失败保留图片和型号，允许重试。
        async function uploadData() {
            if (isSubmitting || isProcessingImage || isQuerying || !compressedBlob || !isPageActive()) return;
            const pnToSubmit = pn1Input.value.trim();
            if (!pnToSubmit) {
                noticeBox.className = 'mobile-error';
                noticeBox.textContent = t('mobile_upload.msg_need_pn1');
                pn1Input.focus();
                return;
            }
            isSubmitting = true;
            requestVersion++;
            noticeBox.className = '';
            noticeBox.textContent = '';
            renderUploadState();
            const formData = new FormData();
            formData.append('pn', pnToSubmit);
            formData.append('file', compressedBlob, 'upload.jpg');
            try {
                // 与审批页一致：提交后离页只忽略响应，不把服务器写入当作已取消。
                await window.requestMobileJson('/api/mobile_upload_image', { method: 'POST', body: formData });
                if (!isPageActive()) return;
                ctrlInput.value = '';
                pn1Input.value = '';
                pn2Input.value = '';
                fileInput.value = '';
                compressedBlob = null;
                window.M_UPLOAD_DATA = null;
                clearExistingImage();
                finalPreview.removeAttribute('src');
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                previewUrl = '';
                noticeBox.textContent = t('mobile_upload.msg_upload_success');
            } catch (error) {
                if (!isPageActive()) return;
                noticeBox.className = 'mobile-error';
                noticeBox.textContent = t('mobile_upload.msg_upload_fail') + error.message;
            } finally {
                if (isPageActive()) {
                    isSubmitting = false;
                    renderUploadState();
                }
            }
        }

        // 5. 扫码：关闭时立即隐藏，等待尚未完成的 start 后再停止同一实例。
        async function startScanner(targetId) {
            if (scannerSession || openModal || fileReader || isSubmitting || isProcessingImage || !isPageActive()) return;
            if (!window.isSecureContext) {
                noticeBox.className = 'mobile-error';
                noticeBox.textContent = t('mobile_upload.msg_https_warn');
                return;
            }
            const host = document.createElement('div');
            host.id = 'mobileUploadReader' + (++scannerSequence);
            pageContainer.querySelector('#reader').appendChild(host);
            const session = { host, scanner: null, startPromise: null, stopPromise: null, closing: false, decoded: false };
            scannerSession = session;
            showModal(scannerModal);
            try {
                session.scanner = new Html5Qrcode(host.id);
                session.startPromise = Promise.resolve().then(() => {
                    if (!isPageActive() || session.closing) return;
                    return session.scanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: (width, height) => ({ width: Math.max(1, Math.min(320, width - 20)), height: Math.max(1, Math.min(100, height - 20)) }), aspectRatio: 1 },
                    decodedText => {
                        if (!isPageActive() || session.closing || session.decoded) return;
                        session.decoded = true;
                        const targetInput = pageContainer.querySelector('#' + targetId);
                        targetInput.value = decodedText.trim();
                        if (navigator.vibrate) navigator.vibrate(100);
                        stopScanner();
                        fetchAutoFill(targetInput.value, targetInput.dataset.queryType);
                    }
                    );
                });
                await session.startPromise;
                if (!isPageActive() || session.closing) stopScanner();
            } catch (error) {
                if (isPageActive() && !session.closing) {
                    noticeBox.className = 'mobile-error';
                    noticeBox.textContent = t('mobile_upload.msg_cam_deny');
                }
                stopScanner();
            }
        }

        function stopScanner() {
            hideModal(scannerModal);
            const session = scannerSession;
            if (!session) return;
            session.closing = true;
            if (session.stopPromise) return session.stopPromise;
            session.stopPromise = (async () => {
                try {
                    if (session.startPromise) await session.startPromise.catch(() => {});
                    if (session.scanner?.isScanning) await session.scanner.stop();
                } catch (error) {
                    console.warn('Unable to stop upload scanner', error);
                } finally {
                    session.host.querySelectorAll('video').forEach(video => {
                        video.srcObject?.getTracks().forEach(track => track.stop());
                    });
                    try { session.scanner?.clear(); } catch (error) { console.warn('Unable to clear upload scanner', error); }
                    session.host.remove();
                    if (scannerSession === session) scannerSession = null;
                }
            })();
            return session.stopPromise;
        }

        // 6. 页面事件委托及离页清理。
        function handlePageClick(e) {
            const button = e.target.closest('[data-action]');
            if (!button || !pageContainer.contains(button) || button.disabled) return;
            const action = button.dataset.action;
            if (action === 'stop-scanner') stopScanner();
            else if (action === 'cancel-crop') cancelCrop();
            else if (isSubmitting || isProcessingImage) return;
            else if (action === 'scan') startScanner(button.dataset.target);
            else if (action === 'choose-photo') fileInput.click();
            else if (action === 'confirm-crop') confirmCrop();
            else if (action === 'upload') uploadData();
        }

        function handlePageInput(e) {
            if (!e.target.dataset.queryType) return;
            requestVersion++;
            isQuerying = false;
            window.M_UPLOAD_DATA = null;
            clearExistingImage();
            renderUploadState();
        }

        function handleFocusOut(e) {
            if (e.target.dataset.queryType) fetchAutoFill(e.target.value.trim(), e.target.dataset.queryType);
        }

        function handleKeydown(e) {
            if (openModal) {
                if (e.key === 'Escape') {
                    if (openModal === scannerModal) stopScanner();
                    else if (!isProcessingImage) cancelCrop();
                }
                if (e.key !== 'Tab' || !openModal) return;
                const buttons = Array.from(openModal.querySelectorAll('button')).filter(button => !button.disabled);
                const first = buttons[0];
                const last = buttons[buttons.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            } else if (['Enter', ' '].includes(e.key) && pageContainer.contains(e.target) && e.target.matches('[role="button"]')) {
                e.preventDefault();
                e.target.click();
            } else if (e.key === 'Enter' && e.target.dataset.queryType && pageContainer.contains(e.target)) {
                e.preventDefault();
                e.target.blur();
            }
        }

        function destroyMobileUploadPage() {
            if (isDestroyed) return;
            isDestroyed = true;
            requestVersion++;
            cancelCrop();
            // 唯一宿主保留到异步 start/stop 结束，避免旧相机实例操作下一页的 #reader。
            if (scannerSession) {
                scannerSession.host.style.display = 'none';
                document.body.appendChild(scannerSession.host);
            }
            stopScanner();
            clearExistingImage();
            cropImage.onload = null;
            cropImage.onerror = null;
            finalPreview.removeAttribute('src');
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = '';
            compressedBlob = null;
            flashTimers.forEach(timer => clearTimeout(timer));
            flashTimers.clear();
            pageContainer.onclick = null;
            pageContainer.oninput = null;
            pageContainer.removeEventListener('focusout', handleFocusOut);
            pageContainer.onchange = null;
            document.removeEventListener('keydown', handleKeydown);
            pageSignal.removeEventListener('abort', destroyMobileUploadPage);
            window.onCurrentViewLanguageChange = null;
        }

        pageContainer.onclick = handlePageClick;
        pageContainer.oninput = handlePageInput;
        pageContainer.addEventListener('focusout', handleFocusOut);
        pageContainer.onchange = e => { if (e.target === fileInput) loadPhoto(fileInput.files[0]); };
        document.addEventListener('keydown', handleKeydown);
        pageSignal.addEventListener('abort', destroyMobileUploadPage, { once: true });
        window.onCurrentViewLanguageChange = renderUploadState;
        renderUploadState();
        return destroyMobileUploadPage;
    };
})();
