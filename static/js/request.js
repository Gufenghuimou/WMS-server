// Buffer finite API/view responses so the deadline includes reading the body.
(() => {
    const imports = new Set(['/import', '/import_asset', '/import_history_excel', '/asset_history/import']);
    window.requestErrorMessage = function(error) {
        const key = error?.name === 'TimeoutError' ? 'request.timeout'
            : error?.name === 'NetworkError' || error instanceof TypeError ? 'request.network' : null;
        if (!key) return error?.message || 'Request failed';
        const fallback = key === 'request.timeout'
            ? 'Request timed out. For a submitted operation, check its result before submitting again.'
            : 'Network connection failed. Please check your connection.';
        const translated = window.t?.(key);
        return translated && translated !== key ? translated : fallback;
    };
    window.requestErrorHtml = error => window.requestErrorMessage(error).replace(/[&<>"']/g,
        char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

    window.fetchWithTimeout = async function(input, options = {}) {
        const url = new URL(input instanceof Request ? input.url : input, window.location.href);
        const { timeoutMs = imports.has(url.pathname) ? 30000 : 15000, signal = input instanceof Request ? input.signal : undefined, ...rest } = options;
        const controller = new AbortController();
        const cancel = () => controller.abort(signal.reason);
        if (signal?.aborted) cancel();
        else signal?.addEventListener('abort', cancel, { once: true });
        const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs);
        try {
            const response = await fetch(input, { ...rest, signal: controller.signal });
            const body = await response.arrayBuffer();
            const buffered = new Response(response.body === null ? null : body, {
                status: response.status, statusText: response.statusText, headers: response.headers
            });
            for (const key of ['url', 'redirected', 'type']) {
                Object.defineProperty(buffered, key, { value: response[key] });
            }
            return buffered;
        } catch (error) {
            if (controller.signal.aborted) error = controller.signal.reason;
            if (error?.name === 'AbortError') throw error;
            const normalized = new Error(window.requestErrorMessage(error));
            normalized.name = error?.name === 'TimeoutError' ? 'TimeoutError' : error instanceof TypeError ? 'NetworkError' : error.name;
            throw normalized;
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', cancel);
        }
    };
})();
