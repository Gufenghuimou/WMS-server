// Mobile 审批页面：初始化 → 渲染 → 事件 → 弹窗 → 提交 → 离页清理。
(() => {
    window.initMobileApprovePage = function(pageContainer, pageSignal) {
        const requestList = pageContainer.querySelector('#approvalList');
        const noticeBox = pageContainer.querySelector('#approvalNotice');
        const approveModal = pageContainer.querySelector('#approveModal');
        const approveForm = pageContainer.querySelector('#approveForm');
        // 页面状态：列表数据、当前分类、当前操作和提交锁。
        window.M_APPROVE_DATA = { inv_req: [], asset_req: [] };
        let currentTab = 'inv_req';
        let currentOperation = null;
        let isSubmitting = false;
        let requestVersion = 0;
        let previousFocus = null;
        let previousOverflow = '';
        const isAdmin = ['admin', 'superadmin'].includes(window.CURRENT_USER.role);
        function isPageActive() {
            return !pageSignal.aborted && pageContainer.isConnected;
        }

        // 1. 渲染列表：根据当前分类显示消耗品或资产申请。
        function renderRequests() {
            pageContainer.querySelector('#inventoryCount').textContent = window.M_APPROVE_DATA.inv_req.length;
            pageContainer.querySelector('#assetCount').textContent = window.M_APPROVE_DATA.asset_req.length;
            pageContainer.querySelectorAll('[data-tab]').forEach(button => {
                button.setAttribute('aria-pressed', String(button.dataset.tab === currentTab));
            });
            const cardsHtml = window.M_APPROVE_DATA[currentTab].map(requestEntry => {
                const requestInfo = requestEntry.req;
                const relatedItem = requestEntry.item || requestEntry.asset;
                let canApprove = !!relatedItem;
                if (currentTab === 'asset_req') {
                    const supportedAction = ['require', 'return', 'broken'].includes(requestInfo.matter);
                    canApprove = supportedAction && (requestInfo.matter === 'require' || !!relatedItem);
                }

                let quantity = requestInfo.req_qty;
                let requestTypeHtml = '';
                if (currentTab === 'asset_req') {
                    requestTypeHtml = `<p>${t('mspa.' + requestInfo.matter)}</p>`;
                    if (requestInfo.matter !== 'require') quantity = 1;
                }

                let errorHtml = '';
                if (!canApprove) {
                    errorHtml = `<p class="mobile-error">${t('mspa.missing')}</p>`;
                }

                let buttonsHtml = '';
                if (isAdmin) {
                    buttonsHtml = `
                        <div class="req-actions">
                            <button type="button" class="btn-reject" data-action="reject">${t('mspa.reject')}</button>
                            <button type="button" class="btn-approve" data-action="approve" ${canApprove ? '' : 'disabled'}>${t('mspa.approve')}</button>
                        </div>
                        `;
                }

                return `
                    <article class="req-card" data-id="${requestInfo.id}">
                        <div class="req-card-header">
                            <div class="req-user">
                                <div class="req-avatar">
                                    <img class="user-avatar" src="/static/avatars/${encodeURIComponent(requestInfo.applicant_username)}.jpg" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                                    <i class="material-icons" style="display: none; color: #777; font-size:20px;">person</i>
                                </div>
                                <div>
                                    <strong><span data-field="applicant"></span></strong>
                                    <span class="req-dept"><span data-field="department"></span></span>
                                </div>
                            </div>
                            <div class="req-time"><span data-field="created_at"></span></div>
                        </div>
                        <div class="req-card-body">
                            <strong><span data-field="pn"></span></strong>
                            <p><span data-field="name"></span></p>
                            <p><span data-field="control"></span></p>
                            <p>${t('card.location', 'Location')}: <span data-field="location"></span></p>
                            ${requestTypeHtml}
                            <p class="req-note"><span data-field="note"></span></p>
                        </div>
                        <div class="req-qty-box">
                            <span>${t('mspa.quantity')}</span>
                            <strong>${quantity}</strong>
                        </div>
                        ${errorHtml}
                        ${buttonsHtml}
                    </article>
                    `;
            }).join('');

            requestList.innerHTML = cardsHtml || `<p class="empty-state">${t('mspa.empty')}</p>`;
            // ?????? textContent ???????????????? HTML?
            requestList.querySelectorAll('.req-card').forEach((card, index) => {
                const requestEntry = window.M_APPROVE_DATA[currentTab][index];
                const requestInfo = requestEntry.req;
                const relatedItem = requestEntry.item || requestEntry.asset;
                const fields = {
                    applicant: requestInfo.applicant,
                    department: requestInfo.department,
                    created_at: requestInfo.created_at,
                    pn: requestInfo.pn_1 || relatedItem?.pn_1,
                    name: requestInfo.item_name || requestInfo.asset_name || relatedItem?.name,
                    control: requestInfo.ctrl_no,
                    location: relatedItem?.location || '-',
                    note: requestInfo.note || t('queue.no_reason', '-')
                };
                card.querySelectorAll('[data-field]').forEach(element => {
                    element.textContent = fields[element.dataset.field] ?? '';
                });
            });

        }

        // 2. 获取数据：只接受最新一次请求的结果。
        async function loadRequestData() {
            const currentVersion = ++requestVersion;
            noticeBox.className = '';
            noticeBox.textContent = t('mspa.loading');
            try {
                const result = await window.requestMobileJson('/api/mobile/request_queue',{ signal: pageSignal });
                if (!isPageActive() || currentVersion !== requestVersion) return;
                window.M_APPROVE_DATA = result.data;
                renderRequests();
                noticeBox.textContent = isAdmin ? '' : t('mspa.readOnly');
            } catch(error) {
                if (!isPageActive() || error.name === 'AbortError' || currentVersion !== requestVersion) return;
                noticeBox.className = 'mobile-error';
                noticeBox.textContent = error.message;
            }
        }

        // 3. 打开弹窗：按申请类型生成对应表单。
        function openActionModal(requestEntry, actionType) {
            currentOperation = { requestEntry, actionType, requestType: currentTab };
            const requestInfo = requestEntry.req;
            pageContainer.querySelector('#approvalTitle').textContent = t('mspa.' + actionType);
            pageContainer.querySelector('#approvalSummary').textContent = [requestInfo.pn_1,requestInfo.ctrl_no,requestInfo.applicant,requestInfo.department].filter(Boolean).join(' · ');
            pageContainer.querySelector('#approvalError').textContent = '';
            let fieldsHtml = '';
            if (actionType === 'reject') {
                fieldsHtml = `<p>${t('mspa.rejectConfirm')}</p>`;
            } else if (currentTab === 'inv_req') {
                fieldsHtml = `
                    <p>${t('card.location', 'Location')}: <span id="approvalLocation"></span></p>
                    <p>${t('mspa.stock')}: ${requestEntry.item.stock ?? 0} / ${t('mspa.quantity')}: ${requestInfo.req_qty}</p>
                    <label class="input-group">
                    ${t('mspa.realStock')}
                    <input name="real_stock" type="number" min="${requestInfo.req_qty}" step="1" inputmode="numeric" required>
                    </label>
                    `;
            } else if (requestInfo.matter === 'require') {
                fieldsHtml = `
                    <p>${t('mspa.serialHint')} (${requestInfo.req_qty})</p>
                    <label class="input-group">
                    ${t('mspa.serials')}
                    <textarea name="ctrl_nos" rows="4" required autocomplete="off"></textarea>
                    </label>
                    `;
            } else if (requestInfo.matter === 'return') {
                fieldsHtml = `
                    <label class="input-group">
                    ${t('mspa.location')}
                    <input name="target_location" required autocomplete="off">
                    </label>
                    `;
            } else {
                fieldsHtml = `<p>${t('mspa.brokenConfirm')}</p>`;
            }
            pageContainer.querySelector('#approvalFields').innerHTML = fieldsHtml;
            const locationLabel = pageContainer.querySelector('#approvalLocation');
            if (locationLabel) locationLabel.textContent = requestEntry.item.location || '-';
            approveModal.style.display = 'flex';
            approveModal.setAttribute('aria-hidden', 'false');
            previousFocus = document.activeElement;
            previousOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            (approveModal.querySelector('input, textarea') || approveModal.querySelector('button')).focus();
        }

        // 4. 事件委托：切换分类、刷新、批准和拒绝。
        function handlePageClick(e) {
            if (e.target === approveModal && !isSubmitting) closeActionModal();
            const button = e.target.closest('button');
            if (!button || isSubmitting) return;
            if (button.dataset.tab) {
                currentTab = button.dataset.tab;
                renderRequests();
                return;
            }
            const actionType = button.dataset.action;
            if (actionType === 'refresh') {
                loadRequestData();
                return;
            }
            if (actionType === 'cancel') {
                closeActionModal();
                return;
            }
            if (!isAdmin || !['approve', 'reject'].includes(actionType)) return;
            const requestId = button.closest('[data-id]')?.dataset.id;
            const requestEntry = window.M_APPROVE_DATA[currentTab].find(requestEntry => String(requestEntry.req.id) === requestId);
            if (requestEntry) openActionModal(requestEntry, actionType);
        };


        // 5. 提交：校验资产编号、防止重复提交、成功后移除卡片。
        async function handleFormSubmit(e) {
            e.preventDefault();
            if (isSubmitting || !currentOperation || !approveForm.reportValidity()) return;
            const submittedOperation = currentOperation;
            const requestInfo = submittedOperation.requestEntry.req;
            const formData = new FormData(approveForm);
            const errorBox = pageContainer.querySelector('#approvalError');
            errorBox.textContent = '';
            if (submittedOperation.actionType === 'approve' && submittedOperation.requestType === 'asset_req' && requestInfo.matter === 'require') {
                const controlNumbers = String(formData.get('ctrl_nos') || '').split(/[\s,;，；]+/).filter(Boolean).map(controlNumber => controlNumber.toUpperCase());
                if (controlNumbers.length !== requestInfo.req_qty || new Set(controlNumbers).size !== controlNumbers.length) {
                    errorBox.textContent = t('mspa.serialError');
                    return;
                }
                formData.set('ctrl_nos', controlNumbers.join(','));
            }
            isSubmitting = true;
            requestVersion++;
            const formButtons = Array.from(approveForm.querySelectorAll('button'));
            formButtons.forEach(button => {
                button.disabled = true;
            });
            const submitUrl = '/request_queue/' + (submittedOperation.requestType === 'asset_req' ? 'asset_' : '') + submittedOperation.actionType + '/' + encodeURIComponent(requestInfo.id);
            try {
                // 提交不使用页面的取消信号；离页后只忽略响应，不把已提交的操作视为取消。
                const result = await window.requestMobileJson(submitUrl, { method: 'POST', body: formData });
                if (!isPageActive()) return;
                window.M_APPROVE_DATA[submittedOperation.requestType] = window.M_APPROVE_DATA[submittedOperation.requestType].filter(requestEntry => requestEntry.req.id !== requestInfo.id);
                closeActionModal();
                renderRequests();
                noticeBox.textContent = result.message || t('mspa.success');
            } catch(error) {
                if (isPageActive()) errorBox.textContent = error.message;
            } finally {
                isSubmitting = false;
                formButtons.forEach(button => {
                    button.disabled = false;
                });
            }
        };
        function closeActionModal() {
            if (approveModal.style.display === 'flex') {
                document.body.style.overflow = previousOverflow;
                if (previousFocus?.isConnected) previousFocus.focus();
            }
            approveModal.style.display = 'none';
            approveModal.setAttribute('aria-hidden', 'true');
            currentOperation = null;
        }

        function handleModalKeydown(e) {
            if (approveModal.style.display !== 'flex') return;
            if (e.key === 'Escape' && !isSubmitting) closeActionModal();
            if (e.key !== 'Tab') return;
            const controls = Array.from(approveModal.querySelectorAll('button, input, textarea')).filter(element => !element.disabled);
            if (!controls.length) {
                e.preventDefault();
                return;
            }
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }

        function bindEvents() {
            pageContainer.onclick = handlePageClick;
            approveForm.onsubmit = handleFormSubmit;
            document.addEventListener('keydown', handleModalKeydown);
            window.onCurrentViewLanguageChange = function() {
                renderRequests();

            };
        }

        // 路由离开页面时调用，阻止旧请求刷新新页面。
        function destroyMobileApprovePage() {
            requestVersion++;
            closeActionModal();
            pageContainer.onclick = null;
            approveForm.onsubmit = null;
            document.removeEventListener('keydown', handleModalKeydown);
            window.onCurrentViewLanguageChange = null;
        }

        bindEvents();
        loadRequestData();
        return destroyMobileApprovePage;
    };
})();
