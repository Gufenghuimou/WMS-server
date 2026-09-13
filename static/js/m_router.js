// Mobile 路由：页面配置、导航状态、HTML 加载和离页清理。
(() => {
    const mobileRoutes = {
        '/mobile/approve': {
            view: '/static/views/m_approve.html',
            init: 'initMobileApprovePage',
            title: 'mobile_approve.page_title',
            icon: 'inbox'
        },
        '/mobile/audit_inventory': {
            view: '/static/views/m_audit_inventory.html',
            init: 'initMobileAuditInventoryPage',
            title: 'mobile_audit_inv.page_title',
            icon: 'inventory_2'
        },
        '/mobile/audit_asset': {
            view: '/static/views/m_audit_asset.html',
            init: 'initMobileAuditAssetPage',
            title: 'mobile_audit_asset.page_title',
            icon: 'fact_check'
        },
        '/mobile/upload': {
            view: '/static/views/m_upload.html',
            init: 'initMobileUploadPage',
            title: 'mobile_upload.header_title',
            icon: 'linked_camera'
        }
    };
    let navigationVersion = 0;
    let pageController = null;
    let destroyCurrentPage = null;

    function cleanupCurrentPage() {
        if (pageController) pageController.abort();
        if (destroyCurrentPage) destroyCurrentPage();
        destroyCurrentPage = null;
        window.onCurrentViewLanguageChange = null;
    }

    async function router() {
        const currentVersion = ++navigationVersion;
        cleanupCurrentPage();
        pageController = new AbortController();
        const pageSignal = pageController.signal;
        const viewContainer = document.getElementById('router-view');
        const loader = document.getElementById('mobileLoader');
        const route = mobileRoutes[window.location.pathname];

        window.setMobileMenuOpen(false);
        loader.hidden = false;
        viewContainer.replaceChildren();
        try {
            if (!route) {
                window.location.reload();
                return;
            }
            const pageTitle = document.getElementById('mobilePageTitle');
            pageTitle.dataset.i18n = route.title;
            pageTitle.textContent = window.t(route.title);
            document.getElementById('mobilePageIcon').textContent = route.icon;
            document.querySelectorAll('a[data-mobile-link]').forEach(link => {
                const isCurrentPage = link.pathname === window.location.pathname;
                link.classList.toggle('active', isCurrentPage);
                if (isCurrentPage) link.setAttribute('aria-current', 'page');
                else link.removeAttribute('aria-current');
            });
            const response = await fetch(route.view, { signal: pageSignal });
            if (!response.ok) throw new Error(window.t('mspa.requestError', 'Unable to load page'));
            const html = await response.text();
            if (currentVersion !== navigationVersion) return;

            viewContainer.innerHTML = html;
            window.renderI18n();
            // init 返回离页清理函数，负责移除该页面的事件和弹窗。
            destroyCurrentPage = window[route.init](viewContainer, pageSignal);
        } catch (error) {
            if (currentVersion !== navigationVersion || error.name === 'AbortError') return;
            const message = document.createElement('p');
            message.className = 'mobile-error';
            message.textContent = error.message;
            const retryButton = document.createElement('button');
            retryButton.textContent = window.t('mspa.retry', 'Retry');
            retryButton.onclick = router;
            viewContainer.replaceChildren(message, retryButton);
        } finally {
            if (currentVersion === navigationVersion) loader.hidden = true;
        }
    }

    document.addEventListener('click', function(e) {
        const link = e.target.closest('a[data-mobile-link]');
        if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (link.origin !== window.location.origin || !mobileRoutes[link.pathname]) return;
        e.preventDefault();
        if (window.location.pathname !== link.pathname) {
            history.pushState(null, '', link.href);
        }
        router();
    });
    window.addEventListener('popstate', router);
    window.addEventListener('pagehide', cleanupCurrentPage);
    window.addEventListener('pageshow', function(e) {
        if (e.persisted) router();
    });
    window.MobileAppRouter = router;
})();
