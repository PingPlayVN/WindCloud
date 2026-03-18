// js/sqlStudio.js

let db = null;
let editor = null;
let currentTable = null; 

export async function initSqlStudio() {
    if (!db) {
        try {
            const config = { locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${filename}` };
            const SQL = await initSqlJs(config);
            db = new SQL.Database();
            db.exec("PRAGMA foreign_keys = ON;"); // Bật hỗ trợ Khóa Ngoại cho SQLite
            console.log("✅ SQL.js đã khởi tạo thành công!");
        } catch (err) {
            console.error("❌ Lỗi khởi tạo SQL.js:", err);
            document.getElementById('sqlResults').innerHTML = `<div class="sql-error">Lỗi tải SQL.js: ${err.message}</div>`;
            return;
        }
    }

    if (!editor) {
        const textarea = document.getElementById('sqlCodeEditor');
        editor = CodeMirror.fromTextArea(textarea, {
            mode: 'text/x-sql', theme: 'dracula', lineNumbers: true, matchBrackets: true,
            extraKeys: { "Ctrl-Space": "autocomplete", "F5": runQuery }
        });
        
        editor.setValue(`-- SQL Studio sẵn sàng! Bấm F5 để chạy code bôi đen.\nSELECT sqlite_version();`);

        // Gắn sự kiện điều hướng
        document.getElementById('btnRunSql').onclick = runQuery;
        document.getElementById('tabSqlEditor').onclick = () => switchSqlView('editor');
        document.getElementById('tabSqlTable').onclick = () => switchSqlView('table');
        
        // Quản lý Bảng
        document.getElementById('btnViewData').onclick = loadTableData;
        document.getElementById('btnViewStruct').onclick = loadTableStruct;
        document.getElementById('btnDropTable').onclick = dropCurrentTable;
        document.getElementById('btnEmptyTable').onclick = truncateCurrentTable;
        document.getElementById('btnRefreshSchema').onclick = updateSchemaDiagram;

        // UI TẠO BẢNG
        document.getElementById('btnOpenCreateTable').onclick = () => switchSqlView('create');
        document.getElementById('btnCancelCreateTable').onclick = () => switchSqlView('editor');
        document.getElementById('btnAddColumn').onclick = addNewColumnRow;
        document.getElementById('btnSaveNewTable').onclick = executeCreateTable;
    }

    setTimeout(() => {
        editor.refresh();
        updateSchemaDiagram();
    }, 100);
}

// --- LOGIC ĐIỀU HƯỚNG TAB ---
function switchSqlView(view) {
    document.getElementById('viewSqlEditor').style.display = 'none';
    document.getElementById('viewTableManager').style.display = 'none';
    document.getElementById('viewCreateTable').style.display = 'none';
    
    document.getElementById('tabSqlEditor').classList.remove('primary');
    document.getElementById('tabSqlTable').classList.remove('primary');
    document.getElementById('tabSqlCreate').style.display = 'none';

    if (view === 'editor') {
        document.getElementById('viewSqlEditor').style.display = 'flex';
        document.getElementById('tabSqlEditor').classList.add('primary');
        setTimeout(() => editor.refresh(), 50);
    } else if (view === 'table') {
        document.getElementById('viewTableManager').style.display = 'flex';
        document.getElementById('tabSqlTable').style.display = 'block';
        document.getElementById('tabSqlTable').classList.add('primary');
    } else if (view === 'create') {
        document.getElementById('viewCreateTable').style.display = 'flex';
        document.getElementById('tabSqlCreate').style.display = 'block';
        initCreateTableForm(); // Reset form tạo bảng
    }
}

function openTableManager(tableName) {
    currentTable = tableName;
    document.getElementById('currentTableName').innerText = tableName;
    switchSqlView('table');
    loadTableData();
}

// --- LOGIC UI TẠO BẢNG (HEIDISQL STYLE) ---

function initCreateTableForm() {
    document.getElementById('newTableName').value = '';
    document.getElementById('colRowsContainer').innerHTML = '';
    addNewColumnRow(); // Luôn tạo sẵn 1 dòng trống cho người dùng
}

function addNewColumnRow() {
    const tbody = document.getElementById('colRowsContainer');
    const tr = document.createElement('tr');
    tr.className = 'col-def-row';
    
    // HTML của một dòng tạo Cột (Input tối ưu hiển thị trên Table)
    tr.innerHTML = `
        <td style="padding: 4px;"><input type="text" class="admin-input col-name" style="width: 100%; box-sizing: border-box; margin: 0; padding: 6px;" placeholder="Tên cột"></td>
        <td style="padding: 4px;">
            <select class="sort-select col-type" style="width: 100%; box-sizing: border-box; margin: 0; padding: 6px;">
                <option value="INTEGER">INTEGER (Số nguyên)</option>
                <option value="TEXT">TEXT (Chữ/Chuỗi)</option>
                <option value="REAL">REAL (Số thực/Thập phân)</option>
                <option value="BLOB">BLOB (Dữ liệu nhị phân)</option>
                <option value="BOOLEAN">BOOLEAN (Đúng/Sai)</option>
                <option value="DATETIME">DATETIME (Thời gian)</option>
            </select>
        </td>
        <td style="text-align: center;"><input type="checkbox" class="col-pk" style="transform: scale(1.3); cursor: pointer;"></td>
        <td style="text-align: center;"><input type="checkbox" class="col-ai" style="transform: scale(1.3); cursor: pointer;"></td>
        <td style="text-align: center;"><input type="checkbox" class="col-nn" style="transform: scale(1.3); cursor: pointer;"></td>
        <td style="padding: 4px;"><input type="text" class="admin-input col-default" style="width: 100%; box-sizing: border-box; margin: 0; padding: 6px;" placeholder="NULL"></td>
        <td style="padding: 4px;"><input type="text" class="admin-input col-fk" style="width: 100%; box-sizing: border-box; margin: 0; padding: 6px;" placeholder="VD: Users(id)"></td>
        <td style="text-align: center; padding: 4px;"><button class="btn-action btn-remove-col" style="color: var(--danger); padding: 5px 10px;">❌</button></td>
    `;
    
    // Nút xóa cột
    tr.querySelector('.btn-remove-col').onclick = () => tr.remove();
    
    // Logic tự động: Nếu check AI (Tự tăng) thì ép kiểu về INTEGER và tự check Khóa chính
    const aiBox = tr.querySelector('.col-ai');
    const pkBox = tr.querySelector('.col-pk');
    const typeSel = tr.querySelector('.col-type');
    aiBox.addEventListener('change', (e) => {
        if (e.target.checked) {
            pkBox.checked = true;
            typeSel.value = 'INTEGER';
        }
    });

    tbody.appendChild(tr);
}

function executeCreateTable() {
    const tableName = document.getElementById('newTableName').value.trim();
    if (!tableName) return alert("⚠️ Vui lòng nhập Tên bảng!");

    const rows = document.querySelectorAll('.col-def-row');
    if (rows.length === 0) return alert("⚠️ Bảng phải có ít nhất 1 cột!");

    let sql = `CREATE TABLE ${tableName} (\n`;
    let colDefs = [];
    let hasError = false;

    // Quét từng dòng UI để dịch ra SQL
    rows.forEach((row, index) => {
        const name = row.querySelector('.col-name').value.trim();
        const type = row.querySelector('.col-type').value;
        const pk = row.querySelector('.col-pk').checked;
        const ai = row.querySelector('.col-ai').checked;
        const nn = row.querySelector('.col-nn').checked;
        const def = row.querySelector('.col-default').value.trim();
        const fk = row.querySelector('.col-fk').value.trim();

        if (!name) {
            alert(`⚠️ Lỗi ở dòng số ${index + 1}: Tên cột không được để trống!`);
            hasError = true;
            return;
        }

        let defStr = `${name} ${type}`;
        
        // Cấu hình Khóa Chính (PK) và Tự tăng (Auto Increment)
        if (pk) {
            defStr += ` PRIMARY KEY`;
            if (ai) {
                if (type !== 'INTEGER') {
                    alert(`⚠️ Lỗi ở cột "${name}": SQLite chỉ cho phép Tự tăng (AUTOINCREMENT) đối với kiểu INTEGER!`);
                    hasError = true; return;
                }
                defStr += ` AUTOINCREMENT`;
            }
        }
        
        // Not Null
        if (nn) defStr += ` NOT NULL`;
        
        // Giá trị mặc định (Default)
        if (def) {
            // Nếu người dùng nhập chuỗi thường (ko chứa ngoặc đơn), ta không can thiệp, để nguyên như HeidiSQL
            defStr += ` DEFAULT ${def}`; 
        }

        // Khóa Ngoại (Foreign Key)
        if (fk) {
            defStr += ` REFERENCES ${fk}`;
        }

        colDefs.push("  " + defStr);
    });

    if (hasError) return;

    sql += colDefs.join(",\n");
    sql += "\n);";

    try {
        db.exec(sql);
        alert(`✅ Đã tạo bảng "${tableName}" thành công!`);
        updateSchemaDiagram();
        openTableManager(tableName); // Mở ngay bảng vừa tạo
        
        // In câu lệnh ra Editor để người dùng xem lại
        editor.setValue(`-- Câu lệnh vừa được sinh ra từ UI:\n${sql}`);
    } catch (err) {
        alert("❌ LỖI SQLITE:\n" + err.message + "\n\nCÂU LỆNH BỊ LỖI:\n" + sql);
    }
}


// --- LOGIC UI QUẢN LÝ BẢNG & TRÌNH SOẠN THẢO (GIỮ NGUYÊN) ---

function loadTableData() {
    if (!db || !currentTable) return;
    document.getElementById('btnViewData').classList.add('primary');
    document.getElementById('btnViewStruct').classList.remove('primary');
    const contentDiv = document.getElementById('tableManagerContent');
    try {
        const countRes = db.exec(`SELECT COUNT(*) FROM ${currentTable}`);
        const totalRows = countRes[0].values[0][0];
        const results = db.exec(`SELECT * FROM ${currentTable} LIMIT 500`);
        if (results.length === 0) {
            contentDiv.innerHTML = `<div style="padding: 15px; color: var(--text-muted);">Bảng trống (0 dòng). Chuyển qua tab "Trình gõ Query" để INSERT dữ liệu nhé.</div>`;
            return;
        }
        let html = `<div style="padding: 10px 15px; font-size: 13px; background: var(--bg-body);">Hiển thị 500 dòng. (Tổng: <strong>${totalRows}</strong> dòng)</div>`;
        html += renderHtmlTable(results[0].columns, results[0].values);
        contentDiv.innerHTML = html;
    } catch (err) { contentDiv.innerHTML = `<div class="sql-error" style="padding:15px; color:#dc3545;">Lỗi: ${err.message}</div>`; }
}

function loadTableStruct() {
    if (!db || !currentTable) return;
    document.getElementById('btnViewData').classList.remove('primary');
    document.getElementById('btnViewStruct').classList.add('primary');
    const contentDiv = document.getElementById('tableManagerContent');
    try {
        const results = db.exec(`PRAGMA table_info(${currentTable});`);
        if (results.length === 0) return;
        let html = `<div style="padding: 10px 15px; font-size: 13px; background: var(--bg-body);">Cấu trúc bảng <strong>${currentTable}</strong></div>`;
        html += renderHtmlTable(results[0].columns, results[0].values);
        contentDiv.innerHTML = html;
    } catch (err) { contentDiv.innerHTML = `<div class="sql-error" style="padding:15px; color:#dc3545;">Lỗi: ${err.message}</div>`; }
}

function dropCurrentTable() {
    if(!currentTable || !db) return;
    if(confirm(`⚠️ CẢNH BÁO: Bạn có CHẮC CHẮN muốn XÓA BỎ bảng "${currentTable}" không?`)) {
        try {
            db.exec(`DROP TABLE ${currentTable}`);
            switchSqlView('editor');
            updateSchemaDiagram();
            document.getElementById('sqlResults').innerHTML = `<div style="padding: 15px; color: #10b981; font-weight: bold;">✅ Đã xóa bảng ${currentTable}!</div>`;
        } catch(e) { alert('Lỗi: ' + e.message); }
    }
}

function truncateCurrentTable() {
    if(!currentTable || !db) return;
    if(confirm(`🧹 Xóa sạch toàn bộ dữ liệu trong bảng "${currentTable}"?`)) {
        try {
            db.exec(`DELETE FROM ${currentTable}`);
            loadTableData();
        } catch(e) { alert('Lỗi: ' + e.message); }
    }
}

function runQuery() {
    if (!db) return;
    let codeToRun = editor.getSelection();
    if (!codeToRun) codeToRun = editor.getValue();
    const resultDiv = document.getElementById('sqlResults');
    try {
        const results = db.exec(codeToRun);
        if (results.length === 0) {
            resultDiv.innerHTML = '<div style="padding: 15px; color: #10b981; font-weight: bold;">✅ Truy vấn thực thi thành công!</div>';
        } else {
            resultDiv.innerHTML = renderHtmlTable(results[0].columns, results[0].values);
        }
        updateSchemaDiagram();
    } catch (err) {
        resultDiv.innerHTML = `<div class="sql-error" style="color: #dc3545; padding: 15px; font-weight: bold; background: rgba(220,53,69,0.1);">❌ Lỗi truy vấn: ${err.message}</div>`;
    }
}

function renderHtmlTable(columns, values) {
    let html = '<table class="sql-result-table"><thead><tr>';
    columns.forEach(col => html += `<th>${col}</th>`);
    html += '</tr></thead><tbody>';
    values.forEach(row => {
        html += '<tr>';
        row.forEach(val => html += `<td>${val !== null ? val : '<em style="color:#aaa">NULL</em>'}</td>`);
        html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
}

function updateSchemaDiagram() {
    const schemaDiv = document.getElementById('sqlSchemaList');
    if (!db) return;
    try {
        const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
        if (tablesResult.length === 0) {
            schemaDiv.innerHTML = '<p style="color:var(--text-muted); font-size: 13px;">Chưa có bảng nào.</p>';
            return;
        }
        const tableNames = tablesResult[0].values.map(v => v[0]);
        let schemaHtml = '';
        tableNames.forEach(tableName => {
            const columnsResult = db.exec(`PRAGMA table_info(${tableName});`);
            schemaHtml += `<div class="schema-table" style="margin-bottom: 10px; border: 1px solid var(--border); border-radius: 6px; overflow: hidden;">
                <div class="schema-table-name clickable-table" data-table="${tableName}" style="background: var(--primary); color: white; padding: 8px 10px; font-weight: bold; font-size: 14px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" title="Quản lý bảng">
                    <span>📇 ${tableName}</span>
                    <span style="font-size: 11px; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px;">⚙️</span>
                </div>`;
            if (columnsResult.length > 0) {
                columnsResult[0].values.forEach(col => {
                    const colName = col[1];
                    const colType = col[2] || 'ANY';
                    const isPk = col[5] ? '🔑 ' : '📄 ';
                    schemaHtml += `<div class="schema-column" style="padding: 4px 10px; font-size: 12px; border-top: 1px solid var(--border); display: flex; justify-content: space-between;">
                        <span>${isPk}${colName}</span>
                        <span style="color: var(--text-muted); font-family: monospace;">${colType}</span>
                    </div>`;
                });
            }
            schemaHtml += `</div>`;
        });
        schemaDiv.innerHTML = schemaHtml;

        document.querySelectorAll('.clickable-table').forEach(el => {
            el.addEventListener('click', (e) => {
                openTableManager(e.currentTarget.getAttribute('data-table'));
            });
        });
    } catch (err) { console.error("Lỗi đọc DB:", err); }
}