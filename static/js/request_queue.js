
(() => {

    // 捞取后端数据
    window.initRequestQueuePage = async function () {
        try {
            const response = await fetch('/api/request_queue');
            const result = await response.json();
            if (result.status === 'success') {
                const reqData = result.data;
                window.INV_REQ_DATA = reqData.inv_req;
                window.ASSET_REQ_DATA = reqData.asset_req;
                renderInvReq(reqData.inv_req);
                renderAssetReq(reqData.asset_req);

                const tabsContainer = document.querySelector('.queue-headers-container');
                tabsContainer.innerHTML = `
                    <div id="switchTabConsumable" class="queue-header-tab active" onclick="switchQueueTab('consumable', this)">
                        <h2><i class="material-icons">inventory_2</i> ${t('queue.consumables')}</h2>
                        <span class="count-badge">${reqData.inv_req.length}</span>
                    </div>
                    <div id="switchTabAsset" class="queue-header-tab inactive" onclick="switchQueueTab('asset', this)">
                        <h2><i class="material-icons">devices</i> ${t('queue.assets')}</h2>
                        <span class="count-badge">${reqData.asset_req.length}</span>
                    </div>
                `;
                // 修改指示灯
                const indicator = document.getElementById('indicator');
                const indicatorData = reqData.inv_req.length + reqData.asset_req.length;
                indicator.innerHTML = `
                    <i class="material-icons" style="font-size: 1.45rem; color: var(--primary-green);">pending_actions</i>
                    ${t('status.request_queue')}:
                    <span style="font-size: 1.2rem; font-weight: bold; color: var(--primary-green); margin-left: 4px;">
                        ${indicatorData || 0}
                    </span>
                `;
                const tabConsumableBtn = document.getElementById('switchTabConsumable');
                const tabAssetBtn = document.getElementById('switchTabAsset');
                if (reqData.inv_req.length === 0 &&  reqData.asset_req.length > 0 && tabConsumableBtn.classList.contains('active')) {
                    window.switchQueueTab('asset', tabAssetBtn);
                } else if (reqData.asset_req.length === 0 && reqData.inv_req.length > 0 && tabAssetBtn.classList.contains('active')) {
                    window.switchQueueTab('consumable', tabConsumableBtn);
                }

                bindEvents();
            }
        } catch (error) {
            console.error("Data Loaded Fail", error);
            document.querySelector('.queue-container').innerHTML = `<div style="text-align:center; color:red;">加载失败，请刷新重试</div>`;
        }
    }

    function renderInvReq(data) {
        const tabConsumable = document.getElementById('tab-consumable');
        if (!tabConsumable) return;
        if (!data || data.length === 0) {
            tabConsumable.innerHTML = `
                <div style="text-align: center; padding: 60px 0; color: #bdc3c7;">
                    <i class="material-icons" style="font-size: 4rem; opacity: 0.5;">done_all</i>
                    <h3 style="margin-top: 15px; font-weight: normal;">${t('queue.no_pending')}</h3>
                </div>
            `;
            return;
        }

        const invCardsHtml = data.map(invReq => {
            let actionBtn = '';
            if (invReq.item) {
                actionBtn = `
                    <button class="btn-primary" style="background: #1db954; height: 40px; padding: 0 15px;"
                            onclick="openApproveModal('${invReq.req.id}', '${invReq.req.pn_1}', '${invReq.req.item_name}', ${invReq.req.req_qty}, ${invReq.item.stock}, '${invReq.item.location || ''}')">
                        <i class="material-icons">check_circle</i> ${t('queue.approve')}
                    </button>
                `;
            } else {
                actionBtn = `
                    <button class="btn-primary" style="background: #aaa; height: 40px; padding: 0 15px;" disabled>
                        <i class="material-icons">block</i> ${t('queue.approve')}
                    </button>
                `;
            }
            return `
                <div class="req-card" data-req-id="${invReq.req.id}">
                    <div class="req-avatar">
                        <img class="user-avatar" src="/static/avatars/${invReq.req.applicant_username}.jpg" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <i class="material-icons" style="display:none; color:#777; font-size: 20px;">person</i>
                    </div>

                    <div class="req-info">
                        <h4>
                            ${invReq.req.applicant} <span style="font-size: 0.8rem; background: #f0f2f5; padding: 2px 6px; border-radius: 4px; color: #666; font-weight: normal;">${invReq.req.department}</span>
                            <span style="font-size: 0.8rem; color: #aaa; margin-left: auto;">${invReq.req.created_at}</span>
                        </h4>
                        <p><strong>${invReq.req.pn_1}</strong> | ${invReq.req.item_name}</p>
                        <p style="color: #95a5a6; margin-top: 5px;">
                            <i class="material-icons" style="font-size: 0.9rem; vertical-align: middle;">chat_bubble_outline</i>
                            ${invReq.req.note || t('queue.no_reason')}
                        </p>
                    </div>

                    <div class="req-qty">
                        ${invReq.item ? `<span class="req-qty-label">${t('queue.req_qty_label')}</span>${invReq.req.req_qty}` : `<span>NULL</span>`}
                    </div>

                    <div class="req-actions">
                        ${actionBtn}
                        <form action="/request_queue/reject/${invReq.req.id}" method="post" style="margin: 0;" onsubmit="return confirm('${t('queue.confirm_reject')}');">
                            <button type="submit" class="btn-primary" style="background: white; border: 1px solid #ccc; color: #7f8c8d; height: 40px; padding: 0 15px;">
                                <i class="material-icons">block</i> ${t('queue.reject')}
                            </button>
                        </form>
                    </div>
                </div>
            `;
        }).join('');
        tabConsumable.innerHTML = invCardsHtml;
    }

    function renderAssetReq(data) {
        const tabAsset = document.getElementById('tab-asset');
        if (!tabAsset) return;
        if (!data || data.length === 0) {
            tabAsset.innerHTML = `
                <div style="text-align: center; padding: 60px 0; color: #bdc3c7;">
                    <i class="material-icons" style="font-size: 4rem; opacity: 0.5;">done_all</i>
                    <h3 style="margin-top: 15px; font-weight: normal;">${t('queue.no_pending')}</h3>
                </div>
            `;
            return;
        }

        const assetCardsHtml = data.map(assReq => {
            let reqCtrl = `<span class="font-monospace" style="font-size: 1.4rem; font-weight: bold; color: #7f8c8d;"> </span>`;
            if (assReq.req.ctrl_no) {
                reqCtrl = `<span class="font-monospace" style="font-size: 1.4rem; font-weight: bold; color: #7f8c8d;">${assReq.req.ctrl_no}</span>`;
            }

            let reqBadge = `<span class="asset-badge badge-broken"><i class="material-icons" style="font-size:14px;">build</i> Broken</span>`;
            if (assReq.req.matter.trim().toLowerCase() === 'require') {
                reqBadge = `<span class="asset-badge badge-require"><i class="material-icons" style="font-size:14px;">add_shopping_cart</i> Require</span>`;
            } else if (assReq.req.matter.trim().toLowerCase() === 'return') {
                reqBadge = `<span class="asset-badge badge-return"><i class="material-icons" style="font-size:14px;">assignment_return</i> Return</span>`;
            }

            let safeLoc = assReq.req.department || '';
            if (safeLoc.includes('-')) {
                safeLoc = safeLoc.split('-')[0].trim();
            }
            return `
                <div class="req-card" data-req-id="${assReq.req.id}">
                    <div class="req-avatar">
                        <img class="user-avatar" src="/static/avatars/${assReq.req.applicant_username}.jpg" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <i class="material-icons" style="display:none; color:#777; font-size: 20px;">person</i>
                    </div>

                    <div class="req-info">
                        <h4>
                            ${assReq.req.applicant}
                            <span style="font-size: 0.8rem; color: #aaa; margin-left: auto;">${assReq.req.created_at}</span>
                        </h4>
                        <div style="display: flex; align-items: center; justify-content: space-between;">${reqCtrl}${reqBadge}</div>

                        <p><strong>${assReq.req.pn_1}</strong> | ${assReq.req.asset_name}</p>

                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span style="color: #95a5a6; margin-top: 5px;">
                                <i class="material-icons" style="font-size: 0.9rem; vertical-align: middle;">chat_bubble_outline</i>
                                ${assReq.req.note || t('queue.no_reason')}
                            </span>
                            <span style="font-size: 1.05rem; font-weight: bold; color: var(--text-main); cursor: pointer;" onclick="openFooterMap('${safeLoc}')"><i class="material-icons" style="vertical-align: bottom;">place</i>${assReq.req.department}</span>
                        </div>
                    </div>

                    <div class="req-qty">
                        <span class="req-qty-label">${t('queue.req_qty_label')}</span>
                        ${assReq.req.req_qty}
                    </div>

                    <div class="req-actions">
                        <button class="btn-primary" style="background: #1db954; height: 40px; padding: 0 15px;"
                                onclick="openAssetApproveModal('${assReq.req.id}', '${assReq.req.matter}', '${assReq.req.pn_1}', '${assReq.req.req_qty}', '${assReq.req.ctrl_no || ''}')">
                            <i class="material-icons">check_circle</i> ${t('queue.approve')}
                        </button>

                        <form action="/request_queue/asset_reject/${assReq.req.id}" method="post" style="margin: 0;" onsubmit="return confirm('${t('queue.confirm_reject')}');">
                            <button type="submit" class="btn-primary" style="background: white; border: 1px solid #ccc; color: #7f8c8d; height: 40px; padding: 0 15px;">
                                <i class="material-icons">block</i> ${t('queue.reject')}
                            </button>
                        </form>
                    </div>
                </div>
            `;
        }).join('');
        tabAsset.innerHTML = assetCardsHtml;
    }

    window.switchQueueTab = function(tableName, el) {
        document.querySelectorAll('.queue-header-tab').forEach(tab => {
            tab.classList.remove('active');
            tab.classList.add('inactive');
        });
        el.classList.remove('inactive');
        el.classList.add('active');
        document.getElementById('tab-consumable').style.display = tableName === 'consumable' ? 'block' : 'none';
        document.getElementById('tab-asset').style.display = tableName === 'asset' ? 'block' : 'none';
    };

    function bindEvents() {
        // 耗材表单逻辑
        const realStockInput = document.getElementById('realStock');
        if (realStockInput) {
            realStockInput.oninput = () => {
                document.getElementById('approveError').style.display = 'none';
                realStockInput.style.backgroundColor = 'transparent';
            }
        }

        const approveForm = document.getElementById('approveForm');
        if (approveForm) {
            approveForm.onsubmit = async function(e) {
                e.preventDefault();

                let realStock = parseInt(document.getElementById('realStock').value) || 0;
                let targetReqQty = parseInt(document.getElementById('modalReqQty').innerText) || 0;
                let errorBox = document.getElementById('approveError');
                let errorText = document.getElementById('approveErrorText');
                let stockInput = document.getElementById('realStock');

                if (realStock < targetReqQty) {
                    e.preventDefault();
                    errorText.innerText = t('queue.stock_insufficient').replace('{realStock}', realStock).replace('{reqQty}', targetReqQty);
                    errorBox.style.display = 'flex';
                    stockInput.style.backgroundColor = '#fadbd8';
                    this.classList.remove('shake-animation');
                    void this.offsetWidth;
                    this.classList.add('shake-animation');
                    return;
                }

                const submitBtn = this.querySelector("button[type='submit']");
                const originBtnText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="material-icons" style="animation: spin 1s linear infinite">autorenew</i> 校验中...`;

                try {
                    let response = await fetch(this.action, {
                        method: 'POST',
                        body: new FormData(this)
                    });
                    let result = await response.json();

                    if (result.status === 'success') {
                        showToast(result.message, 'success');
                        if (window.closeApproveModal) window.closeApproveModal();
                        const reqId = this.dataset.reqId;
                        window.removeCard(reqId);
                    } else {
                        showToast(result.message, 'error');
                    }
                } catch (err) {
                    showToast('Internet error', 'error');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originBtnText;
                }
            }
        }

        // 资产表单逻辑
        const assetForm = document.getElementById('assetApproveForm');
        if (assetForm) {
            assetForm.onsubmit = async function(e) {
                e.preventDefault();
                const matter = this.dataset.matter;

                if (matter === 'require') {
                    const snInput = document.getElementById('scanSnInput');
                    let valStr = snInput.value.trim();
                    if (valStr.endsWith(',')) valStr = valStr.slice(0, -1);
                    let sns = valStr.split(',').map(s => s.trim()).filter(s => s !== '');
                    let realQty = sns.length;
                    let expectedQty = parseInt(this.dataset.reqQty);

                    if (realQty !== expectedQty) {
                        showToast(`${t('queue.scan_short').replace('{expectedQty}', expectedQty).replace('{realQty}', realQty)}`, 'error');
                        return;
                    }
                    if (new Set(sns).size !== sns.length) {
                        showToast(`${t('queue.scan_repeated')}`, 'error');
                        return;
                    }
                    snInput.value = sns.join(',');
                }

                const submitBtn = this.querySelector("button[type='submit']");
                const originBtnText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="material-icons" style="animation: spin 1s linear infinite">autorenew</i> 校验中...`;

                try {
                    let response = await fetch(this.action, {
                        method: 'POST',
                        body: new FormData(this)
                    });

                    let result = await response.json();
                    if (result.status === 'success') {
                        showToast(result.message, 'success');
                        if (window.closeAssetApproveModal) window.closeAssetApproveModal();
                        
                        const reqId = this.dataset.reqId;
                        window.removeCard(reqId);
                    } else {
                        showToast(result.message, 'error');
                    }
                } catch (err) {
                    showToast('Internet error', 'error');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originBtnText;
                }
            }
        }

        // reject逻辑
        const handleRejectSubmit = async function(e) {
            if (e.defaultPrevented) return;
            const form = e.target;
            if (form.id === 'assetApproveForm' || form.id === 'approveForm') return;
            if (form.tagName === 'FORM' && form.action.includes('reject')) {
                e.preventDefault();

                const submitBtn = form.querySelector("button[type='submit']");
                const originalHtml = submitBtn.innerHTML;

                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="material-icons" style="animation: spin 1s linear infinite">autorenew</i> 校验中...`;

                try {
                    let response = await fetch(form.action, {
                        method: 'POST',
                        body: new FormData(form)
                    });

                    let result = await response.json();

                    if (result.status === "success") {
                        showToast(result.message, 'success');
                        const card = form.closest('.req-card');
                        if (card) {
                            const reqId = card.dataset.reqId;
                            window.removeCard(reqId);
                        }
                    } else {
                        showToast(result.message || 'Error', 'error');
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalHtml;
                    }
                } catch(err) {
                    showToast('网络请求失败', 'error');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalHtml;
                }
            }
        }
        const tabConsumable = document.getElementById('tab-consumable');
        const tabAsset = document.getElementById('tab-asset');

        // 使用 onsubmit 防止每次进入页面重复绑定
        if (tabConsumable) tabConsumable.onsubmit = handleRejectSubmit;
        if (tabAsset) tabAsset.onsubmit = handleRejectSubmit;
    }

    // 操作后移除卡片
    window.removeCard = function(reqId) {
        const card = document.querySelector(`.req-card[data-req-id="${reqId}"]`);
        if (!card) return;

        card.style.transition = 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)';
        card.style.opacity = '0';
        card.style.transform = 'translateX(50px)';
        
        setTimeout(() => {
            const listContainer = card.closest('.queue-list');
            card.remove();

            if (window.INV_REQ_DATA) {
                window.INV_REQ_DATA = window.INV_REQ_DATA.filter(item => String(item.req.id) !== String(reqId));
            }
            if (window.ASSET_REQ_DATA) {
                window.ASSET_REQ_DATA = window.ASSET_REQ_DATA.filter(item => String(item.req.id) !== String(reqId));
            }

            if (listContainer) {
                const remainCount = listContainer.querySelectorAll('.req-card').length;
                const tabId = listContainer.id.replace('tab-', '');
                const badge = document.querySelector(`.queue-header-tab[onclick*="${tabId}"] .count-badge`);
                if (badge) {
                    badge.innerText = remainCount;
                }
                if (remainCount === 0) {
                    if (tabId === 'consumable') renderInvReq([]);
                    if (tabId === 'asset') renderAssetReq([]);
                }
            }

            let newIndicatorData = (window.INV_REQ_DATA ? window.INV_REQ_DATA.length : 0) + (window.ASSET_REQ_DATA ? window.ASSET_REQ_DATA.length : 0);
            // 修改指示灯
            const indicator = document.getElementById('indicator');
            indicator.innerHTML = `
                <i class="material-icons" style="font-size: 1.45rem; color: var(--primary-green);">pending_actions</i>
                ${t('status.request_queue')}:
                <span style="font-size: 1.2rem; font-weight: bold; color: var(--primary-green); margin-left: 4px;">
                    ${newIndicatorData || 0}
                </span>
            `;
        }, 400);
    }
    
})();
