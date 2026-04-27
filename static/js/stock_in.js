let currentRowCount = 0;

// ==========================================
// 1. 动态生成新行引擎
// ==========================================
function addRow() {
    let i = currentRowCount;
    let today = new Date().toISOString().split('T')[0];

    let tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" name="pn_1" class="cell-input pn1-input" data-row="${i}" autocomplete="off"></td>
        <td><input type="text" name="pn_2" class="cell-input pn2-input" data-row="${i}" autocomplete="off"></td>
        <td><input type="text" name="name" class="cell-input name-input" data-row="${i}" autocomplete="off"></td>
        <td><input type="text" name="description_1" class="cell-input desc1-input" data-row="${i}"></td>
        <td><input type="text" name="description_2" class="cell-input desc2-input" data-row="${i}"></td>
        <td><input type="number" name="stock" class="cell-input stock-input" data-row="${i}"></td>
        <td><input type="date" name="first_in_date" class="cell-input date-input" data-row="${i}" value="${today}"></td>
        <td><input type="text" name="location" class="cell-input loc-input" data-row="${i}"></td>
        <td><input type="text" name="remarks" class="cell-input rem-input" data-row="${i}"></td>
        <td style="text-align: center; vertical-align: middle;">
        <button type="button" class="btn-undo" onclick="clearSingleRow(${i})" title="${STOCKIN_I18N.clear_row_title}">
            <i class="material-icons" style="font-size: 1.2rem">delete_outline</i>
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
        if (rowIndex === currentRowCount - 1 && this.value.trim() !== '') {
            addRow();
        }
    });

    currentRowCount++;
}

// ==========================================
// 🌟 挂载到 Window 的外部调用函数
// ==========================================
window.clearSingleRow = function(rowIndex) {
    let inputs = document.querySelectorAll(`input[data-row="${rowIndex}"]`);
    inputs.forEach(input => {
        if (input.type === 'date') {
            input.value = new Date().toISOString().split('T')[0];
        } else {
            input.value = '';
        }
        input.classList.remove('duplicate-warn', 'correct-flash');
    });
    checkAllDuplicates();
};

window.clearGrid = function() {
    if (confirm(STOCKIN_I18N.confirm_clear_all)) {
        document.getElementById('gridBody').innerHTML = '';
        currentRowCount = 0;
        addRow();
    }
};

// ==========================================
// 🌟 核心引擎函数
// ==========================================
function checkAllDuplicates() {
    let pn1Map = {};
    let pn2Map = {};
    let hasDuplicates = false;

    document.querySelectorAll('.pn1-input').forEach(el => {
        el.classList.remove('duplicate-warn');
        let val = el.value.trim();
        if (val) {
            if (!pn1Map[val]) pn1Map[val] = [];
            pn1Map[val].push(el);
        }
    });

    document.querySelectorAll('.pn2-input').forEach(el => {
        el.classList.remove('duplicate-warn');
        let val = el.value.trim();
        if (val) {
            if (!pn2Map[val]) pn2Map[val] = [];
            pn2Map[val].push(el);
        }
    });

    for (let val in pn1Map) {
        if (pn1Map[val].length > 1) {
            hasDuplicates = true;
            pn1Map[val].forEach(el => el.classList.add('duplicate-warn'));
        }
    }
    for (let val in pn2Map) {
        if (pn2Map[val].length > 1) {
            hasDuplicates = true;
            pn2Map[val].forEach(el => el.classList.add('duplicate-warn'));
        }
    }
    return hasDuplicates;
}

async function triggerAutoComplete(inputElement) {
    let pnVal = inputElement.value.trim();
    if (!pnVal) return;

    let rowIdx = inputElement.getAttribute('data-row');

    try {
        let response = await fetch(`/api/item/${encodeURIComponent(pnVal)}`);
        let data = await response.json();

        if (!data.error) {
            if (data.matched_by === "pn_2") {
                inputElement.value = data.pn_1;
                inputElement.classList.add('correct-flash');
                setTimeout(() => {
                    inputElement.classList.remove('correct-flash');
                    checkAllDuplicates();
                }, 800);
            }

            let safeSet = (selector, val) => {
                let el = document.querySelector(`${selector}[data-row="${rowIdx}"]`);
                if(el && !el.value) el.value = val || '';
            };

            safeSet('.pn2-input', data.pn_2);
            safeSet('.name-input', data.name);
            safeSet('.desc1-input', data.description_1);
            safeSet('.desc2-input', data.description_2);
            safeSet('.loc-input', data.location);
            safeSet('.rem-input', data.remarks);

            checkAllDuplicates();
        }
    } catch (err) {
        console.error(STOCKIN_I18N.query_fail, err);
    }
}

