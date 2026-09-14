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

        window.fetchWithTimeout(`/static/locales/${language}.json`)
            .then(response => {
                if (!response.ok) throw new Error('Unable to load language');
                return response.json();
            })
            .then(data => {
                document.title = `${data.title.login} - ${data.title.base}`;
            })
            .catch(error => console.warn('Login language unavailable', window.requestErrorMessage(error)));

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

            try {
                const formData = new FormData(loginForm);
                formData.set('language', language);
                const response = await window.fetchWithTimeout('/login', {
                    method: 'POST',
                    body: formData,
                    headers: { 'Accept': 'application/json' }
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
                errorBox.textContent = window.requestErrorMessage(error);
                errorBox.style.display = 'block';
                void card.offsetWidth;
                card.classList.add('shake-animation');
            } finally {
                if (!loginSucceeded) {
                    isSubmitting = false;
                    btn.disabled = false;
                    btn.innerHTML = originalButtonText;
                }
            }
        };
    });
})();
