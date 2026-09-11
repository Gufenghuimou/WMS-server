// Mobile 外壳入口：用户信息、语言、菜单及公共请求工具。
(() => {
    window.CURRENT_USER = null;
    window.I18N_DICT = {};
    window.onCurrentViewLanguageChange = null;
    let languageRequestVersion = 0;

    // 与 PC 端一致，页面通过 t('key') 获取翻译。
    window.t = function(key, fallback = key) {
        let value = window.I18N_DICT;
        for (const part of key.split('.')) {
            if (value == null || value[part] === undefined) return fallback;
            value = value[part];
        }
        return value;
    };

    // 所有 mobile JSON 请求共用：登录失效、非 JSON 响应和业务错误处理。
    window.requestMobileJson = async function(url, options = {}) {
        const response = await fetch(url, options);
        const redirectedToLogin = response.redirected && new URL(response.url).pathname.includes('login');
        if (response.status === 401 || redirectedToLogin) {
            window.location.assign('/mobile/login');
            throw new Error(window.t('mspa.login', 'Please sign in again'));
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error(window.t('mspa.requestError', 'Unable to load data'));
        }
        const result = await response.json();
        if (!response.ok || result.status !== 'success') {
            throw new Error(result.message || window.t('mspa.requestError', 'Request failed'));
        }
        return result;
    };

    window.renderI18n = function() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            element.textContent = window.t(element.dataset.i18n, element.textContent);
        });
    };

    window.setMobileMenuOpen = function(isOpen) {
        const menu = document.getElementById('mobileMenu');
        const overlay = document.getElementById('mobileMenuOverlay');
        const toggleButton = document.getElementById('mobileMenuToggle');
        menu.classList.toggle('open', isOpen);
        menu.inert = !isOpen;
        overlay.hidden = !isOpen;
        toggleButton.setAttribute('aria-expanded', String(isOpen));
        document.body.classList.toggle('menu-open', isOpen);
    };

    async function switchMobileLanguage(lang) {
        const currentVersion = ++languageRequestVersion;
        if (!['zh', 'en', 'ja', 'vi'].includes(lang)) lang = 'en';
        const response = await fetch(`/static/locales/${lang}.json`);
        if (!response.ok) throw new Error('Unable to load language');
        const languageData = await response.json();
        // 快速切换语言时，忽略较早发出的请求。
        if (currentVersion !== languageRequestVersion) return;

        window.I18N_DICT = languageData;
        document.documentElement.lang = lang;
        try {
            localStorage.setItem('userLang', lang);
        } catch (error) {
            console.warn('无法保存语言偏好', error);
        }
        document.querySelectorAll('[data-lang]').forEach(button => {
            button.classList.toggle('active', button.dataset.lang === lang);
        });
        window.renderI18n();
        if (typeof window.onCurrentViewLanguageChange === 'function') {
            window.onCurrentViewLanguageChange();
        }
    }

    function renderMobileUser() {
        const user = window.CURRENT_USER;
        document.getElementById('mobileUserName').textContent = user.full_name || user.username;
        document.getElementById('mobileUserRole').textContent = user.role;
        const avatar = document.getElementById('mobileAvatar');
        avatar.onerror = function() {
            avatar.hidden = true;
            document.getElementById('mobileAvatarFallback').hidden = false;
        };
        avatar.src = `/static/avatars/${encodeURIComponent(user.username)}.jpg`;
    }

    function bindEvents() {
        document.getElementById('mobileMenuToggle').onclick = () => window.setMobileMenuOpen(true);
        document.getElementById('mobileMenuOverlay').onclick = () => window.setMobileMenuOpen(false);
        // document.getElementById('mobileMenuClose').onclick = function() {
        //     window.setMobileMenuOpen(false);
        //     document.getElementById('mobileMenuToggle').focus();
        // };
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') window.setMobileMenuOpen(false);
        });
        document.querySelectorAll('[data-lang]').forEach(button => {
            button.onclick = async function() {
                try {
                    await switchMobileLanguage(button.dataset.lang);
                } catch (error) {
                    window.alert(error.message);
                }
            };
        });
    }

    async function initMobileApplication() {
        const context = document.getElementById('mobileContext').textContent;
        window.CURRENT_USER = JSON.parse(context);
        renderMobileUser();
        bindEvents();

        let lang = navigator.language.split('-')[0];
        try {
            lang = localStorage.getItem('userLang') || lang;
        } catch (error) {
            console.warn('无法读取语言偏好', error);
        }
        try {
            await switchMobileLanguage(lang);
        } catch (error) {
            console.error('语言加载失败', error);
            window.I18N_DICT = {};
        }
        window.setMobileMenuOpen(false);
        await window.MobileAppRouter();
    }

    document.addEventListener('DOMContentLoaded', initMobileApplication);
})();
