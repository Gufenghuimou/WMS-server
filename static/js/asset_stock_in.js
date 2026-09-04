(() => {
    let currentRowCount = 0;
    let globalAssetPrefix = "";
    let globalCurrentSeq = 0;

    function addAssetRow() {
        let i = currentRowCount;
        let today = new Date().toISOString().split('T')[0];

        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" name="ctrl_no" class="cell-input ctrl-input" data-row="${i}" autocomplete="off" placeholder="${t('asset_stockin.ph_ctrl_no')}" style="color: var(--primary); font-weight: bold;"></td>
            <td><input type="text" name="pn_1" class="cell-input pn1-input" data-row="${i}" autocomplete="off" placeholder="${t('asset_stockin.ph_pn1')}"></td>
            <td><input type="text" name="pn_2" class="cell-input pn2-input" data-row="${i}" autocomplete="off"></td>
            <td><input type="text" name="name" class="cell-input name-input" data-row="${i}" autocomplete="off"></td>
            <td><input type="text" name="description_1" class="cell-input desc1-input" data-row="${i}"></td>
            <td><input type="text" name="description_2" class="cell-input desc2-input" data-row="${i}"></td>
            <td><input type="text" name="use_for" class="cell-input usefor-input" data-row="${i}"></td>
            <td><input type="date" name="first_in_date" class="cell-input date-input" data-row="${i}" value="${today}"></td>
            <td><input type="text" name="location" class="cell-input loc-input" data-row="${i}"></td>
            <td><input type="text" name="remarks" class="cell-input rem-input" data-row="${i}"></td>
            <td style="text-align: center; vertical-align: middle;">
                <button type="button" class="btn-undo" onclick="clearSingleRow(${i})" title="${t('asset_stockin.title_clear_row')}">
                    <i class="material-icons" style="font-size: 1.1rem">delete_outline</i>
                </button>
            </td>
        `;
        document.getElementById('gridBody').appendChild(tr);

        // 绑定该行 PN1 的失焦查询和输入增行逻辑
        let pn1Input = tr.querySelector('.pn1-input');

        pn1Input.addEventListener('blur', function() {
            triggerAutoComplete(this);
        });

        pn1Input.addEventListener('input', function() {
            let rowIndex = parseInt(this.getAttribute('data-row'));
            // 如果是最后一行且输入了内容，立刻生成下一行
            if (rowIndex === currentRowCount - 1 && this.value.trim() !== '') {
                let ctrlInput = tr.querySelector('.ctrl-input');

                if (ctrlInput && ctrlInput.value.trim() === '' && globalAssetPrefix) {
                    globalCurrentSeq++;
                    let seqStr = globalCurrentSeq.toString().padStart(3, '0');
                    ctrlInput.value = globalAssetPrefix + seqStr;

                    ctrlInput.classList.add('correct-flash');
                    setTimeout(() => ctrlInput.classList.remove('correct-flash'), 500);
                }
                addAssetRow();
            }
        });

        currentRowCount++;
    }

    window.clearSingleRow = function(rowIndex) {
        let inputs = document.querySelectorAll(`input[data-row="${rowIndex}"]`);
        inputs.forEach(input => {
            if (input.type === 'date') {
                input.value = new Date().toISOString().split('T')[0];
            } else {
                input.value = '';
            }
            input.classList.remove('correct-flash');
        });
    };

    window.clearAssetGrid = function() {
        if (confirm(t('asset_stockin.confirm_clear_all'))) {
            document.getElementById('gridBody').innerHTML = '';
            currentRowCount = 0;
            addAssetRow();
        }
    };

    async function triggerAutoComplete(inputElement) {
        let pnVal = inputElement.value.trim().toUpperCase();
        if (!pnVal) return;

        let rowIdx = parseInt(inputElement.getAttribute('data-row'));
        let currentRow = inputElement.closest('tr');

        let safeSet = (selector, val) => {
            let el = currentRow.querySelector(selector);
            if(el && !el.value) el.value = val || '';
        };

        let flashInput = (elem) => {
            if(!elem) return;
            elem.classList.add('correct-flash');
            setTimeout(() => elem.classList.remove('correct-flash'), 500);
        };

        // 🌟 核心逻辑：自动生成 ctrl_no (如果还没填的话)
        let ctrlInput = currentRow.querySelector('.ctrl-input');
        if (ctrlInput && ctrlInput.value.trim() === '' && globalAssetPrefix) {
            globalCurrentSeq++;
            let seqStr = globalCurrentSeq.toString().padStart(3, '0');
            ctrlInput.value = globalAssetPrefix + seqStr;
            flashInput(ctrlInput);
        }

        // 【策略一：智能抄袭】往上遍历，如果上面录过相同的 PN，直接抄过来 (效率最高)
        let allRows = Array.from(document.querySelectorAll('#gridBody tr'));
        for (let i = rowIdx - 1; i >= 0; i--) {
            let prevPnInput = allRows[i].querySelector('.pn1-input');
            if (prevPnInput && prevPnInput.value.trim().toUpperCase() === pnVal) {
                safeSet('.pn2-input', allRows[i].querySelector('.pn2-input').value);
                safeSet('.name-input', allRows[i].querySelector('.name-input').value);
                safeSet('.desc1-input', allRows[i].querySelector('.desc1-input').value);
                safeSet('.desc2-input', allRows[i].querySelector('.desc2-input').value);
                safeSet('.usefor-input', allRows[i].querySelector('.usefor-input').value);
                safeSet('.loc-input', allRows[i].querySelector('.loc-input').value);
                safeSet('.rem-input', allRows[i].querySelector('.rem-input').value);
                flashInput(inputElement);
                return; // 抄完直接结束，不发网络请求
            }
        }

        // 【策略二：查库兜底】上面没有，去通用物品库里查一下有没有定义过这个 PN
        try {
            let response = await fetch(`/api/item/${encodeURIComponent(pnVal)}`);
            let data = await response.json();

            if (!data.error) {
                // 如果扫的是 PN2 被后端认出来了，自动把 PN1 纠正过来
                if (data.matched_by === "pn_2") {
                    inputElement.value = data.pn_1;
                    safeSet('.pn2-input', pnVal); // 把刚刚扫的放到 pn2 去
                } else {
                    safeSet('.pn2-input', data.pn_2);
                }

                safeSet('.name-input', data.name);
                safeSet('.desc1-input', data.description_1);
                safeSet('.desc2-input', data.description_2);
                safeSet('.loc-input', data.location);
                safeSet('.rem-input', data.remarks);

                flashInput(inputElement);
            }
        } catch (err) {
            console.error(t('asset_stockin.err_query_fail'), err);
        }
    }

    window.initAssetStockPage = async function() {
        const topActionsContainer = document.querySelector('.top-actions');
        const pageActions = document.getElementById('page-top-actions');
        if (pageActions) {
            topActionsContainer.innerHTML = pageActions.innerHTML;
            pageActions.remove();
        }

        // 修改左下指示灯
        const indicator = document.getElementById('indicator');
        indicator.innerHTML = `
            <i class="material-icons" style="font-size: 1.45rem; color: var(--primary-green);">sim_card</i>
            ${t('status.asset_stock_in')}:
            <span id="assetStockinCountDisplay" style="font-size: 1.2rem; font-weight: bold; color: var(--primary-green); margin-left: 4px;">
                0
            </span>
        `;
        
        const gridBody = document.getElementById('gridBody');
        if (gridBody) gridBody.innerHTML = '';
        
        currentRowCount = 0;
        addAssetRow();

        // 🌟 1. 页面加载瞬间，向后端请求当前最新的序列号
        try {
            let res = await fetch('/api/asset/next_seq');
            let data = await res.json();
            globalAssetPrefix = data.prefix;
            globalCurrentSeq = parseInt(data.last_seq, 10);
        } catch (e) {
            console.error(t('asset_stockin.err_fetch_seq'), e);
        }



        const form = document.getElementById('assetStockInForm');

        if (gridBody) {
            gridBody.onpaste = function(e) {
                let pasteData = (e.clipboardData || window.clipboardData).getData('text');
                if (!pasteData) return;

                if (pasteData.includes('\t') || pasteData.includes('\n')) {
                    e.preventDefault();

                    let startInput = e.target;
                    if (!startInput.classList.contains('cell-input')) return;

                    let startRowIdx = parseInt(startInput.getAttribute('data-row'));
                    let startColName = startInput.getAttribute('name');

                    // 🌟 更新列名数组，将 ctrl_no 放在最前面
                    const colNames = ['ctrl_no', 'pn_1', 'pn_2', 'name', 'description_1', 'description_2', 'use_for', 'first_in_date', 'location', 'remarks'];

                    let startColIdx = colNames.indexOf(startColName);
                    if (startColIdx === -1) startColIdx = 0;

                    let rows = pasteData.split(/\r\n|\n|\r/).filter(r => r.trim() !== '');

                    rows.forEach((rowStr, i) => {
                        let targetRowIdx = startRowIdx + i;

                        while (targetRowIdx >= currentRowCount) {
                            addAssetRow();
                        }

                        let cells = rowStr.split('\t');
                        cells.forEach((cellVal, j) => {
                            let targetColIdx = startColIdx + j;
                            if (targetColIdx < colNames.length) {
                                let cellName = colNames[targetColIdx];
                                let inputEl = document.querySelector(`input[name="${cellName}"][data-row="${targetRowIdx}"]`);
                                if (inputEl) {
                                    inputEl.value = cellVal.trim();
                                    // 如果粘贴触发了 PN1，执行自动补全（此时如果编号为空也会自动分配）
                                    if (cellName === 'pn_1') triggerAutoComplete(inputEl);
                                }
                            }
                        });
                    });

                    // 粘贴完成后，检查最后一行是否填满，填满则再准备一个空行
                    let lastPn1 = document.querySelector(`input[name="pn_1"][data-row="${currentRowCount-1}"]`);
                    if (lastPn1 && lastPn1.value.trim() !== '') {
                        addAssetRow();
                    }
                }
            }
        }

        if (form) {
            // ==========================================
            // 4. 拦截回车键 (扫码枪连扫友好体验)
            // ==========================================
            form.onkeydown = function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault(); // 阻断默认的表单提交
                    let currentInput = e.target;

                    if (currentInput.classList.contains('pn1-input')) {
                        currentInput.blur(); // 触发 blur，启动补全和编号分配逻辑

                        // 扫码枪扫完 PN1，自动把光标跳到这一行的【库位】框，方便继续扫库位条码
                        let rowIdx = currentInput.getAttribute('data-row');
                        let locInput = document.querySelector(`.loc-input[data-row="${rowIdx}"]`);
                        if (locInput) locInput.focus();
                    } else {
                        currentInput.blur();
                    }
                }
            }

            // ==========================================
            // 5. 智能表单提交校验
            // ==========================================
            form.onsubmit = async function(e) {
                e.preventDefault();

                let isValid = true;
                let hasData = false;

                for (let i = 0; i < currentRowCount; i++) {
                    let pn1Input = document.querySelector(`.pn1-input[data-row="${i}"]`);
                    let nameInput = document.querySelector(`.name-input[data-row="${i}"]`);
                    let ctrlInput = document.querySelector(`.ctrl-input[data-row="${i}"]`);

                    if (!pn1Input) continue;

                    let pn1 = pn1Input.value.trim();
                    let name = nameInput.value.trim();
                    let ctrl = ctrlInput.value.trim();

                    // 如果这一行填了任何东西，就算作有数据
                    if (pn1 || name || ctrl) {
                        hasData = true;
                        if (!ctrl) {
                            alert(t('asset_stockin.err_miss_ctrl').replace('{row}', i + 1));
                            ctrlInput.focus();
                            isValid = false; break;
                        }
                        if (!pn1) {
                            alert(t('asset_stockin.err_miss_pn1').replace('{row}', i + 1));
                            pn1Input.focus();
                            isValid = false; break;
                        }
                        if (!name) {
                            alert(t('asset_stockin.err_miss_name').replace('{row}', i + 1));
                            nameInput.focus();
                            isValid = false; break;
                        }
                    }
                }

                if (!hasData) {
                    alert(t('asset_stockin.err_empty_submit'));
                    return;
                }

                if (!isValid) return;

                let submitBtn = form.querySelector('button[type="submit"]');
                let originalBtnText = submitBtn ? submitBtn.innerHTML : '';
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = `<i class="material-icons" style="animation: spin 1s linear infinite;">autorenew</i> ${t('base.submitting') || '提交中...'}`;
                }

                try {
                    let response = await fetch('/api/asset_batch_submit', {
                        method: 'POST',
                        body: new FormData(form)
                    });
                    let result = await response.json();

                    if (result.status === 'success') {
                        showToast(result.message, 'success');
                        window.clearAssetGrid();
                    } else {
                        alert('Upload Error');
                    }
                } catch (error) {
                    console.error('提交异常',error);
                    alert('网络请求错误，请重试！');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalBtnText;
                    }
                }
            }
        }
    }

})();