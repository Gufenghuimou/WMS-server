let grid;
let overlay;
let coverFlowIndex = 0;
let cropper = null;
let favs = [];

document.addEventListener('DOMContentLoaded', () => {
    grid = document.getElementById('inventoryGrid');
    overlay = document.getElementById('search-loading-overlay');

    const favsDataNode = document.getElementById('userBookmarksData');
    if (favsDataNode) {
        try {
            favs = JSON.parse(favsDataNode.textContent);
        } catch (e) {
            console.error(CARD_I18N.parse_fav_err, e);
        }
    }

    favs.forEach(id => {
        let ribbon = document.querySelector(`.bookmark-ribbon[data-bookmark-id="${id}"]`);
        if (ribbon) ribbon.classList.add('bookmarked');
    });

    if (grid) {
        let isWheeling = false;
        grid.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0 || e.deltaX !== 0) {
                e.preventDefault();
                if (isWheeling) return;
                isWheeling = true;
                setTimeout(() => { isWheeling = false; }, 75);
                let direction = 0;
                if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                    direction = Math.sign(e.deltaX);
                } else {
                    direction = Math.sign(e.deltaY);
                }
                coverFlowIndex += direction;
                updateCoverFlow();
            }
        }, { passive: false });

        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.item-card');
            if (!card) return;

            if (!card.classList.contains('is-active')) {
                e.preventDefault();
                e.stopPropagation();
                const activeCards = Array.from(document.querySelectorAll('.item-card')).filter(c => c.getAttribute('data-search-hidden') !== 'true');
                coverFlowIndex = activeCards.indexOf(card);
                updateCoverFlow();
            }
        }, true);
    }

    let autoPlayTimer = null;

    function startAutoPlay() {
        if (autoPlayTimer) clearInterval(autoPlayTimer);
        autoPlayTimer = setInterval(() => {
            if (document.querySelector('.item-card.is-flipped')) return;
            const visibleCards = document.querySelectorAll('.item-card:not([data-search-hidden="true"])');
            if (visibleCards.length <= 9) return;
            coverFlowIndex ++;
            updateCoverFlow();
        }, 2500);
    }
    function stopAutoPlay() {
        if (autoPlayTimer) {
            clearInterval(autoPlayTimer);
            autoPlayTimer = null;
        }
    }

    grid.addEventListener('mouseenter', stopAutoPlay);
    grid.addEventListener('mouseleave', startAutoPlay);

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', function(e) {
            const sortMode = e.target.value;
            const cards = document.querySelectorAll('.item-card');
            cards.forEach(c => c.style.transition = 'transform 0.1s linear, opacity 0.1s, filter 0.1s');

            let spins = 0;
            const maxSpins = 35;
            let currentDelay = 40;

            function spinLoop() {
                coverFlowIndex += 1;
                updateCoverFlow();
                spins++;
                if (spins < maxSpins) {
                    currentDelay *= 1.05;
                    setTimeout(spinLoop, currentDelay);
                } else {
                    const cardArray = Array.form(cards);
                    cardArray.sort((a, b) => {
                        let valA = parseInt(a.dataset[sortMode === 'usage_desc' ? 'sortUsage' : 'sortId']) || 0;
                        let valB = parseInt(b.dataset[sortMode === 'usage_desc' ? 'sortUsage' : 'sortId']) || 0;
                        return valB - valA;
                    });
                    cardArray.forEach(c => grid.appendChild(c));

                    setTimeout(() => {
                        cards.forEach(c => c.style.transition = 'transform 0.7s cubic-bezier(0.2, 1, 0.3, 1), opacity 0.7s, filter 0.7s, box-shadow 0.7s');
                        coverFlowIndex = 0;
                        updateCoverFlow();
                    }, 50);
                }
            }
            setTimeout(spinLoop, currentDelay);
        });
    }

    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }

    const realStockInput = document.getElementById('realStock');
    const outQtyInput = document.getElementById('outQty');
    if (realStockInput) realStockInput.addEventListener('input', hideOutError);
    if (outQtyInput) outQtyInput.addEventListener('input', hideOutError);

    setTimeout(startAutoPlay, 10000);
    setTimeout(updateCoverFlow, 500);
    setTimeout(() => grid && grid.dispatchEvent(new Event('scroll')), 500);
});

