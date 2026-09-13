// Mobile 消耗品盘点：数据加载 → 库位与表单 → 扫码定位 → 保存与同步 → 离页清理。
(() => {
    let scannerSequence = 0;

    window.initMobileAuditInventoryPage = function(pageContainer, pageSignal) {
        const auditList = pageContainer.querySelector('#auditListWrapper');
        const commitText = pageContainer.querySelector('.btn-commit span');
        const scanInput = pageContainer.querySelector('#scanInput');
        const resultBox = pageContainer.querySelector('#scanResultBox');
        const scannerModal = pageContainer.querySelector('#scannerModal');
        const auditPage = pageContainer.querySelector('#mobileAuditInventory');
        const actionRow = auditPage.querySelector('.action-row');
        const mobileHeader = document.querySelector('.header');
        const scanCard = pageContainer.querySelector('#scanCardBox');
        const layoutObserver = new ResizeObserver(updateStickyLayout);
        const isAdmin = ['admin', 'superadmin'].includes(window.CURRENT_USER.role);
        window.M_AUDIT_INVENTORY_DATA = { grouped: {}, stats: { total: 0, completed: 0, progress: 0 } };
        const draftValues = new Map();
        const collapsedLocations = new Map();
        const timers = new Set();
        let requestVersion = 0;
        let isLoading = false;
        let isSubmitting = false;
        let isDestroyed = false;
        let scannerSession = null;
        let previousFocus = null;
        let previousOverflow = '';
        let scanResult = null;
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
                    if (isPageActive()) setCommitStatus('mspa.auditCommit');
                }, 2000);
            }
        }

        // 1. 生成库位和表单：只把固定结构放入 HTML，服务端文字与输入值单独赋值。
        function renderAudit() {
            auditList.querySelectorAll('.location-block').forEach(block => {
                collapsedLocations.set(block.dataset.location, block.classList.contains('collapsed'));
            });
            const groups = Object.entries(window.M_AUDIT_INVENTORY_DATA.grouped);
            auditList.innerHTML = groups.map(([, items]) => `
                <div class="location-block">
                    <div class="location-header" role="button" tabindex="0" data-action="toggle-location">
                        <h3>
                            <i class="material-icons collapse-icon">expand_more</i>
                            <i class="material-icons" style="font-size: 1.2rem; color: #888;">place</i>
                            <span data-field="location"></span>
                        </h3>
                        <span class="loc-badge"></span>
                    </div>
                    <div class="location-body">
                        ${items.map(() => `
                            <form class="audit-form" method="post">
                                <div class="item-header">
                                    <div style="display: flex; justify-content: space-between; width:100%">
                                        <h4 class="item-title font-monospace" data-field="pn_1"></h4>
                                        <p class="item-pn2 font-monospace" data-field="pn_2"></p>
                                    </div>
                                    <p class="item-name" data-field="name" style="width: 80%; white-space:nowrap; overflow: hidden; text-overflow: ellipsis;"></p>
                                    <span class="status-badge" style="position: absolute; right:2px; bottom: 2px;"></span>
                                </div>
                                <div style="display: flex; justify-content: space-between; gap: 10px;">
                                    <div class="form-row">
                                        <label data-label="actual_stock" style="color: var(--primary-blue);" data-i18n="mobile_audit_inv.real_stock">${t('mobile_audit_inv.real_stock')}</label>
                                        <input type="number" name="actual_stock" class="qty-input" min="0" step="1" inputmode="numeric" required>
                                    </div>
                                    <div class="form-row">
                                        <label data-i18n="mobile_audit_inv.expected_stock">${t('mobile_audit_inv.expected_stock')}</label>
                                        <div data-field="expected_stock" style="flex: 1; padding: 8px 8px; font-weight: bold; color: #666;"></div>
                                    </div>
                                </div>
                                <div class="form-row">
                                    <label data-label="remarks" data-i18n="mobile_audit_inv.audit_note">${t('mobile_audit_inv.audit_note')}</label>
                                    <input type="text" name="remarks" data-i18n-placeholder="mobile_audit_inv.ph_audit_note">
                                </div>
                                <div class="card-footer">
                                    <div class="form-row">
                                        <label data-label="actual_location" data-i18n="mobile_audit_inv.real_loc">${t('mobile_audit_inv.real_loc')}</label>
                                        <input type="text" name="actual_location" autocomplete="off">
                                    </div>
                                    <button type="submit" class="btn-save">
                                        <i class="material-icons" style="font-size: 1.1rem;">save</i>
                                        <span data-i18n="mobile_audit_inv.save_audit">${t('mobile_audit_inv.save_audit')}</span>
                                    </button>
                                </div>
                            </form>
                        `).join('')}
                    </div>
                </div>
            `).join('') || `<p class="empty-state">${t('mspa.auditEmpty')}</p>`;

            auditList.querySelectorAll('.location-block').forEach((block, groupIndex) => {
                const [location, items] = groups[groupIndex];
                const allDone = items.every(item => item.status && item.status !== 'Pending');
                block.dataset.loc = location.toLowerCase();
                block.dataset.location = location;
                block.classList.toggle('collapsed', collapsedLocations.get(location) ?? allDone);
                block.querySelector('.location-header').setAttribute('aria-expanded', String(!block.classList.contains('collapsed')));
                block.querySelector('[data-field="location"]').textContent = location;
                const badge = block.querySelector('.loc-badge');
                badge.textContent = t('mobile_audit_inv.loc_counting').replace('{count}', items.length);
                badge.classList.toggle('all-done', allDone);

                block.querySelectorAll('.audit-form').forEach((form, itemIndex) => {
                    const item = items[itemIndex];
                    const draft = draftValues.get(String(item.id));
                    form.id = 'auditForm_' + item.id;
                    form.action = '/audit/submit/' + encodeURIComponent(item.id);
                    form.dataset.id = item.id;
                    form.dataset.pn1 = String(item.pn_1 || '').toLowerCase();
                    form.dataset.pn2 = String(item.pn_2 || '').toLowerCase();
                    form.querySelector('[data-field="pn_1"]').textContent = item.pn_1 || '';
                    form.querySelector('[data-field="name"]').textContent = item.name || '';
                    form.querySelector('[data-field="pn_2"]').textContent = item.pn_2 ? item.pn_2 : '';
                    form.querySelector('[data-field="pn_2"]').hidden = !item.pn_2;
                    form.querySelector('[data-field="expected_stock"]').textContent = item.expected_stock ?? 0;
                    form.querySelector('[name="actual_stock"]').value = draft?.actual_stock ?? item.actual_stock ?? item.expected_stock ?? 0;
                    form.querySelector('[name="actual_location"]').value = draft?.actual_location ?? (item.actual_location || item.expected_location || '');
                    form.querySelector('[name="remarks"]').value = draft?.remarks ?? item.remarks ?? '';
                    form.querySelector('[name="remarks"]').placeholder = t('mobile_audit_inv.ph_audit_note');
                    form.querySelectorAll('[data-label]').forEach(label => {
                        const input = form.elements.namedItem(label.dataset.label);
                        input.id = label.dataset.label + '_' + item.id;
                        label.htmlFor = input.id;
                    });
                    form.querySelector('.status-badge').id = 'status-' + item.id;
                    form.querySelector('.btn-save').id = 'btn-' + item.id;
                    form.querySelector('.card-footer').hidden = !isAdmin;
                    renderAuditStatus(form, item);
                });
            });
            renderProgress();
            updateControls();
        }

        function renderAuditStatus(form, item) {
            const badge = form.querySelector('.status-badge');
            if (!item.status || item.status === 'Pending') {
                badge.className = 'status-badge status-pending';
                badge.textContent = t('audit.status_uncounted');
            } else if (item.status === 'Matched') {
                badge.className = 'status-badge status-matched';
                badge.textContent = t('mspa.auditMatched');
            } else {
                // 后端差异状态名为 Issue，复用旧页面的橙色差异样式。
                badge.className = 'status-badge status-mismatched';
                badge.textContent = t('mspa.auditIssue');
            }
        }

        function renderProgress() {
            const stats = window.M_AUDIT_INVENTORY_DATA.stats;
            pageContainer.querySelector('#auditProgress').textContent = `${t('status.audit')}: ${stats.progress || 0}% (${stats.completed || 0}/${stats.total || 0})`;
        }

        function updateControls() {
            pageContainer.querySelectorAll('button').forEach(button => {
                if (button.dataset.action !== 'close-scanner') button.disabled = isLoading || isSubmitting;
            });
            auditList.querySelectorAll('input').forEach(input => {
                input.disabled = !isAdmin || isLoading || isSubmitting;
            });
            scanInput.disabled = isLoading || isSubmitting;
        }

        // 2. 加载数据：请求带离页取消信号，较早的响应不能覆盖当前状态。
        async function loadAuditData() {
            const currentVersion = ++requestVersion;
            isLoading = true;
            updateControls();
            setCommitStatus('mspa.loading');
            try {
                const result = await window.requestMobileJson('/api/mobile/audit_inventory', { signal: pageSignal });
                if (!isPageActive() || currentVersion !== requestVersion) return;
                window.M_AUDIT_INVENTORY_DATA = result.data;
                renderAudit();
                setCommitStatus(isAdmin ? 'mspa.auditCommit' : 'mspa.auditReadOnly');
                return true;
            } catch (error) {
                if (!isPageActive() || error.name === 'AbortError' || currentVersion !== requestVersion) return;
                setCommitStatus(null, error.message || t('mspa.requestError'));
                return false;
            } finally {
                if (isPageActive() && currentVersion === requestVersion) {
                    isLoading = false;
                    updateControls();
                }
            }
        }

        // 3. 扫码定位：先匹配库位，再匹配 PN1 / PN2，保持旧页面的折叠、高亮和数量聚焦。
        function doScanSearch(value) {
            if (!isPageActive() || isLoading || isSubmitting) return;
            const term = String(value).trim().toLowerCase();
            if (!term) return;
            const blocks = Array.from(auditList.querySelectorAll('.location-block'));
            let targetBlock = blocks.find(block => block.dataset.loc === term);
            let targetForm = null;
            if (!targetBlock) {
                const forms = Array.from(auditList.querySelectorAll('.audit-form'));
                targetForm = forms.find(form => form.dataset.pn1 === term) || forms.find(form => form.dataset.pn2 === term);
                targetBlock = targetForm?.closest('.location-block');
            }
            if (targetBlock) {
                blocks.forEach(block => {
                    const collapsed = block !== targetBlock;
                    block.classList.toggle('collapsed', collapsed);
                    block.querySelector('.location-header').setAttribute('aria-expanded', String(!collapsed));
                    collapsedLocations.set(block.dataset.location, collapsed);
                });
                const target = targetForm || targetBlock;
                const stickyHeight = mobileHeader.offsetHeight + actionRow.offsetHeight + scanCard.offsetHeight + 24;
                window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - stickyHeight, behavior: 'smooth' });
                if (targetForm) {
                    targetForm.classList.add('highlight-flash');
                    const flashTimer = setTimeout(() => {
                        timers.delete(flashTimer);
                        if (isPageActive()) targetForm.classList.remove('highlight-flash');
                    }, 1500);
                    timers.add(flashTimer);
                    const focusTimer = setTimeout(() => {
                        timers.delete(focusTimer);
                        if (isPageActive() && targetForm.isConnected && !isSubmitting && isAdmin) {
                            targetForm.elements.namedItem('actual_stock').focus({ preventScroll: true });
                        }
                    }, 400);
                    timers.add(focusTimer);
                } else {
                    const header = targetBlock.querySelector('.location-header');
                    header.style.background = '#e8f4f8';
                    const highlightTimer = setTimeout(() => {
                        timers.delete(highlightTimer);
                        if (isPageActive()) header.style.background = '';
                    }, 1000);
                    timers.add(highlightTimer);
                }
                scanResult = { type: targetForm ? 'item' : 'location', term, location: targetBlock.dataset.location };
            } else {
                scanResult = { type: 'missing', term };
            }
            renderScanResult();
            scanInput.value = '';
        }

        function renderScanResult() {
            if (!scanResult) return;
            resultBox.style.background = scanResult.type === 'missing' ? '#fce8e6' : '#e6f4ea';
            resultBox.style.color = scanResult.type === 'missing' ? '#d93025' : '#1e8e3e';
            if (scanResult.type === 'location') {
                resultBox.textContent = t('mspa.locationLocated').replace('{location}', scanResult.location);
            } else if (scanResult.type === 'item') {
                resultBox.textContent = '[' + scanResult.location + '] P/N: ' + scanResult.term.toUpperCase();
            } else {
                resultBox.textContent = t('mobile_audit_inv.no_result_found') + ': ' + scanResult.term.toUpperCase();
            }
        }

        // 4. 保存表单：锁住写操作，更新原始数据后按实际库位重新分组，保留其他卡片的草稿。
        async function handleFormSubmit(event) {
            const form = event.target;
            if (!form.matches('.audit-form')) return;
            event.preventDefault();
            if (!isAdmin || isLoading || isSubmitting || !form.reportValidity()) return;
            const item = Object.values(window.M_AUDIT_INVENTORY_DATA.grouped).flat().find(item => String(item.id) === form.dataset.id);
            if (!item) return;
            const formData = new FormData(form);
            isSubmitting = true;
            requestVersion++;
            updateControls();
            setCommitStatus('mspa.loading');
            try {
                // 已发送的写操作与 m_approve 一致：离页后忽略响应，不将操作误认为已取消。
                const result = await window.requestMobileJson('/audit/submit/' + encodeURIComponent(item.id), { method: 'POST', body: formData });
                if (!isPageActive()) return;
                Object.assign(item, result.data);
                draftValues.delete(String(item.id));
                const groups = new Map();
                const items = Object.values(window.M_AUDIT_INVENTORY_DATA.grouped).flat();
                items.forEach(record => {
                    const location = record.actual_location || record.expected_location || 'Unallocated';
                    if (!groups.has(location)) groups.set(location, []);
                    groups.get(location).push(record);
                });
                window.M_AUDIT_INVENTORY_DATA.grouped = Object.fromEntries(groups);
                const completed = items.filter(record => record.status && record.status !== 'Pending').length;
                window.M_AUDIT_INVENTORY_DATA.stats = { total: items.length, completed, progress: items.length ? Math.floor(completed / items.length * 100) : 0 };
                if (form.contains(document.activeElement)) document.activeElement.blur();
                renderAudit();
                const savedForm = Array.from(auditList.querySelectorAll('.audit-form')).find(card => card.dataset.id === String(item.id));
                savedForm.style.backgroundColor = item.status === 'Matched' ? '#e6f4ea' : '#fef5e5';
                const feedbackTimer = setTimeout(() => {
                    timers.delete(feedbackTimer);
                    if (isPageActive()) savedForm.style.backgroundColor = '';
                }, 800);
                timers.add(feedbackTimer);
                setCommitStatus('do.success');
            } catch (error) {
                if (!isPageActive()) return;
                setCommitStatus(null, error.message || t('mspa.requestError'));
                return false;
            } finally {
                isSubmitting = false;
                if (isPageActive()) updateControls();
            }
        }

        async function commitAudit() {
            if (!isAdmin || isLoading || isSubmitting) return;
            if (!window.confirm(t('mspa.auditCommitConfirm'))) return;
            isSubmitting = true;
            requestVersion++;
            updateControls();
            setCommitStatus('mspa.loading');
            try {
                await window.requestMobileJson('/api/audit/commit', { method: 'POST' });
                if (!isPageActive()) return;
                const didLoad = await loadAuditData();
                if (isPageActive() && didLoad) setCommitStatus('do.success');
            } catch (error) {
                if (!isPageActive()) return;
                setCommitStatus(null, error.message || t('mspa.requestError'));
                return false;
            } finally {
                isSubmitting = false;
                if (isPageActive()) updateControls();
            }
        }

        // 5. 摄像头：关闭时等待启动结束再释放；每次使用独立宿主，避免清理到新页面的 reader。
        async function startScanner() {
            if (scannerSession || isLoading || isSubmitting || !isPageActive()) return;
            if (!window.isSecureContext) {
                window.alert(t('mobile_upload.msg_https_warn'));
                return;
            }
            if (typeof window.Html5Qrcode !== 'function') {
                window.alert(t('mobile_upload.msg_cam_start_fail'));
                return;
            }
            const host = document.createElement('div');
            host.id = 'inventoryScannerReader' + (++scannerSequence);
            pageContainer.querySelector('#reader').replaceChildren(host);
            previousFocus = document.activeElement;
            previousOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            scannerModal.style.display = 'flex';
            scannerModal.setAttribute('aria-hidden', 'false');
            scannerModal.querySelector('button').focus();
            const session = { host, scanner: null, starting: null, stopping: null, cancelled: false, processing: false };
            scannerSession = session;
            try {
                session.scanner = new window.Html5Qrcode(host.id);
                session.starting = Promise.resolve().then(() => {
                    if (session.cancelled || !isPageActive()) return;
                    return session.scanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: Math.min(300, Math.max(120, host.clientWidth - 20)), height: 100 }, aspectRatio: 1.0 },
                    async decodedText => {
                        if (session.cancelled || session.processing || !isPageActive()) return;
                        session.processing = true;
                        if (navigator.vibrate) navigator.vibrate(100);
                        await stopScanner();
                        if (isPageActive()) doScanSearch(decodedText);
                    }
                    );
                });
                await session.starting;
                if (session.cancelled || !isPageActive()) await stopScanner();
            } catch (error) {
                if (isPageActive() && !session.cancelled) window.alert(t('mobile_upload.msg_cam_deny'));
                await stopScanner();
            }
        }

        function stopScanner() {
            const session = scannerSession;
            if (scannerModal.style.display === 'flex') {
                scannerModal.style.display = 'none';
                scannerModal.setAttribute('aria-hidden', 'true');
                document.body.style.overflow = previousOverflow;
                if (isPageActive() && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
            }
            if (!session) return Promise.resolve();
            session.cancelled = true;
            if (session.stopping) return session.stopping;
            session.stopping = (async () => {
                try {
                    await session.starting;
                } catch (error) {
                    // 启动失败也继续清理已创建的摄像头宿主。
                }
                try {
                    if (session.scanner?.isScanning) await session.scanner.stop();
                } catch (error) {
                    console.warn('无法停止盘点摄像头', error);
                } finally {
                    session.host.querySelectorAll('video').forEach(video => {
                        video.srcObject?.getTracks().forEach(track => track.stop());
                    });
                    try {
                        if (session.scanner) session.scanner.clear();
                    } catch (error) {
                        console.warn('无法清理盘点摄像头', error);
                    }
                    session.host.remove();
                    if (scannerSession === session) scannerSession = null;
                }
            })();
            return session.stopping;
        }

        // 6. 事件委托与语言切换：翻译时只更新文字，保留未保存输入与当前焦点。
        function handlePageClick(event) {
            const control = event.target.closest('[data-action]');
            if (!control || !pageContainer.contains(control)) return;
            const action = control.dataset.action;
            if (action === 'close-scanner') {
                stopScanner();
                return;
            }
            if (action === 'toggle-location') {
                const block = control.closest('.location-block');
                const collapsed = block.classList.toggle('collapsed');
                collapsedLocations.set(block.dataset.location, collapsed);
                control.setAttribute('aria-expanded', String(!collapsed));
                return;
            }
            if (isLoading || isSubmitting) return;
            if (action === 'scan') startScanner();
            if (action === 'commit') commitAudit();
        }

        function handlePageInput(event) {
            const form = event.target.closest('.audit-form');
            if (!form) return;
            draftValues.set(form.dataset.id, {
                actual_stock: form.elements.namedItem('actual_stock').value,
                actual_location: form.elements.namedItem('actual_location').value,
                remarks: form.elements.namedItem('remarks').value
            });
        }

        function handlePageKeydown(event) {
            if (event.target === scanInput && event.key === 'Enter') {
                event.preventDefault();
                doScanSearch(scanInput.value);
            }
            if (event.target.matches('.location-header') && ['Enter', ' '].includes(event.key)) {
                event.preventDefault();
                event.target.click();
            }
        }

        function handleModalKeydown(event) {
            if (scannerModal.style.display !== 'flex') return;
            if (event.key === 'Escape') stopScanner();
            if (event.key === 'Tab') {
                event.preventDefault();
                scannerModal.querySelector('button').focus();
            }
        }

        function handleLanguageChange() {
            renderProgress();
            const groups = window.M_AUDIT_INVENTORY_DATA.grouped;
            auditList.querySelectorAll('.location-block').forEach(block => {
                block.querySelector('.loc-badge').textContent = t('mobile_audit_inv.loc_counting').replace('{count}', groups[block.dataset.location].length);
            });
            const items = Object.values(groups).flat();
            auditList.querySelectorAll('.audit-form').forEach(form => {
                const item = items.find(item => String(item.id) === form.dataset.id);
                if (item) renderAuditStatus(form, item);
            });
            const emptyState = auditList.querySelector('.empty-state');
            if (emptyState) emptyState.textContent = t('mspa.auditEmpty');
        }

        function bindEvents() {
            pageContainer.querySelectorAll('[data-admin-only]').forEach(element => element.hidden = !isAdmin);
            pageContainer.onclick = handlePageClick;
            pageContainer.oninput = handlePageInput;
            pageContainer.onkeydown = handlePageKeydown;
            pageContainer.onsubmit = handleFormSubmit;
            document.addEventListener('keydown', handleModalKeydown);
            window.onCurrentViewLanguageChange = handleLanguageChange;
        }

        function destroyMobileAuditInventoryPage() {
            isDestroyed = true;
            requestVersion++;
            timers.forEach(timer => clearTimeout(timer));
            timers.clear();
            clearTimeout(commitStatusTimer);
            layoutObserver.disconnect();
            if (scannerSession) {
                scannerSession.host.style.display = 'none';
                document.body.appendChild(scannerSession.host);
            }
            stopScanner();
            pageContainer.onclick = null;
            pageContainer.oninput = null;
            pageContainer.onkeydown = null;
            pageContainer.onsubmit = null;
            document.removeEventListener('keydown', handleModalKeydown);
            if (window.onCurrentViewLanguageChange === handleLanguageChange) window.onCurrentViewLanguageChange = null;
        }

        pageContainer.querySelector('[data-scan-hint]').textContent = t('mobile_audit_inv.scan_input');
        scanInput.setAttribute('aria-label', t('mobile_audit_inv.scan_input'));
        bindEvents();
        updateStickyLayout();
        layoutObserver.observe(mobileHeader);
        layoutObserver.observe(actionRow);
        loadAuditData();
        return destroyMobileAuditInventoryPage;
    };
})();
