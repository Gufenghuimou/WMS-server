let currentRowCount = 0;

// 动态行生成
function addRow() {
    let i = currentRowCount;
    let tr = document.createElement("tr");
    tr.innerHTML = `
        <td><input type="text" name="icc_id" class="cell-input iccid-input" data-row="${i}" autocomplete="off"></td>
        <td><input type="text" name="carrier" class="cell-input carrier-input" data-row="${i}" autocomplete="off"></td>
        <td><input type="text" name="phone_number" class="cell-input number-input" data-row="${i}" autocomplete="off"></td>
        <td><input type="text" name="note" class="cell-input note-input" data-row="${i}" autocomplete="off"></td>
        <td style="text-align: center; vertical-align: middle;">
        <button type="button" class="btn-undo" onclick="clearSingleRow(${i})" title="${STOCKIN_I18N.clear_row_title}">
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
        if (rowIndex === currentRowCount - 1 && this.value.trim() !== '') addRow();
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

window.clearGrid = function() {
    if (confirm(STOCKIN_I18N.confirm_clear_all)) {
        document.getElementById("gridBody").innerHTML = '';
        currentRowCount = 0;
        addRow();
    }
}

// 全局事件

document.addEventListener('DOMContentLoaded', function() {
    addRow();
    const gridBody = document.getElementById("gridBody");
    const stockInForm = document.getElementById("stockInForm");

    if (gridBody) {
        gridBody.addEventListener('input', function(e) {
            if (e.target.classList.contains('iccid-input') || e.target.classList.contains('number-input')) {
                checkAllDuplicates();
            }
        })
    }

    gridBody.addEventListener('paste', function(e) {
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
                while (targetRowIdx >= currentRowCount) { addRow(); }
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
            if (lastIcc && lastIcc.value.trim() !== '') { addRow(); }
        }
    });

    if (stockInForm) {
        stockInForm.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                let currentInput = e.target;
                currentInput.blur();
                let rowIdx = parseInt(currentInput.getAttribute('data-row'));
                let nextInput = document.querySelector(`input[name="icc_id"][data-row="${rowIdx+1}"]`);
                if (nextInput) nextInput.focus();
            }
        });

        stockInForm.addEventListener("submit", function (e) {
            let hasTableDuplicates = checkAllDuplicates();
            let hasDbDuplicates = document.querySelector('.db-exist-warn') !== null;
            if (hasTableDuplicates || hasDbDuplicates) {
                alert(STOCKIN_I18N.err_duplicate);
                e.preventDefault();
                return;
            }

            let isValid = true;
            let hasData = false;
            for (let i =0; i < currentRowCount; i++) {
                let iccInput = document.querySelector(`.iccid-input[data-row="${i}"]`);
                let carrierInput = document.querySelector(`.carrier-input[data-row="${i}"]`);
                let numberInput = document.querySelector(`.number-input[data-row="${i}"]`);

                if (!iccInput) continue;

                let iccId = iccInput.value.trim();
                let carrier = carrierInput.value.trim();
                let number = numberInput.value.trim();

                if (iccId || carrier || number) {
                    hasData = true;
                    if (!iccId) {
                        alert(STOCKIN_I18N.err_miss_pn1.replace('{row}', i + 1));
                        iccInput.focus();
                        isValid = false; break;
                    }
                    if (!carrier) {
                        alert(STOCKIN_I18N.err_miss_name.replace('{row}', i + 1));
                        carrierInput.focus();
                        isValid = false; break;
                    }
                    if (!number) {
                        alert(STOCKIN_I18N.err_miss_qty.replace('{row}', i + 1));
                        numberInput.focus();
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

        console.log(data);
        console.log(inputVal);

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
        console.error(STOCKIN_I18N.query_fail, err);
    }
    return exist;
}