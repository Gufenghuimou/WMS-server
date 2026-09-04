// static/js/router.js

// 🌟 1. 路由配置表：将 HTML视图、Init函数 和 专属CSS 绑定在一起
const routes = {
    '/backend': { view: '/static/views/admin.html', init: window.initAdminPage, css: 'admin' },
    '/asset_audit': { view: '/static/views/asset_audit.html', init: window.initAssetAuditPage, css: 'asset_audit' },
    '/asset_history': { view: '/static/views/asset_history.html', init: window.initAssetHistoryPage, css: 'asset_history' },
    '/asset_scrap': { view: '/static/views/asset_scrap.html', init: window.initAssetScrapPage, css: 'asset_scrap' },
    '/asset_stock_in': { view: '/static/views/asset_stock_in.html', init: window.initAssetStockPage, css: 'asset_stock_in' },
    '/asset': { view: '/static/views/asset.html', init: window.initAssetPage, css: 'asset' },
    '/audit': { view: '/static/views/audit.html', init: window.initAuditPage, css: 'audit' },
    '/history': { view: '/static/views/history.html', init: window.initHistoryPage, css: 'history' },
    '/all': { view: '/static/views/inventory_cards.html', init: window.initInventoryPage, css: 'inventory_card' },
    '/inventory_table': { view: '/static/views/inventory_table.html', init: window.initInventoryTablePage, css: 'inventory_table' },
    '/request_log': { view: '/static/views/request_log.html', init: window.initRequestLogPage, css: 'request_log' },
    '/request_queue': { view: '/static/views/request_queue.html', init: window.initRequestQueuePage, css: 'request_queue' },
    '/settings': { view: '/static/views/settings.html', init: window.initSettingsPage, css: 'settings' },
    '/simcard_history': { view: '/static/views/simcard_history.html', init: window.initSimcardHistoryPage, css: 'simcard_history' },
    '/simcard_stock_in': { view: '/static/views/simcard_stock_in.html', init: window.initSimcardStockPage, css: 'simcard_stock_in' },
    '/simcard': { view: '/static/views/simcard.html', init: window.initSimcardPage, css: 'simcard' },
    '/stock_in': { view: '/static/views/stock_in.html', init: window.initStockPage, css: 'stock_in' },
    '/settings': { view: '/static/views/settings.html', init: window.initSettingsPage, css: 'settings' }
};

// 🌟 2. 动态 CSS 加载引擎
function loadPageCSS(cssFileName) {
    // a. 查找并卸载上一页的动态 CSS（物理隔离，消除污染）
    document.querySelectorAll('link[data-dynamic-css]').forEach(el => el.remove());

    // b. 加载当前页的新 CSS
    if (cssFileName) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        // 加上时间戳或系统版本号防止缓存
        link.href = `/static/css/${cssFileName}.css?t=${window.SYS_VER || new Date().getTime()}`;
        link.setAttribute('data-dynamic-css', 'true'); // 打上标记，方便下次清理
        document.head.appendChild(link);
    }
}

// 核心路由控制器
const router = async () => {
    const path = window.location.pathname;
    const route = routes[path] || routes['/'];

    const topActionsContainer = document.querySelector('.top-actions');
    if (topActionsContainer) {
        topActionsContainer.innerHTML = ``;
    }
    // 唤醒全局 Loader 动画
    const loader = document.getElementById('global-page-loader');
    if (loader) {
        loader.style.display = 'flex';
        loader.classList.remove('hidden');
    }

    const viewContainer = document.getElementById('router-view');
    
    if (viewContainer) {
        viewContainer.innerHTML = ``;
    }
    // 在请求 HTML 的同时，并行触发 CSS 加载
    loadPageCSS(route.css);

    try {
        const htmlResponse = await fetch(route.view);
        if (!htmlResponse.ok) throw new Error("View not found");
        const htmlContent = await htmlResponse.text();

        // 注入 HTML 碎片
        viewContainer.innerHTML = htmlContent;

        // 触发国际化翻译
        if (typeof window.renderI18n === 'function') {
            window.renderI18n();
        }

        // 触发页面专属初始化函数
        if (typeof route.init === 'function') {
            await route.init();
        }

        // 更新侧边栏高亮状态
        updateSidebarActive(path);

    } catch (error) {
        viewContainer.innerHTML = '<div style="color:red; padding: 50px; text-align: center;">页面加载失败或模块开发中</div>';
        console.error("Router Load Error:", error);
    } finally {    
        // 即使出错也要把 Loader 关掉，防止死锁
        if (typeof window.hideGlobalLoader === 'function') {
            window.hideGlobalLoader();
        }
    }
};

// 🌟 4. 全局 A 标签拦截 (SPA 拦截器)
document.body.addEventListener('click', e => {
    const target = e.target.closest("[data-link]");
    if (target) {
        e.preventDefault(); // 阻止浏览器原生跳转
        const href = target.getAttribute("href");
        
        // 如果点击的是当前页面，不重复拉取
        if (window.location.pathname !== href) {
            history.pushState(null, null, href);
            router();
        }
    }
});

// 🌟 5. 监听浏览器前进/后退按钮
window.addEventListener("popstate", router);

// 🌟 6. 侧边栏高亮状态更新
function updateSidebarActive(currentPath) {
    document.querySelectorAll('.sidebar .nav-item').forEach(el => {
        el.classList.remove('active');
        if (el.getAttribute('href') === currentPath) {
            el.classList.add('active');
        }
    });
}

// 暴露 router 供 initApplication 首屏调度使用
window.AppRouter = router;