window.updateCoverFlow = function() {
    if (!grid) return;
    const cards = Array.from(document.querySelectorAll('.item-card')).filter(c => c.getAttribute('data-search-hidden') !== 'true');
    const len = cards.length;
    if (len === 0) return;

    coverFlowIndex = ((coverFlowIndex % len) + len) % len;

    cards.forEach((card, i) => {
        let diff = i - coverFlowIndex;
        if (diff > len / 2) diff -= len;
        if (diff < -len / 2) diff += len;

        if (Math.abs(diff) > 9) {
            card.style.display = 'none';
            return;
        } else {
            card.style.display = 'block';
        }

        card.classList.remove('is-active', 'is-left', 'is-right');

        if (diff === 0) {
            card.classList.add('is-active');
            card.style.setProperty('--tx', '0px');
            card.style.setProperty('--tz', '120px');
            card.style.setProperty('--z', 100);
            card.style.setProperty('--op', 1);
            card.style.setProperty('--pe', 'auto');
        } else if (diff < 0) {
            card.classList.add('is-left');
            card.classList.remove('is-flipped');
            let tx = -375 + ((diff + 1) * 200);
            card.style.setProperty('--tx', `${tx}px`);
            card.style.setProperty('--tz', `${-60 + (diff * 5)}px`);
            card.style.setProperty('--z', 50 + diff);
            let opacity = diff < -5 ? 0 : 1 - Math.abs(diff) * 0.15;
            card.style.setProperty('--op', opacity);
            card.style.setProperty('--pe', opacity === 0 ? 'none' : 'auto');
        } else {
            card.classList.add('is-right');
            card.classList.remove('is-flipped');
            let tx = 375 + ((diff - 1) * 200);
            card.style.setProperty('--tx', `${tx}px`);
            card.style.setProperty('--tz', `${-60 - (diff * 5)}px`);
            card.style.setProperty('--z', 50 - diff);
            let opacity = diff > 5 ? 0 : 1 - Math.abs(diff) * 0.15;
            card.style.setProperty('--op', opacity);
            card.style.setProperty('--pe', opacity === 0 ? 'none' : 'auto');
        }
    });
};

let filterTimeout;
window.applyFilters = function() {
    if (!grid) return;
    grid.style.transition = 'filter 0.3s ease';
    grid.style.filter = 'grayscale(0.5) blur(1px)';

    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
        const term = document.getElementById('globalSearch') ? document.getElementById('globalSearch').value.toLowerCase() : '';
        const showFavsOnly = document.getElementById('favToggleBtn').classList.contains('active');

        document.querySelectorAll('.item-card').forEach(card => {
            let id = parseInt(card.getAttribute('data-id'));
            let searchableText = card.getAttribute('data-search');

            let matchSearch = term === "" || searchableText.includes(term);
            let matchFav = !showFavsOnly || favs.includes(id);

            if (matchSearch && matchFav) {
                card.removeAttribute('data-search-hidden');
                card.style.transform = '';
                card.style.opacity = '1';
            } else {
                card.setAttribute('data-search-hidden', 'true');
                card.style.opacity = '0';
                card.style.transform = 'scale(0.5)';
                setTimeout(() => { if(card.style.opacity === '0') card.style.display = 'none'; }, 300);
            }
        });

        coverFlowIndex = 0;
        updateCoverFlow();
        grid.style.filter = 'none';
    }, 300);
};

window.unflipCard = function() {
    document.querySelectorAll('.item-card.is-flipped').forEach(c => c.classList.remove('is-flipped'));
};

function clearBackFace() {
    const activeBack = document.querySelector('.item-card .card-back > div');
    if (activeBack) {
        const storage = document.getElementById('formStorage');
        activeBack.style.display = 'none';
        storage.appendChild(activeBack);
    }
    document.querySelectorAll('.card-back').forEach(back => back.innerHTML = '');
}

