// Mobile 资产盘点：初始化 → 库位列表 → 扫码 → 同步 → 离页清理。
(() => {
    let scannerNumber = 0;

    window.initMobileAuditAssetPage = function(pageContainer, pageSignal) {
        const auditContainer = pageContainer.querySelector('#auditContainer');
        const commitText = pageContainer.querySelector('.btn-commit span');
        const auditPage = pageContainer.querySelector('#mobileAuditAsset');
        const actionRow = auditPage.querySelector('.action-row');
        const mobileHeader = document.querySelector('.header');
        const layoutObserver = new ResizeObserver(updateStickyLayout);
        const locationInput = pageContainer.querySelector('#scanLocation');
        const barcodeInput = pageContainer.querySelector('#scanBarcode');
        const resultBox = pageContainer.querySelector('#scanResult');
        const scanCard = pageContainer.querySelector('#scanCardBox');
        const scannerModal = pageContainer.querySelector('#scannerModal');
        const isAdmin = ['admin', 'superadmin'].includes(window.CURRENT_USER.role);
        window.M_AUDIT_ASSET_DATA = { grouped: {}, stats: {}, audited_locations: [] };
        let requestVersion = 0;
        let isLoading = false;
        let isSubmitting = false;
        let isDestroyed = false;
        let scannerSession = null;
        let flashTimer = null;
        let cardTimer = null;
        let previousFocus = null;
        let previousOverflow = '';
        let scanMessage = null;
        let commitStatusTimer = null;

        function isPageActive() {
            return !isDestroyed && !pageSignal.aborted && pageContainer.isConnected;
        }

        function updateStickyLayout() {
            auditPage.style.setProperty('--mobile-header-height', mobileHeader.offsetHeight + 'px');
            auditPage.style.setProperty('--audit-toolbar-height', actionRow.offsetHeight + 'px');
        }

        // 按钮提示共用一个计时器，新操作开始时取消上一次的文字还原。
        function setCommitStatus(key, errorMessage = '') {
            clearTimeout(commitStatusTimer);
            commitStatusTimer = null;
            if (errorMessage) {
                commitText.removeAttribute('data-i18n');
                commitText.textContent = errorMessage;
                return;
            }
            commitText.dataset.i18n = key;
            commitText.textContent = t(key);
            if (key === 'do.success') {
                commitStatusTimer = setTimeout(() => {
                    if (isPageActive()) setCommitStatus('mobile_audit_asset.sync');
                }, 2000);
            }
        }

        // 1. 渲染列表：保留库位折叠状态，服务端字段使用 textContent。
        function renderAssetAudit() {
            const stats = window.M_AUDIT_ASSET_DATA.stats;
            pageContainer.querySelector('#auditProgress').textContent = `${t('status.audit')}: ${stats.progress || 0}% (${stats.completed || 0}/${stats.total || 0})`;
            const collapsedLocations = new Map();
            auditContainer.querySelectorAll('.location-block').forEach(block => {
                collapsedLocations.set(block.dataset.location, block.classList.contains('collapsed'));
            });
            const locations = Object.entries(window.M_AUDIT_ASSET_DATA.grouped);
            auditContainer.innerHTML = locations.map(([location, items]) => {
                const isCollapsed = collapsedLocations.get(location) ?? items.every(item => item.status !== 'Pending');
                return `
                    <div class="location-block ${isCollapsed ? 'collapsed' : ''}">
                        <div class="location-header" role="button" tabindex="0" aria-expanded="${!isCollapsed}">
                            <h3><i class="material-icons collapse-icon">expand_more</i><span data-field="location"></span></h3>
                            <span style="background: #eef2f5; color: var(--primary-blue); padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;" data-field="count"></span>
                        </div>
                        <div class="location-body">
                            ${items.map(() => `
                                <div class="asset-card">
                                    <div class="asset-header">
                                        <div>
                                            <h4 class="asset-title" data-field="ctrl_no"></h4>
                                            <p class="asset-name" data-field="name"></p>
                                        </div>
                                        <span class="status-badge cell-status"></span>
                                    </div>
                                    <div class="asset-details">
                                        <div class="loc-compare">
                                            <span>${t('mobile_audit_asset.expected_loc')}: <strong data-field="expected_location"></strong></span>
                                            <span>${t('mobile_audit_asset.real_loc')}: <strong class="cell-actual-loc" style="color: var(--primary-blue);"></strong></span>
                                        </div>
                                        <div class="cell-time" style="color: #aaa;"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('') || `<p class="empty-state">${t('mspa.auditEmpty')}</p>`;

            auditContainer.querySelectorAll('.location-block').forEach((block, locationIndex) => {
                const [location, items] = locations[locationIndex];
                block.dataset.location = location;
                block.dataset.loc = (location === 'null' ? '' : location).toLowerCase();
                block.querySelector('[data-field="location"]').textContent = !location || location === 'null' ? t('asset_audit.unassigned') : location;
                block.querySelector('[data-field="count"]').textContent = t('mobile_audit_asset.loc_counting').replace('{count}', items.length);
                block.querySelectorAll('.asset-card').forEach((card, itemIndex) => {
                    const item = items[itemIndex];
                    const isPending = item.status === 'Pending';
                    const isMisplaced = item.actual_location !== item.expected_location;
                    card.id = 'card-' + item.ctrl_no;
                    card.dataset.controlNumber = item.ctrl_no;
                    card.querySelector('[data-field="ctrl_no"]').textContent = item.ctrl_no;
                    card.querySelector('[data-field="name"]').textContent = `${item.name || ''} (${item.pn_1 || '-'})`;
                    card.querySelector('[data-field="expected_location"]').textContent = item.expected_location || '-';
                    card.querySelector('.cell-actual-loc').textContent = item.status === 'Completed' ? item.actual_location || '-' : '-';
                    card.querySelector('.cell-time').textContent = item.scanned_at || '-';
                    const statusBadge = card.querySelector('.cell-status');
                    statusBadge.classList.add(isPending ? 'status-miss' : isMisplaced ? 'status-warn' : 'status-done');
                    statusBadge.textContent = isPending ? t('mobile_audit_asset.status_miss') : isMisplaced ? t('mobile_audit_asset.status_warn') : t('mobile_audit_asset.status_done');
                });
            });
        }

        // 2. 获取盘点快照，只接收当前页面最新一次请求。
        async function loadAuditData() {
            const currentVersion = ++requestVersion;
            isLoading = true;
            setControlsDisabled();
            setCommitStatus('mspa.loading');
            try {
                const result = await window.requestMobileJson('/api/mobile/audit_asset', { signal: pageSignal });
                if (!isPageActive() || currentVersion !== requestVersion) return false;
                window.M_AUDIT_ASSET_DATA = result.data;
                renderAssetAudit();
                setCommitStatus(isAdmin ? 'mobile_audit_asset.sync' : 'mspa.auditReadOnly');
                return true;
            } catch (error) {
                if (!isPageActive() || currentVersion !== requestVersion || error.name === 'AbortError') return false;
                setCommitStatus(null, window.requestErrorMessage(error) || t('mspa.requestError'));
                return false;
            } finally {
                if (isPageActive() && currentVersion === requestVersion) {
                    isLoading = false;
                    setControlsDisabled();
                }
            }
        }

        function setControlsDisabled() {
            pageContainer.querySelectorAll('.action-row button, #scanBarcode, [data-target="scanBarcode"]').forEach(control => {
                control.disabled = !isAdmin || isSubmitting || isLoading;
            });
            locationInput.disabled = isSubmitting;
            pageContainer.querySelector('[data-target="scanLocation"]').disabled = isSubmitting;
        }

        // 3. 库位定位和扫码反馈，手工输入与摄像头共用。
        function locateAuditLocation() {
            const location = locationInput.value.trim().toLowerCase();
            if (!location) return;
            const targetBlock = Array.from(auditContainer.querySelectorAll('.location-block')).find(block => block.dataset.loc === location);
            if (targetBlock) {
                targetBlock.classList.remove('collapsed');
                targetBlock.querySelector('.location-header').setAttribute('aria-expanded', 'true');
                window.scrollTo({ top: targetBlock.getBoundingClientRect().top + window.scrollY - mobileHeader.offsetHeight - actionRow.offsetHeight - scanCard.offsetHeight - 24, behavior: 'smooth' });
            }
            if (isAdmin) barcodeInput.focus({ preventScroll: true });
        }

        function showScanResult(message, icon, color) {
            scanMessage = { message, icon, color };
            resultBox.firstElementChild.style.color = color;
            resultBox.querySelector('[data-result-icon]').textContent = icon;
            const messageBox = resultBox.querySelector('[data-result-text]');
            messageBox.removeAttribute('data-i18n');
            messageBox.textContent = message;
        }

        function flashScanCard(color) {
            clearTimeout(flashTimer);
            scanCard.style.borderColor = color;
            scanCard.style.boxShadow = `0 0 15px ${color}`;
            flashTimer = setTimeout(() => {
                if (!isPageActive()) return;
                scanCard.style.borderColor = '';
                scanCard.style.boxShadow = '';
            }, 800);
        }

        async function submitAuditScan() {
            if (!isAdmin || isSubmitting || isLoading || !isPageActive()) return;
            const currentLocation = locationInput.value.trim();
            const controlNumber = barcodeInput.value.trim();
            if (!currentLocation || !controlNumber) {
                showScanResult(!currentLocation ? t('mobile_audit_asset.err_no_loc') : t('mspa.enterControlNumber'), 'error', 'var(--danger-red)');
                flashScanCard('var(--danger-red)');
                (!currentLocation ? locationInput : barcodeInput).focus();
                return;
            }
            const formData = new FormData();
            formData.set('ctrl_no', controlNumber);
            formData.set('current_location', currentLocation);
            isSubmitting = true;
            requestVersion++;
            setControlsDisabled();
            showScanResult(t('mspa.submitting'), 'autorenew', '#666');
            try {
                // 与审批页一致：提交已经发出时，离页只忽略结果，不取消已提交操作。
                const result = await window.requestMobileJson('/api/asset_audit/scan', { method: 'POST', body: formData });
                if (!isPageActive()) return;
                const item = Object.values(window.M_AUDIT_ASSET_DATA.grouped).flat().find(item => item.ctrl_no === controlNumber);
                if (item) {
                    item.actual_location = currentLocation;
                    item.status = 'Completed';
                }
                // 重新读取服务器时间和库位分组，语言切换时仍可从完整快照重画。
                await loadAuditData();
                if (!isPageActive()) return;
                const color = result.is_location_changed ? 'var(--warning-orange)' : 'var(--primary-green)';
                const message = result.is_location_changed
                    ? `${controlNumber}: ${t('asset_audit.scan_warn').replace('{expected_location}', result.expected_location || '-')}`
                    : result.message || `${t('mspa.success')}: ${controlNumber}`;
                showScanResult(message, result.is_location_changed ? 'warning' : 'check_circle', color);
                flashScanCard(color);
                barcodeInput.value = '';
                renderAssetAudit();
                const targetCard = Array.from(auditContainer.querySelectorAll('.asset-card')).find(card => card.dataset.controlNumber === controlNumber);
                if (targetCard) {
                    const targetBlock = targetCard.closest('.location-block');
                    targetBlock.classList.remove('collapsed');
                    targetBlock.querySelector('.location-header').setAttribute('aria-expanded', 'true');
                    targetCard.style.backgroundColor = '#e6f4ea';
                    clearTimeout(cardTimer);
                    cardTimer = setTimeout(() => {
                        if (isPageActive() && targetCard.isConnected) targetCard.style.backgroundColor = '';
                    }, 1000);
                    window.scrollTo({ top: targetCard.getBoundingClientRect().top + window.scrollY - mobileHeader.offsetHeight - actionRow.offsetHeight - scanCard.offsetHeight - 24, behavior: 'smooth' });
                }
            } catch (error) {
                if (!isPageActive()) return;
                showScanResult(window.requestErrorMessage(error), 'error', 'var(--danger-red)');
                flashScanCard('var(--danger-red)');
            } finally {
                isSubmitting = false;
                if (isPageActive()) {
                    setControlsDisabled();
                    barcodeInput.focus({ preventScroll: true });
                }
            }
        }

        // 4. 同步：确认后加锁，成功后重新读取完整盘点快照。
        async function handleFormSubmit(e) {
            const form = e.target;
            if (form.id !== 'assetAuditCommitForm') return;
            e.preventDefault();
            if (!isAdmin || isSubmitting || isLoading || !isPageActive()) return;
            if (!window.confirm(t('asset_audit.confirm_commit'))) return;
            isSubmitting = true;
            requestVersion++;
            setControlsDisabled();
            setCommitStatus('mspa.loading');
            try {
                await window.requestMobileJson('/api/asset_audit/commit', { method: 'POST' });
                if (!isPageActive()) return;
                const didLoad = await loadAuditData();
                if (!isPageActive()) return;
                if (didLoad) setCommitStatus('do.success');

            } catch (error) {
                if (!isPageActive()) return;
                setCommitStatus(null, window.requestErrorMessage(error) || t('mspa.requestError'));
            } finally {
                isSubmitting = false;
                if (isPageActive()) setControlsDisabled();
            }
        }

        // 5. 摄像头：每次扫描独立实例，关闭时等待尚未完成的 start 再 stop/clear。
        async function startScanner(targetId) {
            if (scannerSession || isSubmitting || !isPageActive() || (targetId === 'scanBarcode' && (!isAdmin || isLoading))) return;
            if (!window.isSecureContext) {
                showScanResult(t('mobile_upload.msg_https_warn'), 'error', 'var(--danger-red)');
                return;
            }
            if (typeof window.Html5Qrcode !== 'function') {
                showScanResult(t('mobile_upload.msg_cam_start_fail'), 'error', 'var(--danger-red)');
                return;
            }
            const reader = document.createElement('div');
            reader.id = `asset-audit-reader-${++scannerNumber}`;
            pageContainer.querySelector('#reader').replaceChildren(reader);
            const session = { reader, scanner: null, targetId, closing: false, handled: false, startPromise: null, stopPromise: null };
            scannerSession = session;
            previousFocus = document.activeElement;
            previousOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            scannerModal.style.display = 'flex';
            scannerModal.setAttribute('aria-hidden', 'false');
            pageContainer.querySelector('#scannerTip').textContent = targetId === 'scanLocation' ? t('mspa.scanLocation') : t('mspa.scanAsset');
            scannerModal.querySelector('button').focus();
            try {
                session.scanner = new window.Html5Qrcode(reader.id);
                session.startPromise = session.scanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 250, height: 100 }, aspectRatio: 1.0 },
                    decodedText => {
                        if (!isPageActive() || session.closing || session.handled || scannerSession !== session) return;
                        session.handled = true;
                        if (navigator.vibrate) navigator.vibrate(100);
                        pageContainer.querySelector('#' + session.targetId).value = decodedText.trim();
                        stopScanner();
                        if (session.targetId === 'scanBarcode') submitAuditScan();
                        else locateAuditLocation();
                    }
                );
                await session.startPromise;
                if (session.closing || !isPageActive()) await stopScanner();
            } catch (error) {
                if (isPageActive() && !session.closing) {
                    showScanResult(t('mobile_upload.msg_cam_deny'), 'error', 'var(--danger-red)');
                }
                await stopScanner();
            }
        }

        function stopScanner() {
            const session = scannerSession;
            if (!session) return Promise.resolve();
            if (session.stopPromise) return session.stopPromise;
            session.closing = true;
            scannerModal.style.display = 'none';
            scannerModal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = previousOverflow;
            if (isPageActive() && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
            session.stopPromise = (async () => {
                try {
                    await session.startPromise;
                } catch (error) {
                    // start 拒绝也要清理已经创建的 reader 和媒体流。
                }
                try {
                    if (session.scanner?.isScanning) await session.scanner.stop();
                } catch (error) {
                    console.warn('资产盘点摄像头停止失败', error);
                } finally {
                    session.reader.querySelectorAll('video').forEach(video => {
                        video.srcObject?.getTracks().forEach(track => track.stop());
                    });
                    try {
                        session.scanner?.clear();
                    } catch (error) {
                        console.warn('资产盘点摄像头清理失败', error);
                    }
                    session.reader.remove();
                    if (scannerSession === session) scannerSession = null;
                }
            })();
            return session.stopPromise;
        }

        // 6. 页面事件委托和语言切换。
        function handlePageClick(e) {
            if (!isPageActive()) return;
            if (e.target === scannerModal) {
                stopScanner();
                return;
            }
            const button = e.target.closest('button');
            if (button?.disabled) return;
            if (button?.dataset.action === 'close-scanner') stopScanner();
            else if (button?.dataset.action === 'scan') startScanner(button.dataset.target);
            const header = e.target.closest('.location-header');
            if (header) {
                const block = header.closest('.location-block');
                block.classList.toggle('collapsed');
                header.setAttribute('aria-expanded', String(!block.classList.contains('collapsed')));
            }
        }

        function handlePageKeydown(e) {
            if (e.key === 'Enter' && e.target === locationInput) {
                e.preventDefault();
                locateAuditLocation();
            } else if (e.key === 'Enter' && e.target === barcodeInput) {
                e.preventDefault();
                submitAuditScan();
            } else if (['Enter', ' '].includes(e.key) && e.target.classList.contains('location-header')) {
                e.preventDefault();
                e.target.click();
            }
        }

        function handleModalKeydown(e) {
            if (scannerModal.style.display !== 'flex') return;
            if (e.key === 'Escape') stopScanner();
            if (e.key === 'Tab') {
                e.preventDefault();
                scannerModal.querySelector('button').focus();
            }
        }

        function renderPageLanguage() {
            renderAssetAudit();
            if (!scanMessage) showScanResult(t('mobile_audit_asset.scanner_idle'), 'barcode_reader', '#999');
            if (scanMessage?.icon === 'barcode_reader') scanMessage = null;
            if (scannerSession && !scannerSession.closing) {
                pageContainer.querySelector('#scannerTip').textContent = scannerSession.targetId === 'scanLocation' ? t('mspa.scanLocation') : t('mspa.scanAsset');
            }
            pageContainer.querySelector('[data-target="scanLocation"]').setAttribute('aria-label', t('mspa.scanLocation'));
            pageContainer.querySelector('[data-target="scanBarcode"]').setAttribute('aria-label', t('mspa.scanAsset'));
        }

        // 7. 离页后停相机、清理事件和计时器，旧请求不得修改下一页。
        function destroyMobileAuditAssetPage() {
            if (isDestroyed) return;
            isDestroyed = true;
            requestVersion++;
            if (scannerSession) {
                scannerSession.reader.style.display = 'none';
                document.body.appendChild(scannerSession.reader);
            }
            stopScanner();
            clearTimeout(flashTimer);
            clearTimeout(cardTimer);
            clearTimeout(commitStatusTimer);
            layoutObserver.disconnect();
            pageContainer.onclick = null;
            pageContainer.onsubmit = null;
            pageContainer.onkeydown = null;
            document.removeEventListener('keydown', handleModalKeydown);
            pageSignal.removeEventListener('abort', destroyMobileAuditAssetPage);
            if (window.onCurrentViewLanguageChange === renderPageLanguage) window.onCurrentViewLanguageChange = null;
        }

        pageContainer.onclick = handlePageClick;
        pageContainer.onsubmit = handleFormSubmit;
        pageContainer.onkeydown = handlePageKeydown;
        document.addEventListener('keydown', handleModalKeydown);
        pageSignal.addEventListener('abort', destroyMobileAuditAssetPage, { once: true });
        window.onCurrentViewLanguageChange = renderPageLanguage;
        renderPageLanguage();
        updateStickyLayout();
        layoutObserver.observe(mobileHeader);
        layoutObserver.observe(actionRow);
        loadAuditData();
        return destroyMobileAuditAssetPage;
    };
})();
