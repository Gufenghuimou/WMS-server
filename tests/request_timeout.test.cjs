const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function env(fetchImpl) {
    const pending = new Set(), deadlines = [];
    const context = vm.createContext({
        Request, Response, URL, AbortController, DOMException, Error, TypeError, console,
        fetch: fetchImpl,
        setTimeout(fn, ms) { deadlines.push(ms); const id = setTimeout(fn, ms); pending.add(id); return id; },
        clearTimeout(id) { pending.delete(id); clearTimeout(id); },
        location: { href: 'https://wms.test/inventory_cards', assign() {} },
        document: { addEventListener() {}, querySelector() { return null; }, head: { appendChild() {} }, createElement() { return { setAttribute() {} }; } }
    });
    context.window = context;
    function run(file) { vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context); }
    run('static/js/request.js');
    return { context, pending, deadlines, run };
}
const stall = (_, { signal }) => new Promise((resolve, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
});

test('ordinary/import deadlines, response compatibility and cleanup', async () => {
    const e = env(async () => new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } }));
    for (const url of ['/api/layout', '/import', '/import_asset', '/import_history_excel', '/asset_history/import']) {
        const response = await e.context.fetchWithTimeout(url);
        assert.equal(response.ok, true);
        assert.deepEqual(await response.json(), { ok: true });
    }
    assert.deepEqual(e.deadlines, [15000, 30000, 30000, 30000, 30000]);
    assert.equal(e.pending.size, 0);
});
test('timeout aborts request and remains distinct from navigation cancellation', async () => {
    const e = env(stall);
    await assert.rejects(e.context.fetchWithTimeout('/api/layout', { timeoutMs: 10 }), { name: 'TimeoutError' });
    const controller = new AbortController();
    const promise = e.context.fetchWithTimeout('/api/layout', { signal: controller.signal });
    controller.abort();
    await assert.rejects(promise, { name: 'AbortError' });
    await assert.rejects(e.context.fetchWithTimeout('/api/layout', { signal: controller.signal }), { name: 'AbortError' });
    assert.equal(e.pending.size, 0);
});
test('deadline includes a stalled body after response headers arrive', async () => {
    const e = env(async (_, { signal }) => ({ arrayBuffer: () => stall(null, { signal }) }));
    await assert.rejects(e.context.fetchWithTimeout('/api/layout', { timeoutMs: 10 }), { name: 'TimeoutError' });
    assert.equal(e.pending.size, 0);
});
test('network error, localization and HTML escaping', async () => {
    const e = env(async () => { throw new TypeError('Failed to fetch'); });
    await assert.rejects(e.context.fetchWithTimeout('/api/layout'), { name: 'NetworkError' });
    e.context.t = key => key === 'request.timeout' ? 'timeout translation' : key;
    assert.equal(e.context.requestErrorMessage({ name: 'TimeoutError' }), 'timeout translation');
    assert.equal(e.context.requestErrorHtml({ message: '<script>' }), '&lt;script&gt;');
    assert.equal(e.pending.size, 0);
});
test('PC 401 redirect and mobile timeout use the shared boundary', async () => {
    const e = env(async () => new Response('{}', { status: 401 }));
    let destination;
    e.context.location.assign = url => { destination = url; };
    e.run('static/js/api.js');
    await assert.rejects(e.context.apiFetch('/api/layout'));
    assert.equal(destination, '/login');
    const mobile = env(stall);
    mobile.run('static/js/m_index.js');
    await assert.rejects(mobile.context.requestMobileJson('/api/mobile/context', { timeoutMs: 10 }), { name: 'TimeoutError' });
});
test('script download timeout never executes source, clears cache and allows retry', async () => {
    const e = env(stall);
    e.run('static/js/api.js');
    const original = e.context.apiFetch;
    e.context.apiFetch = url => original(url, { timeoutMs: 10 });
    const source = fs.readFileSync(path.join(root, 'static/js/router.js'), 'utf8');
    vm.runInContext(source.slice(0, source.indexOf('let navigationId')), e.context);
    let executed = 0;
    e.context.document.head.appendChild = () => { executed++; };
    await assert.rejects(e.context.loadPageJS('asset'), { name: 'TimeoutError' });
    assert.equal(executed, 0);
    e.context.fetch = async () => new Response('window.loaded = true;');
    await e.context.loadPageJS('asset');
    assert.equal(executed, 1);
    await e.context.loadPageJS('asset');
    assert.equal(executed, 1);
    assert.equal(e.pending.size, 0);
});