window.openOutModal = function(id, pn1, name, stock, location) {
    unflipCard();
    clearBackFace();

    document.getElementById('outForm').action = '/do_out/' + id;
    document.getElementById('outPn1').value = pn1;
    document.getElementById('outName').value = name;
    document.getElementById('outCurrentStock').value = stock;
    document.getElementById('outQty').max = stock;
    document.getElementById('outQty').value = '';
    document.getElementById('realStock').value = '';
    document.getElementById('department').value = '';
    document.getElementById('outFormError').style.display = 'none';
    document.getElementById('realStock').style.backgroundColor = 'transparent';
    document.getElementById('outForm').classList.remove('shake-animation');

    const targetCard = document.querySelector(`.item-card[data-id="${id}"]`);
    if (!targetCard) return;

    const backFace = targetCard.querySelector('.card-back');
    const formTemplate = document.getElementById('outFormTemplate');

    backFace.appendChild(formTemplate);
    formTemplate.style.display = 'flex';

    const activeCards = Array.from(document.querySelectorAll('.item-card')).filter(c => c.getAttribute('data-search-hidden') !== 'true');
    coverFlowIndex = activeCards.indexOf(targetCard);
    updateCoverFlow();

    setTimeout(() => {
        targetCard.classList.add('is-flipped');
        document.getElementById('outQty').focus();

        if (location && location.trim() !== '' && location !== '-' && location !== 'None') {
            let locParts = location.split('-');
            let rackName = locParts[0].toUpperCase();
            if (window.openFooterMap) window.openFooterMap(rackName);
        }
    }, 100);
};

window.validateOutForm = function(event) {
    let reqQty = parseInt(document.getElementById('outQty').value) || 0;
    let realStock = parseInt(document.getElementById('realStock').value) || 0;
    let errorBox = document.getElementById('outFormError');
    let errorText = document.getElementById('outFormErrorText');
    let stockInput = document.getElementById('realStock');
    let outForm = document.getElementById('outForm');

    if (realStock < reqQty) {
        event.preventDefault();
        errorText.innerText = CARD_I18N.stock_insufficient.replace('{realStock}', realStock).replace('{reqQty}', reqQty);
        errorBox.style.display = 'flex';
        stockInput.style.backgroundColor = '#fadbd8';
        outForm.classList.remove('shake-animation');
        void outForm.offsetWidth;
        outForm.classList.add('shake-animation');
        return false;
    }
    errorBox.style.display = 'none';
    return true;
};

function hideOutError() {
    const box = document.getElementById('outFormError');
    const rs = document.getElementById('realStock');
    if (box) box.style.display = 'none';
    if (rs) rs.style.backgroundColor = 'transparent';
}

window.openRequestModal = function(id, pn1, name, stock) {
    unflipCard();
    clearBackFace();

    document.getElementById('reqItemId').value = id;
    document.getElementById('reqPn1').value = pn1;
    document.getElementById('reqName').value = name;
    document.getElementById('reqStock').value = stock;

    let qtyInput = document.getElementById('reqQty');
    qtyInput.value = '';
    qtyInput.max = stock;
    document.getElementById('reqNote').value = '';

    const targetCard = document.querySelector(`.item-card[data-id="${id}"]`);
    if (!targetCard) return;

    const backFace = targetCard.querySelector('.card-back');
    const formTemplate = document.getElementById('requestFormTemplate');

    backFace.appendChild(formTemplate);
    formTemplate.style.display = 'flex';

    const activeCards = Array.from(document.querySelectorAll('.item-card')).filter(c => c.getAttribute('data-search-hidden') !== 'true');
    coverFlowIndex = activeCards.indexOf(targetCard);
    updateCoverFlow();

    setTimeout(() => {
        targetCard.classList.add('is-flipped');
        qtyInput.focus();
    }, 100);
};

window.submitRequest = async function(event) {
    event.preventDefault();

    let btn = document.getElementById('btnSubmitReq');
    btn.disabled = true;
    btn.innerHTML = `<i class="material-icons" style="animation: spin 1s linear infinite;">autorenew</i> ${CARD_I18N.submitting}`;

    let formData = new FormData(event.target);
    let itemId = document.getElementById('reqItemId').value;

    try {
        let response = await fetch(`/api/request_item/${itemId}`, { method: 'POST', body: formData });
        let data = await response.json();

        if (data.status === 'success') {
            btn.innerHTML = `<i class="material-icons">check</i> ${CARD_I18N.req_sent}`;
            btn.style.background = '#1db954';

            setTimeout(() => {
                unflipCard();
                btn.disabled = false;
                btn.innerHTML = CARD_I18N.send_req;
                btn.style.background = 'var(--primary-blue)';
            }, 1200);
        } else {
            alert(CARD_I18N.req_fail + data.message);
            btn.disabled = false;
            btn.innerHTML = CARD_I18N.send_req;
        }
    } catch (err) {
        alert(CARD_I18N.net_err);
        btn.disabled = false;
        btn.innerHTML = CARD_I18N.send_req;
    }
};

