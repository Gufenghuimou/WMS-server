// Mobile 路由：后续迁移新页面时，在 mobileRoutes 中增加配置。
(() => {
    const mobileRoutes = {
        '/mobile/approve': {
            view: '/static/views/m_approve.html',
            init: 'initMobileApprovePage'
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
            // 未迁移的 mobile 页面仍由后端返回完整 HTML。
            if (!route) {
                window.location.reload();
                return;
            }
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
