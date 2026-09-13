(() => {
    document.addEventListener('DOMContentLoaded', () => {
        const loginForm = document.getElementById('loginForm');
        if (!loginForm) return;

        const pwdInput = document.getElementById('loginPwd');
        const toggleIcon = document.getElementById('togglePwdIcon');
        const btn = document.getElementById('submitBtn');
        const card = document.getElementById('loginCard');
        const mask = document.getElementById('overlayMask');
        const errorBox = document.getElementById('errorBox');
        const originalButtonText = btn.innerHTML;
        let isSubmitting = false;
        let language = navigator.language.split('-')[0];
        try {
            language = localStorage.getItem('userLang') || language;
        } catch (error) {
            console.warn('Unable to read language preference', error);
        }
        if (!['zh', 'en', 'ja', 'vi'].includes(language)) language = 'en';
        document.documentElement.lang = language;

        const languageController = new AbortController();
        const languageTimeout = setTimeout(() => languageController.abort(), 5000);
        fetch(`/static/locales/${language}.json`, { signal: languageController.signal })
            .then(response => {
                if (!response.ok) throw new Error('Unable to load language');
                return response.json();
            })
            .then(data => {
                document.title = `${data.title.login} - ${data.title.base}`;
            })
            .catch(error => console.warn('Login language unavailable', error))
            .finally(() => clearTimeout(languageTimeout));

        toggleIcon.onclick = function() {
            const showPassword = pwdInput.type === 'password';
            pwdInput.type = showPassword ? 'text' : 'password';
            toggleIcon.textContent = showPassword ? 'visibility_off' : 'visibility';
        };

        loginForm.onsubmit = async function(e) {
            e.preventDefault();
            if (isSubmitting) return;
            isSubmitting = true;
            let loginSucceeded = false;
            btn.disabled = true;
            btn.textContent = 'Verifying...';
            errorBox.style.display = 'none';
            card.classList.remove('shake-animation');

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            try {
                const formData = new FormData(loginForm);
                formData.set('language', language);
                const response = await fetch('/login', {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' },
                    signal: controller.signal
                });
                if (!(response.headers.get('content-type') || '').includes('application/json')) {
                    throw new Error('Unexpected server response. Please try again.');
                }
                const result = await response.json();
                if (!response.ok || result.status !== 'success') {
                    throw new Error(result.message || 'Unable to sign in. Please try again.');
                }
                const destination = new URL(result.redirect_url || '/', window.location.origin);
                if (destination.origin !== window.location.origin) throw new Error('Invalid login destination');

                loginSucceeded = true;
                btn.textContent = 'Verified';
                btn.style.background = '#1db954';
                setTimeout(() => {
                    mask.classList.add('login-success');
                    setTimeout(() => window.location.assign(destination.href), 1500);
                }, 500);
            } catch (error) {
                errorBox.textContent = error.name === 'AbortError'
                    ? 'Request timeout. Check server connection.'
                    : error instanceof TypeError
                        ? 'Network error. Check server connection.'
                        : error.message || 'Unable to sign in. Please try again.';
                errorBox.style.display = 'block';
                void card.offsetWidth;
                card.classList.add('shake-animation');
            } finally {
                clearTimeout(timeoutId);
                if (!loginSucceeded) {
                    isSubmitting = false;
                    btn.disabled = false;
                    btn.innerHTML = originalButtonText;
                }
            }
        };
    });
})();
