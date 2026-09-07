// static/js/router.js

// 🌟 1. 路由配置表：将 HTML视图、Init函数 和 专属CSS 绑定在一起
const routes = {
    '/backend':             { view: '/static/views/backend.html',           js: 'backend',          init: 'initAdminPage',          css: 'backend'          },
    '/asset_audit':         { view: '/static/views/asset_audit.html',       js: 'asset_audit',      init: 'initAssetAuditPage',     css: 'asset_audit'      },
    '/asset_history':       { view: '/static/views/asset_history.html',     js: 'asset_history',    init: 'initAssetHistoryPage',   css: 'asset_history'    },
    '/asset_scrap':         { view: '/static/views/asset_scrap.html',       js: 'asset_scrap',      init: 'initAssetScrapPage',     css: 'asset_scrap'      },
    '/asset_stock_in':      { view: '/static/views/asset_stock_in.html',    js: 'asset_stock_in',   init: 'initAssetStockPage',     css: 'asset_stock_in'   },
    '/asset':               { view: '/static/views/asset.html',             js: 'asset',            init: 'initAssetPage',          css: 'asset'            },
    '/audit':               { view: '/static/views/audit.html',             js: 'audit',            init: 'initAuditPage',          css: 'audit'            },
    '/history':             { view: '/static/views/history.html',           js: 'history',          init: 'initHistoryPage',        css: 'history'          },
    '/inventory_cards':     { view: '/static/views/inventory_cards.html',   js: 'inventory_cards',  init: 'initInventoryPage',      css: 'inventory_cards'  },
    '/inventory_table':     { view: '/static/views/inventory_table.html',   js: 'inventory_table',  init: 'initInventoryTablePage', css: 'inventory_table'  },
    '/request_log':         { view: '/static/views/request_log.html',       js: 'request_log',      init: 'initRequestLogPage',     css: 'request_log'      },
    '/request_queue':       { view: '/static/views/request_queue.html',     js: 'request_queue',    init: 'initRequestQueuePage',   css: 'request_queue'    },
    '/settings':            { view: '/static/views/settings.html',          js: 'settings',         init: 'initSettingsPage',       css: 'settings'         },
    '/simcard_history':     { view: '/static/views/simcard_history.html',   js: 'simcard_history',  init: 'initSimcardHistoryPage', css: 'simcard_history'  },
    '/simcard_stock_in':    { view: '/static/views/simcard_stock_in.html',  js: 'simcard_stock_in', init: 'initSimcardStockPage',   css: 'simcard_stock_in' },
    '/simcard':             { view: '/static/views/simcard.html',           js: 'simcard',          init: 'initSimcardPage',        css: 'simcard'          },
    '/stock_in':            { view: '/static/views/stock_in.html',          js: 'stock_in',         init: 'initStockPage',          css: 'stock_in'         },
    '/settings':            { view: '/static/views/settings.html',          js: 'settings',         init: 'initSettingsPage',       css: 'settings'         }
};

// 加载CSS
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

// 加载JS
function loadPageJS(jsFileName) {
    return new Promise((resolve, reject) => {
        if (!jsFileName) return resolve();
        if (document.querySelector(`script[data-route-js="${jsFileName}"]`)) return resolve();

        const script = document.createElement('script');
        script.src = `/static/js/${jsFileName}.js?t=${window.SYS_VER || new Date().getTime()}`;
        script.setAttribute('data-route-js', jsFileName);
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
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
        window.onCurrentViewLanguageChange = null;
        const [htmlResponse] = await Promise.all([
            fetch(route.view),
            loadPageJS(route.js)
        ]);
        if (!htmlResponse.ok) throw new Error("View not found");
        const htmlContent = await htmlResponse.text();

        // 注入 HTML 碎片
        viewContainer.innerHTML = htmlContent;

        // 触发国际化翻译
        if (typeof window.renderI18n === 'function') {
            window.renderI18n();
        }

        // 触发页面专属初始化函数
        if (route.init && typeof window[route.init] === 'function') {
            await window[route.init]();
        }

        // 更新侧边栏高亮状态
        updateSidebarActive(path);

    } catch (error) {
        viewContainer.innerHTML = '<div style="color:red; padding: 50px; text-align: center;">页面加载失败或模块开发中</div>';
        console.error("Router Load Error:", error);
    } finally {    
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