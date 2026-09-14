"""Run directly: python tests/check_response_contracts.py (temporary database only)."""
import ast
import io
import os
from pathlib import Path
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.chdir(tempfile.mkdtemp(prefix="wms-contracts-"))

import pandas as pd
from fastapi.testclient import TestClient
import main
from database import create_db_tables, engine
from dependencies import get_current_user
from sqlmodel import Session
from models import InventoryItem, AssetItem, PhysicalSimCard, AssetScrapRecord

create_db_tables()
client = TestClient(main.app, follow_redirects=False)
checks = 0


def check(response, code, status):
    global checks
    assert response.status_code == code, (response.status_code, response.text)
    assert response.headers['content-type'].startswith('application/json')
    assert 'location' not in response.headers
    assert response.json()['status'] == status, response.text
    if status == 'success':
        assert 'data' in response.json()
    checks += 1


imports = ['/import', '/import_asset', '/import_history_excel', '/asset_history/import']
operations = ['/asset_out/999999', '/simcard_out/999999', '/delete/999999', '/simcard_delete/999999']
for path in imports + operations + ['/asset_scrap']:
    check(client.post(path), 401, 'error')
check(client.get('/api/system/context'), 401, 'error')
assert client.get('/mobile/approve').status_code == 303

main.app.dependency_overrides[get_current_user] = lambda: {'username': 'review', 'full_name': 'Review', 'role': 'user'}
for path in imports:
    assert client.post(path).status_code == 403

main.app.dependency_overrides[get_current_user] = lambda: {'username': 'review', 'full_name': 'Review', 'role': 'superadmin'}
for path in operations:
    check(client.post(path), 404, 'error')
check(client.post('/asset_scrap'), 200, 'success')
for path in imports:
    check(client.post(path, files={'file': ('bad.xlsx', b'not an excel file')}), 400, 'error')
    # A real workbook exercises parsing, the transaction and success response.
    buffer = io.BytesIO()
    pd.DataFrame().to_excel(buffer, index=False)
    check(client.post(path, files={'file': ('empty.xlsx', buffer.getvalue())}), 200, 'success')
    # A nonempty workbook without required columns exercises rollback/errors.
    buffer = io.BytesIO()
    pd.DataFrame([{'invalid_column': 'value'}]).to_excel(buffer, index=False)
    check(client.post(path, files={'file': ('invalid.xlsx', buffer.getvalue())}), 400, 'error')

for lang, expected in [('zh', 'zh'), ('en', 'en'), ('ja', 'ja'), ('vi', 'vi'), ('jp', 'ja'), ('vn', 'vi')]:
    response = client.post('/api/switch_lang/' + lang)
    check(response, 200, 'success')
    assert response.json()['data']['lang'] == expected
    assert client.get('/api/system/context').json()['data']['lang'] == expected
check(client.post('/api/switch_lang/invalid'), 422, 'error')
check(client.get('/api/switch_lang/en'), 200, 'success')

with Session(engine) as session:
    inventory = InventoryItem(pn_1='test', stock=1)
    sim = PhysicalSimCard(icc_id='test', phone_number='test')
    asset = AssetItem(ctrl_no='test', pn_1='test')
    session.add_all([inventory, sim, asset, AssetScrapRecord(ctrl_no='test', pn_1='test')])
    session.commit()
    inventory_id, sim_id, asset_id = inventory.id, sim.id, asset.id
check(client.post(f'/delete/{inventory_id}'), 200, 'success')
check(client.post(f'/simcard_delete/{sim_id}'), 200, 'success')
check(client.post('/asset_scrap'), 200, 'success')
with Session(engine) as session:
    assert session.get(InventoryItem, inventory_id) is None
    assert session.get(PhysicalSimCard, sim_id) is None
    assert session.get(AssetItem, asset_id) is None

for path in list(ROOT.glob('*.py')) + list((ROOT / 'routers').glob('*.py')):
    tree = ast.parse(path.read_text(encoding='utf-8-sig'))
    for func in tree.body:
        if not isinstance(func, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        if any(isinstance(d, ast.Call) and isinstance(d.func, ast.Attribute) and d.func.attr == 'post' for d in func.decorator_list):
            assert not any(isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == 'RedirectResponse' for n in ast.walk(func)), func.name

print(f'{checks} JSON response checks passed; page redirects, permissions and Python AST passed.')