window.openEditModal = function(btn) {
    unflipCard();
    clearBackFace();

    let targetCard = btn.closest('.item-card');
    let id = btn.getAttribute('data-id');
    window.currentEditItemId = id;

    let imgPreview = document.getElementById('editImagePreview');
    let placeholder = document.getElementById('editImagePlaceholder');
    imgPreview.src = `/static/item_images/${id}.jpg?t=${new Date().getTime()}`;
    imgPreview.style.display = 'block';
    placeholder.style.display = 'none';
    imgPreview.onerror = function() { this.style.display = 'none'; placeholder.style.display = 'flex'; };

    document.getElementById('editForm').action = '/edit/' + id;
    document.getElementById('editPn1').value = btn.getAttribute('data-pn1');
    document.getElementById('editPn2').value = btn.getAttribute('data-pn2');
    document.getElementById('editName').value = btn.getAttribute('data-name');
    document.getElementById('editDesc1').value = btn.getAttribute('data-desc1');
    document.getElementById('editDesc2').value = btn.getAttribute('data-desc2');
    document.getElementById('editStock').value = btn.getAttribute('data-stock');
    document.getElementById('editLoc').value = btn.getAttribute('data-loc');
    document.getElementById('editRemarks').value = btn.getAttribute('data-remarks');

    if (document.getElementById('deleteBtn')) document.getElementById('deleteBtn').setAttribute('onclick', `deleteItem(${id})`);

    const backFace = targetCard.querySelector('.card-back');
    const formTemplate = document.getElementById('editFormTemplate');

    backFace.appendChild(formTemplate);
    formTemplate.style.display = 'flex';

    const activeCards = Array.from(document.querySelectorAll('.item-card')).filter(c => c.getAttribute('data-search-hidden') !== 'true');
    coverFlowIndex = activeCards.indexOf(targetCard);
    updateCoverFlow();

    setTimeout(() => { targetCard.classList.add('is-flipped'); }, 100);
};

window.deleteItem = function(itemId) {
    if (confirm(CARD_I18N.scrap_warn)) {
        let form = document.createElement('form');
        form.method = 'POST';
        form.action = '/delete/' + itemId;
        document.body.appendChild(form);
        form.submit();
    }
};

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
        .catch(err => alert(CARD_I18N.upload_fail + err));

    }, 'image/jpeg', 0.8);
};

window.closeCropModal = function() {
    document.getElementById('cropModal').style.display = 'none';
    if(cropper) cropper.destroy();
};

window.toggleBookmark = async function(event, itemId) {
    event.stopPropagation();
    let ribbon = event.target;
    let numId = parseInt(itemId);

    try {
        let response = await fetch(`/api/bookmark/toggle/${numId}`, { method: 'POST' });
        let data = await response.json();

        if (data.status === 'added') {
            favs.push(numId);
            ribbon.classList.add('bookmarked');
            ribbon.style.transform = 'scale(1.4)';
            setTimeout(() => ribbon.style.transform = '', 200);
        } else if (data.status === 'removed') {
            favs = favs.filter(id => id !== numId);
            ribbon.classList.remove('bookmarked');
        }

        if (document.getElementById('favToggleBtn').classList.contains('active')) {
            applyFilters();
        }
    } catch (err) {
        console.error(CARD_I18N.sync_fail, err);
        alert(CARD_I18N.sync_net_err);
    }
};

window.toggleFavFilter = function() {
    let btn = document.getElementById('favToggleBtn');
    let icon = document.getElementById('favToggleIcon');

    btn.classList.toggle('active');
    if (btn.classList.contains('active')) {
        icon.innerText = 'bookmark';
        btn.querySelector('span').innerText = CARD_I18N.cancel_fav;
    } else {
        icon.innerText = 'bookmark_border';
        btn.querySelector('span').innerText = CARD_I18N.my_fav;
    }

    applyFilters();
};

