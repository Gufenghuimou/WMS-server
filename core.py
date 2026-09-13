# core.py
import os
import json

base_dir = os.path.abspath(os.path.dirname(__file__))


os.makedirs(os.path.join(base_dir, "static/item_images"), exist_ok=True)
os.makedirs(os.path.join(base_dir, "static/asset_images"), exist_ok=True)
os.makedirs(os.path.join(base_dir, "static/avatars"), exist_ok=True)




# -------------- 多语言引擎 -------------- #

try:
    with open(os.path.join(base_dir, 'static/locales/zh.json'), 'r', encoding='utf-8') as f:
        LANG_ZH = json.load(f)
    with open(os.path.join(base_dir, 'static/locales/en.json'), 'r', encoding='utf-8') as f:
        LANG_EN = json.load(f)
    with open(os.path.join(base_dir, 'static/locales/ja.json'), 'r', encoding='utf-8') as f:
        LANG_JP = json.load(f)
    with open(os.path.join(base_dir, 'static/locales/vi.json'), 'r', encoding='utf-8') as f:
        LANG_VN = json.load(f)
except FileNotFoundError:
    print('WARNING: Can not find locale folder or json file.')
    LANG_ZH = {}
    LANG_EN = {}
    LANG_JP = {}
    LANG_VN = {}

def t_lang(key: str, lang: str = 'zh', **kwargs):
    if lang == 'en':
        dictionary = LANG_EN
    elif lang in ('ja', 'jp'):
        dictionary = LANG_JP
    elif lang in ('vi', 'vn'):
        dictionary = LANG_VN
    else:
        dictionary = LANG_ZH
    keys = key.split('.')
    val = dictionary
    try:
        for k in keys:
            val = val[k]
        if isinstance(val, str) and kwargs:
            return val.format(**kwargs)
        return val
    except (KeyError, TypeError):
        return key