// ==========================================
// 🌟 页面加载完成后统一绑定全局事件
// ==========================================
document.addEventListener("DOMContentLoaded", function() {
    // 1. 初始化生成第一行
    addRow();

    const gridBody = document.getElementById('gridBody');
    const stockInForm = document.getElementById('stockInForm');

    if (gridBody) {
        // 2. 绑定全局输入查重监听
        gridBody.addEventListener('input', function(e) {
            if (e.target.classList.contains('pn1-input') || e.target.classList.contains('pn2-input')) {
                checkAllDuplicates();
            }
        });

        // 3. Excel 智能粘贴拦截解析
        gridBody.addEventListener('paste', function(e) {
            let pasteData = (e.clipboardData || window.clipboardData).getData('text');
            if (!pasteData) return;

            if (pasteData.includes('\t') || pasteData.includes('\n')) {
                e.preventDefault();

                let startInput = e.target;
                if (!startInput.classList.contains('cell-input')) return;

                let startRowIdx = parseInt(startInput.getAttribute('data-row'));
                let startColName = startInput.getAttribute('name');

                const colNames = ['pn_1', 'pn_2', 'name', 'description_1', 'description_2', 'stock', 'first_in_date', 'location', 'remarks'];
                let startColIdx = colNames.indexOf(startColName);
                if (startColIdx === -1) startColIdx = 0;

                let rows = pasteData.split(/\r\n|\n|\r/).filter(r => r.trim() !== '');

                rows.forEach((rowStr, i) => {
                    let targetRowIdx = startRowIdx + i;

                    while (targetRowIdx >= currentRowCount) {
                        addRow();
                    }

                    let cells = rowStr.split('\t');
                    cells.forEach((cellVal, j) => {
                        let targetColIdx = startColIdx + j;
                        if (targetColIdx < colNames.length) {
                            let cellName = colNames[targetColIdx];
                            let inputEl = document.querySelector(`input[name="${cellName}"][data-row="${targetRowIdx}"]`);
                            if (inputEl) {
                                inputEl.value = cellVal.trim();
                                if (cellName === 'pn_1') triggerAutoComplete(inputEl);
                            }
                        }
                    });
                });

                setTimeout(checkAllDuplicates, 100);

                let lastPn1 = document.querySelector(`input[name="pn_1"][data-row="${currentRowCount-1}"]`);
                if (lastPn1 && lastPn1.value.trim() !== '') {
                    addRow();
                }
            }
        });
    }

    if (stockInForm) {
        // 4. 拦截回车键 (扫码枪友好体验)
        stockInForm.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                let currentInput = e.target;
                if (currentInput.classList.contains('pn1-input')) {
                    currentInput.blur();
                    let rowIdx = currentInput.getAttribute('data-row');
                    let stockInput = document.querySelector(`.stock-input[data-row="${rowIdx}"]`);
                    if (stockInput) stockInput.focus();
                } else {
                    currentInput.blur();
                }
            }
        });

        // 5. 智能表单提交校验
        stockInForm.addEventListener('submit', function(e) {
            if (checkAllDuplicates()) {
                alert(STOCKIN_I18N.err_duplicate);
                e.preventDefault();
                return;
            }

            let isValid = true;
            let hasData = false;

            for (let i = 0; i < currentRowCount; i++) {
                let pn1Input = document.querySelector(`.pn1-input[data-row="${i}"]`);
                let nameInput = document.querySelector(`.name-input[data-row="${i}"]`);
                let stockInput = document.querySelector(`.stock-input[data-row="${i}"]`);

                if (!pn1Input) continue;

                let pn1 = pn1Input.value.trim();
                let name = nameInput.value.trim();
                let stock = stockInput.value.trim();

                if (pn1 || name || stock) {
                    hasData = true;
                    if (!pn1) {
                        alert(STOCKIN_I18N.err_miss_pn1.replace('{row}', i + 1));
                        pn1Input.focus();
                        isValid = false; break;
                    }
                    if (!name) {
                        alert(STOCKIN_I18N.err_miss_name.replace('{row}', i + 1));
                        nameInput.focus();
                        isValid = false; break;
                    }
                    if (!stock) {
                        alert(STOCKIN_I18N.err_miss_qty.replace('{row}', i + 1));
                        stockInput.focus();
                        isValid = false; break;
                    }
                }
            }

            if (!hasData) {
                alert(STOCKIN_I18N.err_empty_submit);
                e.preventDefault();
                return;
            }

            if (!isValid) e.preventDefault();
        });
    }
});