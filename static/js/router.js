// static/js/router.js

const routes = {
    '/': { view: '/static/views/all.html', init: null },
    '/asset': { view: '/static/views/asset.html', init: window.initAssetPage },
}

const router = async () => {
    const path = window.location.pathname;
    const route = routes[path] || routes['/']

    const viewContainer = document.getElementById('router-view');
    viewContainer.innerHTML = '<div style="text-align:center; padding: 50px;">加载中...</div>';

    try {
        const htmlResponse = await fetch(route.view);
        if (!htmlResponse.ok) throw new Error("View not found");
        const htmlContent = await htmlResponse.text();

        viewContainer.innerHTML = htmlContent;

        if (route.init === 'function') {
            await route.init();
        }

        updateSidebarActive(path);
    } catch (error) {
        viewContainer.innerHTML = '<div style="color:red; padding: 20px;">页面加载失败或开发中</div>';
        console.error(error);
    }
};

document.body.addEventListener('click', e => {
    const target = e.target.closest("[data-link]");
    if (target) {
        e.preventDefault();
        const href = target.getAttribute("href");
        history.pushState(null, null, href);
        router();
    }
});

window.addEventListener("popstate", router);

function updateSidebarActive(currentPath) {
    document.querySelectorAll('.sidebar .nav-item').forEach(el => {
        el.classList.remove('active');
        if (el.getAttribute('href') === currentPath) {
            el.classList.add('active');
        }
    });
}

window.AppRouter = router;