// Shared PC request boundary. Mobile pages use mobileApi in m_index.js.
window.apiFetch = async function(input, options) {
    const response = await window.fetchWithTimeout(input, options);
    if (response.status === 401) {
        window.location.assign('/login');
        throw new Error('Session expired. Please login.');
    }
    return response;
};

// These forms used to navigate to the redirect returned by the server.
document.addEventListener('submit', async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const path = new URL(form.action).pathname;
    if (!/^\/(delete\/\d+|simcard_delete\/\d+|asset_scrap)$/.test(path)) return;
    event.preventDefault();
    if (form.dataset.submitting) return;
    form.dataset.submitting = 'true';
    const buttons = [...form.querySelectorAll('button[type="submit"]')];
    buttons.forEach(button => { button.disabled = true; });
    try {
        const response = await window.apiFetch(form.action, { method: 'POST', body: new FormData(form) });
        const result = await response.json();
        if (!response.ok || result.status !== 'success') {
            throw new Error(result.message || result.detail || 'Operation failed');
        }
        window.closeScrapModal?.();
        await window.AppRouter();
    } catch (error) {
        if (error.name === 'AbortError') return;
        window.closeScrapModal?.();
        await window.openAlertModal(window.requestErrorMessage(error));
    } finally {
        delete form.dataset.submitting;
        buttons.forEach(button => { button.disabled = false; });
    }
});