document.addEventListener('submit', async function(e) {
    const form = e.target;
    if (form.id !== 'outForm' && form.id !== 'editForm') return;
    if (e.defaultPrevented) return;

    e.preventDefault();

    let submitBtn = form.querySelector('button[type="submit"]');
    let originalBtnText = submitBtn ? submitBtn.innerHTML : '提交';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="material-icons" style="animation: spin 1s linear infinite;">autorenew</i> ${CARD_I18N.processing}`;
    }

    try {
        let formData = new FormData(form);
        let response = await fetch(form.action, { method: 'POST', body: formData });
        let result = await response.json();

        if (result.status === 'success') {
            const data = result.data;
            const itemId = data.id;

            window.unflipCard();

            let targetCard = document.querySelector(`.item-card[data-id="${itemId}"]`);

            if (targetCard) {
                const isOutForm = form.id === 'outForm';
                const isEditForm = form.id === 'editForm';

                let stockBadge = targetCard.querySelector('.stock-badge');
                if (stockBadge && data.stock !== undefined) {
                    stockBadge.innerText = data.stock;
                }

                if (isEditForm) {
                    let titleElem = targetCard.querySelector('.card-title');
                    if (titleElem) {
                        let newTitle = `${data.pn_1} | ${data.pn_2 || ''}`;
                        titleElem.innerText = newTitle;
                        titleElem.title = newTitle;
                    }

                    let subtitleElem = targetCard.querySelector('.card-subtitle');
                    if (subtitleElem && data.name !== undefined) {
                        subtitleElem.innerText = data.name || CARD_I18N.unnamed_item;
                        subtitleElem.title = data.name || CARD_I18N.unnamed_item;
                    }

                    let detailRows = targetCard.querySelectorAll('.detail-row span:nth-child(2)');
                    if (detailRows.length >= 6) {
                        if (data.description_1 !== undefined) detailRows[0].innerText = data.description_1 || '-';
                        if (data.description_2 !== undefined) detailRows[1].innerText = data.description_2 || '-';
                        if (data.location !== undefined) detailRows[2].innerText = data.location || '-';
                        if (data.remarks !== undefined) {
                            detailRows[5].innerText = data.remarks || '-';
                            detailRows[5].title = data.remarks || '';
                        }
                    }
                }

                let editBtn = targetCard.querySelector('.btn-edit');
                if (editBtn && isEditForm) {
                    editBtn.setAttribute('data-pn1', data.pn_1 || '');
                    editBtn.setAttribute('data-pn2', data.pn_2 || '');
                    editBtn.setAttribute('data-name', data.name || '');
                    editBtn.setAttribute('data-stock', data.stock || 0);
                    editBtn.setAttribute('data-desc1', data.description_1 || '');
                    editBtn.setAttribute('data-desc2', data.description_2 || '');
                    editBtn.setAttribute('data-loc', data.location || '');
                    editBtn.setAttribute('data-remarks', data.remarks || '');
                } else if (editBtn && isOutForm && data.stock !== undefined) {
                    editBtn.setAttribute('data-stock', data.stock);
                }

                let outBtn = targetCard.querySelector('.btn-out');
                if (outBtn) {
                    let safePn1 = editBtn ? editBtn.getAttribute('data-pn1') : '';
                    let safeName = editBtn ? editBtn.getAttribute('data-name') : '';
                    let safeLoc = editBtn ? editBtn.getAttribute('data-loc') : '';
                    let currentStock = data.stock !== undefined ? data.stock : (editBtn ? editBtn.getAttribute('data-stock') : 0);

                    outBtn.setAttribute('onclick', `openOutModal('${itemId}', '${safePn1}', '${safeName}', ${currentStock}, '${safeLoc}')`);
                }

                let reqBtn = targetCard.querySelector('.btn-request');
                if (reqBtn && data.stock !== undefined) {
                    let safePn1 = data.pn_1 || '';
                    let safeName = data.name || '';
                    reqBtn.setAttribute('onclick', `openRequestModal('${itemId}', '${safePn1}', '${safeName}', ${data.stock})`);
                }

                let cardFront = targetCard.querySelector('.card-front');
                if (cardFront) {
                    cardFront.style.transition = 'background-color 0.4s ease';
                    cardFront.style.backgroundColor = '#e6f4ea';
                    cardFront.style.boxShadow = '0 0 20px rgba(46, 204, 113, 0.4)';

                    setTimeout(() => {
                        cardFront.style.backgroundColor = '';
                        cardFront.style.boxShadow = '';
                    }, 800);
                }
            }

        } else {
            alert(result.message || CARD_I18N.backend_fail);
        }
    } catch (err) {
        alert(CARD_I18N.net_req_fail);
        console.error(err);
    } finally {
        setTimeout(() => {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }, 500);
    }
});