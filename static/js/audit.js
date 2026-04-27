document.addEventListener('DOMContentLoaded', () => {
    // 缓存文本
    document.querySelectorAll('.location-block tbody tr').forEach(row => {
        row._cachedSearchText = row.innerText.toLowerCase();
    });

    let searchTimeout;
    const globalSearch = document.getElementById('globalSearch');

    if (globalSearch) {
        globalSearch.addEventListener('input', function(e) {
            let term = e.target.value.toLowerCase().trim();
            clearTimeout(searchTimeout);

            searchTimeout = setTimeout(() => {
                if (term === "") {
                    document.querySelectorAll('.location-block').forEach(block => block.style.display = 'block');
                    document.querySelectorAll('tbody tr').forEach(row => row.style.display = '');
                    return;
                }

                document.querySelectorAll('.location-block').forEach(block => {
                    let locName = (block.getAttribute('data-loc') || "").toLowerCase();
                    let blockMatches = locName.includes(term);
                    let hasVisibleRow = false;

                    block.querySelectorAll('tbody tr').forEach(row => {
                        let rowText = row._cachedSearchText || "";
                        if (rowText.includes(term) || blockMatches) {
                            row.style.display = '';
                            hasVisibleRow = true;
                        } else {
                            row.style.display = 'none';
                        }
                    });

                    block.style.display = (blockMatches || hasVisibleRow) ? 'block' : 'none';
                    if (hasVisibleRow && term !== "") {
                        block.classList.remove('collapsed');
                    }
                });
            }, 250);
        });
    }

    // ==========================================
    // 🌟 极速扫码定位引擎 (已优化：先展开，再定位)
    // ==========================================
    const scanInput = document.getElementById('scanInput');
    const resultBox = document.getElementById('scanResultBox');

    if (scanInput) {
        scanInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                let term = this.value.trim().toLowerCase();
                if (!term) return;

                // 1. 优先级匹配：库位
                let targetBlock = document.querySelector(`.location-block[data-loc="${term}"]`);

                if (targetBlock) {
                    document.querySelectorAll('.location-block').forEach(b => b.classList.add('collapsed'));
                    // 🌟 先展开，再滚动
                    targetBlock.classList.remove('collapsed');

                    // 给浏览器一点点渲染时间去计算高度
                    requestAnimationFrame(() => {
                        targetBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });

                        let header = targetBlock.querySelector('.location-header');
                        header.classList.remove('highlight-flash');
                        void header.offsetWidth;
                        header.classList.add('highlight-flash');
                    });

                    resultBox.style.background = '#e6f4ea';
                    resultBox.style.borderColor = '#c8e6c9';
                    resultBox.innerHTML = `
                        <div style="font-size: 1.1rem; color: #1e8e3e; display: flex; align-items: center; gap: 8px; font-weight: bold;">
                            <i class="material-icons">place</i> ${term.toUpperCase()}
                        </div>
                    `;
                } else {
                    // 2. 降级匹配：PN
                    let targetRow = document.querySelector(`tr[data-pn1="${term}"]`) || document.querySelector(`tr[data-pn2="${term}"]`);

                    if (targetRow) {
                        let block = targetRow.closest('.location-block');
                        let locName = block ? block.getAttribute('data-loc').toUpperCase() : 'Unknow Location';
                        // 🌟 核心：发现匹配的 PN 时，自动展开它所属的父级 Block
                        if (block) {
                            document.querySelectorAll('.location-block').forEach(b => b.classList.add('collapsed'));
                            block.classList.remove('collapsed');
                        }

                        requestAnimationFrame(() => {
                            targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            targetRow.classList.remove('highlight-flash');
                            void targetRow.offsetWidth;
                            targetRow.classList.add('highlight-flash');

                            let qtyInput = targetRow.querySelector('input[name="actual_stock"]');
                            if (qtyInput) {
                                setTimeout(() => {
                                    qtyInput.focus();
                                    qtyInput.select();
                                }, 300);
                            }
                        });

                        let matchedName = targetRow.querySelector('strong').innerText;
                        resultBox.style.background = '#e6f4ea';
                        resultBox.style.borderColor = '#c8e6c9';
                        resultBox.innerHTML = `
                            <div style="font-size: 1.2rem; color: #333; font-weight: normal; margin-top: 6px; display: flex; justify-content: flex-start; gap: 25px;">
                                <span style="font-weight: bold;">Location: <strong style="color:var(--primary-blue);">${locName}</strong></span>
                                <span style="font-weight: bold;">P/N: <strong style="color:var(--primary-blue);">${term.toUpperCase()}</strong></span>
                            </div>
                        `;
                    } else {
                        // 3. 彻底未找到
                        resultBox.style.background = '#fce8e6';
                        resultBox.style.borderColor = '#fadbd8';
                        resultBox.innerHTML = `<div style="font-size: 1.1rem; color: #d93025; font-weight: bold;">Not Found: ${term.toUpperCase()}</div>`;
                    }
                }
                this.value = '';
                this.focus();
            }
        });
    }
    // ==========================================
    // 🌟 修复版：恢复滚动条位置 (挂载到新的 wrapper 上)
    // ==========================================
    let pos = sessionStorage.getItem('auditScroll');
    if (pos) {
        setTimeout(() => {
            let scrollBox = document.querySelector('.audit-list-wrapper');
            if (scrollBox) {
                scrollBox.scrollTo(0, parseInt(pos));
            }
        }, 50);
        sessionStorage.removeItem('auditScroll');
    }
});

window.addEventListener('beforeunload', () => {
    let scrollBox = document.querySelector('.audit-list-wrapper');
    if (scrollBox) {
        sessionStorage.setItem('auditScroll', scrollBox.scrollTop);
    }
});

// ==========================================
// 🌟 无感 AJAX 提交引擎
// ==========================================
document.addEventListener('submit', async function(e) {
    const form = e.target;

    // 只拦截盘点行的表单
    if (form.classList.contains('audit-form')) {
        e.preventDefault();

        let btn = document.querySelector(`button[form="${form.id}"]`);
        let oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="material-icons" style="animation: spin 1s linear infinite;">autorenew</i>';
        btn.disabled = true;

        try {
            let formData = new FormData(form);
            let response = await fetch(form.action, {
                method: 'POST',
                body: formData
            });
            let result = await response.json();

            if (result.status === 'success') {
                let itemId = result.data.id;
                let statusBadge = document.getElementById(`status-${itemId}`);
                let row = document.getElementById(`row-${itemId}`);

                // 1. 无刷新更新 Badge
                if (statusBadge) {
                    statusBadge.innerText = result.data.status;
                    statusBadge.className = `status-badge status-${result.data.status.toLowerCase()}`;
                }

                // 2. 行变色成功反馈
                if (row) {
                    row.style.transition = 'background-color 0.4s';
                    row.style.backgroundColor = result.data.status === 'Matched' ? '#e6f4ea' : '#fce8e6';
                    setTimeout(() => {
                        row.style.backgroundColor = '';
                    }, 800);
                }

                // 3. 焦点交还给扫码框，准备扫下一个
                let scanInput = document.getElementById('scanInput');
                if(scanInput) scanInput.focus();

            } else {
                alert(result.message);
            }
        } catch(err) {
            alert("提交时发生网络错误");
        } finally {
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }
});