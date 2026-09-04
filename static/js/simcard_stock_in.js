(() => {

    let currentRowCount = 0;
    // 动态行生成
    function addSimcardRow() {
        let i = currentRowCount;
        let tr = document.createElement("tr");
        tr.innerHTML = `
            <td><input type="text" name="icc_id" class="cell-input iccid-input" data-row="${i}" autocomplete="off"></td>
            <td><input type="text" name="carrier" class="cell-input carrier-input" data-row="${i}" autocomplete="off"></td>
            <td><input type="text" name="phone_number" class="cell-input number-input" data-row="${i}" autocomplete="off"></td>
            <td><input type="text" name="note" class="cell-input note-input" data-row="${i}" autocomplete="off"></td>
            <td style="text-align: center; vertical-align: middle;">
            <button type="button" class="btn-undo" onclick="clearSingleRow(${i})" title="${t('stockin.clear_row_title')}">
                <i class="material-icons" style="font-size: 1.2rem">delete_outline</i>
            </button>
            </td>
        `;
        document.getElementById("gridBody").appendChild(tr);

        let iccInput = tr.querySelector('.iccid-input');

        iccInput.addEventListener('blur', function () {
            triggerAutoComplete(this);
        });

        iccInput.addEventListener('input', function () {
            let rowIndex = parseInt(this.getAttribute('data-row'));
            if (rowIndex === currentRowCount - 1 && this.value.trim() !== '') addSimcardRow();
        });
        currentRowCount++;
    }

    // 删除行
    window.clearSingleRow = function(rowIndex) {
        let inputs = document.querySelectorAll(`input[data-row="${rowIndex}"]`);
        inputs.forEach(input => {
            input.value = '';
            input.classList.remove('duplicate-warn', 'db-exist-warn');
        })
        checkAllDuplicates();
    }

    window.clearSimcardGrid = function() {
        if (confirm(t('stockin.confirm_clear_all'))) {
            document.getElementById("gridBody").innerHTML = '';
            currentRowCount = 0;
            addSimcardRow();
        }
    }

    // 全局事件
    window.initSimcardStockPage = function() {
        const topActionsContainer = document.querySelector('.top-actions');
        const pageActions = document.getElementById('page-top-actions');
        if (pageActions) {
            topActionsContainer.innerHTML = pageActions.innerHTML;
            pageActions.remove();
        }

        const indicator = document.getElementById('indicator');
        indicator.innerHTML = `
            <i class="material-icons" style="font-size: 1.45rem; color: var(--primary-green);">sim_card</i>
            ${t('status.asset_stock_in')}:
            <span id="simcardStockinCountDisplay" style="font-size: 1.2rem; font-weight: bold; color: var(--primary-green); margin-left: 4px;">
                0
            </span>
        `;

        currentRowCount = 0;
        addSimcardRow();
        const gridBody = document.getElementById("gridBody");
        const stockInForm = document.getElementById("stockInForm");

        if (gridBody) {
            gridBody.oninput = function(e) {
                if (e.target.classList.contains('iccid-input') || e.target.classList.contains('number-input')) {
                    checkAllDuplicates();
                }
            }
        }

        gridBody.onpaste = function(e) {
            let pasteData = (e.clipboardData || window.clipboardData).getData('text');
            if (!pasteData) return;
            if (pasteData.includes('\t') || pasteData.includes('\n')) {
                e.preventDefault();
                let startInput = e.target;
                if (!startInput.classList.contains('cell-input')) return;

                let startRowIdx = parseInt(startInput.getAttribute('data-row'));
                let startColName = startInput.getAttribute('name');
                const colNames = ['icc_id', 'carrier', 'phone_number', 'note'];
                let startColIdx = colNames.indexOf(startColName);
                if (startColIdx === -1) startColIdx = 0;

                let rows = pasteData.split(/\r\n|\n|\r/).filter(r => r.trim() !== '');
                rows.forEach((rowStr, i) => {
                    let targetRowIdx = startRowIdx + i;
                    while (targetRowIdx >= currentRowCount) { addSimcardRow(); }
                    let cells = rowStr.split('\t');
                    cells.forEach((cellVal, j) => {
                    let targetColIdx = startColIdx + j;
                    if (targetColIdx < colNames.length) {
                        let cellName = colNames[targetColIdx];
                        let inputEl = document.querySelector(`input[name="${cellName}"][data-row="${targetRowIdx}"]`);
                        if (inputEl) {
                            inputEl.value = cellVal.trim();
                            if (cellName === 'icc_id') {
                                triggerAutoComplete(inputEl);
                            }
                        }
                    }
                    });
                });

                setTimeout(checkAllDuplicates, 100);

                let lastIcc = document.querySelector(`input[name="icc_id"][data-row="${currentRowCount-1}"]`);
                if (lastIcc && lastIcc.value.trim() !== '') { addSimcardRow(); }
            }
        }

        if (stockInForm) {
            stockInForm.onkeydown = function (e) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    let currentInput = e.target;
                    currentInput.blur();
                    let rowIdx = parseInt(currentInput.getAttribute('data-row'));
                    let nextInput = document.querySelector(`input[name="icc_id"][data-row="${rowIdx+1}"]`);
                    if (nextInput) nextInput.focus();
                }
            }

            stockInForm.onsubmit = async function (e) {
                e.preventDefault();
                let hasTableDuplicates = checkAllDuplicates();
                let hasDbDuplicates = document.querySelector('.db-exist-warn') !== null;
                if (hasTableDuplicates || hasDbDuplicates) {
                    alert(t('stockin.err_duplicate'));
                    return;
                }

                let isValid = true;
                let hasData = false;
                for (let i = 0; i < currentRowCount; i++) {
                    let iccInput = document.querySelector(`.iccid-input[data-row="${i}"]`);
                    let carrierInput = document.querySelector(`.carrier-input[data-row="${i}"]`);
                    let numberInput = document.querySelector(`.number-input[data-row="${i}"]`);

                    if (!iccInput) continue;

                    iccInput.value = iccInput.value.replace(/\s+/g, '').trim();
                    let iccId = iccInput.value;
                    let carrier = carrierInput.value.trim();
                    let number = numberInput.value.trim();

                    if (iccId || carrier || number) {
                        hasData = true;
                        if (!iccId) {
                            alert(t('stockin.err_miss_pn1').replace('{row}', i + 1));
                            iccInput.focus();
                            isValid = false; break;
                        }
                        if (!carrier) {
                            alert(t('stockin.err_miss_name').replace('{row}', i + 1));
                            carrierInput.focus();
                            isValid = false; break;
                        }
                        if (!number) {
                            alert(t('stockin.err_miss_qty').replace('{row}', i + 1));
                            numberInput.focus();
                            isValid = false; break;
                        }
                    }
                }

                if (!hasData) {
                    alert(t('stockin.err_empty_submit'));
                    e.preventDefault();
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
                    let response = await fetch('/api/simcard_batch_submit', {
                        method: 'POST',
                        body: new FormData(stockInForm)
                    });
                    let result = await response.json();
                    if (result.status === 'success') {
                        showToast(result.message, 'success');
                        window.clearSimcardGrid();
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
    };

    // 表格查重函数
    function checkAllDuplicates() {
        let iccMap = {};
        let numMap = {};
        let hasDuplicates = false;

        document.querySelectorAll('.iccid-input').forEach((el) => {
            el.classList.remove('duplicate-warn');
            let val = el.value.trim();
            if (val) {
                if (!iccMap[val]) iccMap[val] = [];
                iccMap[val].push(el);
            }
        });

        document.querySelectorAll('.number-input').forEach((el) => {
            el.classList.remove('duplicate-warn');
            let val = el.value.trim();
            if (val) {
                if (!numMap[val]) numMap[val] = [];
                numMap[val].push(el);
            }
        });

        for (let val in iccMap) {
            if (iccMap[val].length > 1) {
                hasDuplicates = true;
                iccMap[val].forEach(el => {el.classList.add('duplicate-warn');});
            }
        }
        for (let val in numMap) {
            if (numMap[val].length > 1) {
                hasDuplicates = true;
                numMap[val].forEach(el => {el.classList.add('duplicate-warn');});
            }
        }
        return hasDuplicates;
    }

    // 库内查重

    async function triggerAutoComplete(inputElement) {
        let inputVal = inputElement.value.replace(/\s+/g, "");
        let exist = false;
        if (!inputVal) return;

        let rowIdx = inputElement.getAttribute('data-row');
        inputElement.classList.remove('db-exist-warn');

        try {
            let response = await fetch(`/api/simcard/${encodeURIComponent(inputVal)}`);
            let data = await response.json();
            if (!data.error) {
                inputElement.classList.add('db-exist-warn');

                let safeSet = (selector, val) => {
                    let el = document.querySelector(`${selector}[data-row="${rowIdx}"]`);
                    if (el && !el.value) el.value = val || '';
                };
                inputElement.value = '';
                safeSet('.iccid-input', data.icc_id);
                safeSet('.carrier-input', data.carrier);
                safeSet('.number-input', data.phone_number);
                safeSet('.note-input', data.note);

                checkAllDuplicates();
                exist = true;
            }
        } catch (err) {
            console.error(t('stockin.query_fail'), err);
        }
        return exist;
    }

})();