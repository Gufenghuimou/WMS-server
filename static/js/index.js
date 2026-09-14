
//index.js
window.CURRENT_USER = null;
window.I18N_DICT = {};
window.CURRENT_LANG = null;
window.SYS_VER = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initApplication();
});

async function initApplication() {
    try {
        const response = await window.apiFetch('/api/system/context');
        const result = await response.json();

        if (result.status === 'success') {
            const context = result.data;
            window.CURRENT_USER = context.user;
            window.SYS_VER = context.sys_ver;

            document.getElementById('navUserName').innerText = context.user.full_name;
            document.getElementById('navUserRole').innerText = context.user.role;
            document.getElementById('navUserAvatar').src = `/static/avatars/${context.user.username}.jpg`;

            applyRolePermissions(context.user.role);

            const cachedLang = localStorage.getItem('userLang');
            let targetLang = 'en';
            if (cachedLang) {
                targetLang = cachedLang;
            } else {
                const browserlang = navigator.language || navigator.userLanguage;
                if (browserlang) {
                    targetLang = browserlang.split('-')[0];
                }
            }

            window.CURRENT_LANG = await window.loadI18nDict(targetLang);
           
            // 语言选择
            const langBtns = document.querySelectorAll('.lang-flag');
            if (langBtns.length > 0) {
                langBtns.forEach(btn => {
                    if (btn.id === window.CURRENT_LANG) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                    btn.addEventListener('click', async () => {
                        if (btn.id === window.CURRENT_LANG) return;
                        try {
                            window.CURRENT_LANG = await window.loadI18nDict(btn.id);
                        } catch (error) {
                            if (error.name === 'AbortError') return;
                            await window.openAlertModal(window.requestErrorMessage(error));
                            return;
                        }
                        langBtns.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');

                        localStorage.setItem('userLang', btn.id);

                        if (typeof window.renderI18n === 'function') {
                            window.renderI18n();
                        }

                        if (typeof window.onCurrentViewLanguageChange === 'function') {
                            window.onCurrentViewLanguageChange();
                        }
                    });
                });
            }
            // await loadI18nDict(context.lang || 'en');
            
            // 加载模态框
            try {
                let modalRes = await window.apiFetch('/static/views/global_modal.html');
                if (!modalRes.ok) throw new Error('Unable to load global dialogs');
                if (modalRes.ok) {
                    let modalHtml = await modalRes.text();
                    document.body.insertAdjacentHTML('beforeend', modalHtml);
                }
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.error("全局 Modal 加载失败:", err);
                throw err;
            }
            // 加载翻译
            renderI18n();

            const pendingBadge = document.getElementById('badge-pending');
            if (pendingBadge) {
                if (context.pending_count > 0) {
                    pendingBadge.innerText = context.pending_count;
                    pendingBadge.style.display = 'inline-block';
                } else {
                    pendingBadge.style.display = 'none';
                }
            }

            if (typeof initGlobalModals === 'function') {
                initGlobalModals();
            }
            if (typeof window.initBaseUIComponents === 'function') {
                window.initBaseUIComponents();
            }
            if (typeof window.initMapEngine === 'function') {
                window.initMapEngine();
            }
            if (typeof window.initChatSystem === 'function') {
                window.initChatSystem();
            }
            if (typeof window.initSecuritySystem === 'function') {
                window.initSecuritySystem();
            }

            document.body.classList.remove('is-loading');
            document.getElementById('global-page-loader').style.display = 'none';
            
            // 启动SPA路由
            if (typeof window.AppRouter === 'function') {
                window.AppRouter();
            }
        } else {
            window.location.href = '/login';
        }
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error("初始化系统失败", error);
        document.body.classList.remove('is-loading');
        const loader = document.getElementById('global-page-loader');
        if (loader) loader.style.display = 'none';
        if (window.confirm(window.requestErrorMessage(error) + '\n是否重新加载？ / Reload?')) {
            window.location.reload();
        }
    }
}

function applyRolePermissions(role) {
    document.querySelectorAll('.auth-admin, .auth-superadmin').forEach(el => {
        el.style.display = 'none';
    });

    if (role === 'superadmin') {
        document.querySelectorAll('.auth-superadmin, .auth-admin').forEach(el => { el.style.display = '' });
    } else if (role === 'admin') {
        document.querySelectorAll('.auth-admin').forEach(el => { el.style.display = '' });
    }
}

window.t = function(keyString) {
    if (!window.I18N_DICT) return keyString;
    const keys = keyString.split('.');
    let value = window.I18N_DICT;

    for (let k of keys) {
        if (value[k] === undefined) return keyString;
        value = value[k];
    }
    return value;
}

// 获取语言文件
window.loadI18nDict = async function(lang) {
    lang = ({ jp: 'ja', vn: 'vi' })[lang] || lang;
    if (!['zh', 'en', 'ja', 'vi'].includes(lang)) lang = 'en';
    const response = await window.apiFetch(`/static/locales/${lang}.json`);
    if (!response.ok) throw new Error('Unable to load language');
    const dictionary = await response.json();
    const saved = await window.apiFetch(`/api/switch_lang/${lang}`, { method: 'POST' });
    const result = await saved.json();
    if (!saved.ok || result.status !== 'success') throw new Error(result.message || 'Unable to save language');
    window.I18N_DICT = dictionary;
    return result.data.lang;
}

// 翻译
window.renderI18n = function() {
    // 普通文本
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = window.t(key);
        if (text !== key) {
            el.innerHTML = text;
        }
    });

    // Placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const text = window.t(key);
        if (text !== key) {
            el.placeholder = text;
        }
    });

    // Title
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const text = window.t(key);
        if (text !== key) {
            el.title = text;
        }
    });
}
