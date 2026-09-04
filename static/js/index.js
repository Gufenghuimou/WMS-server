
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
        const response = await fetch('/api/system/context');
        const result = await response.json();

        if (result.status === 'success') {
            const context = result.data;
            window.CURRENT_USER = context.user;
            window.SYS_VER = context.sys_ver;

            document.getElementById('navUserName').innerText = context.user.full_name;
            document.getElementById('navUserRole').innerText = context.user.role;
            document.getElementById('navUserAvatar').src = `/static/avatars/${context.user.username}.jpg`;

            applyRolePermissions(context.user.role);

            const userlang = navigator.language || navigator.userLanguage;
            if (userlang) {
                let lang = userlang.split('-')[0];
                await window.loadI18nDict(lang || 'en');
                window.CURRENT_LANG = lang || 'en';
            }

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
                        langBtns.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');

                        await window.loadI18nDict(btn.id);
                        window.CURRENT_LANG = btn.id;

                        if (typeof window.renderI18n === 'function') {
                            window.renderI18n();
                        }
                    });
                });
            }
            // await loadI18nDict(context.lang || 'en');
            
            // 加载模态框
            try {
                let modalRes = await fetch('/static/views/global_modal.html'); 
                if (modalRes.ok) {
                    let modalHtml = await modalRes.text();
                    document.body.insertAdjacentHTML('beforeend', modalHtml);
                }
            } catch (err) {
                console.error("全局 Modal 加载失败:", err);
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
        console.error("初始化系统失败", error);
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
    try {
        const response = await fetch(`/static/locales/${lang}.json`);
        window.I18N_DICT = await response.json();
    } catch (error) {
        console.error("多语言加载失败", error);
    }
}

// 翻译
window.renderI18n = function() {
    // 普通文本
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const text = window.t(key);
        if (text !== key) {
            el.innerText = text;
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