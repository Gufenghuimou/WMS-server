# utils.py
from sqlmodel import Session, select, not_
import socket
from datetime import datetime
import os
import json

from models import InventoryItem, HistoryLog
from database import engine

base_dir = os.path.abspath(os.path.dirname(__file__))

PRINTER_CONFIG_FILE = os.path.join(base_dir, 'printer_config.json')

def update_single_usage(session: Session, pn_1: str):
    now = datetime.now()
    item = session.exec(select(InventoryItem).where(InventoryItem.pn_1 == pn_1)).first()
    if not item:
        return

    statement = select(HistoryLog).where(HistoryLog.pn_1 == item.pn_1, HistoryLog.change_qty < 0, not_(HistoryLog.note.like('%撤销%')))
    logs = session.exec(statement).all()

    u1, u2, u3 = 0, 0, 0
    for log in logs:
        try:
            log_date = datetime.strptime(log.date[:10], "%Y-%m-%d")
            days_diff = (now - log_date).days
            qty = abs(log.change_qty)
            if days_diff < 365:
                u1 += qty
            if days_diff < 730:
                u2 += qty
            if days_diff < 1095:
                u3 += qty
        except:
            continue
    item.usage_1y = u1
    item.usage_2y = u2
    item.usage_3y = u3
    session.add(item)

def update_all_usage_stats(session: Session):
    now = datetime.now()
    items = session.exec(select(InventoryItem)).all()

    for item in items:
        update_single_usage(session, item.pn_1)
    session.commit()

def generate_next_seq(last_seq: str) -> str:
    if not last_seq:
        return '001'
    if last_seq.isdigit() and int(last_seq) < 999:
        return f'{int(last_seq) + 1:03d}'
    if last_seq == '999':
        return '99A'
    chars = '0123456789ABCDEF'
    seq_list = list(last_seq)
    for i in range(2, -1, -1):
        next_idx = chars.index(seq_list[i]) + 1
        if next_idx < len(chars):
            seq_list[i] = chars[next_idx]
            break
        else:
            seq_list[i] = '0'
    return ''.join(seq_list)

def get_printer_config():
    if os.path.exists(PRINTER_CONFIG_FILE):
        try:
            with open(PRINTER_CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {'ip': '10.171.4.203', 'port': 6101}

def save_printer_config(ip: str, port: int):
    with open(PRINTER_CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump({'ip': ip, 'port': port}, f)


CURRENT_PRINTER_CONFIG = get_printer_config()
def zpl_print_task(left_text:str, right_barcode:str):
    if not left_text: left_text = ''
    if not right_barcode: right_barcode = ''

    zpl = f'''
    ^XA
    ^PW950
    ^LL118
    ^CI28
    ^MD15
    ^FX 左侧标签：仅显示数字 ^FS
    ^FO40,35^A0N,50,50^FD{left_text}^FS
    ^FX 右侧标签：条码 + 底部数字 ^FS
    ^FO500,15^BY2
    ^BCN,55,N,N,N
    ^FD{right_barcode}^FS
    ^FO500,80^A0N,25,25^FD{right_barcode}^FS
    ^XZ'''

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(3)
            s.connect((CURRENT_PRINTER_CONFIG['ip'], CURRENT_PRINTER_CONFIG['port']))
            s.sendall(zpl.encode('utf-8'))
    except Exception as e:
        print(f"⚠️ 打印机连接失败或离线: {e}")