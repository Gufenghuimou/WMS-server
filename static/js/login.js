document.addEventListener('DOMContentLoaded', () => {
    const pwdInput = document.getElementById('loginPwd');
    const toggleIcon = document.getElementById('togglePwdIcon');
    const loginForm = document.getElementById('loginForm');
    const btn = document.getElementById('submitBtn');
    const card = document.getElementById('loginCard');
    const mask = document.getElementById('overlayMask');
    const errorBox = document.getElementById('errorBox');

    // 1. 密码显示/隐藏切换监听
    if (toggleIcon && pwdInput) {
        toggleIcon.addEventListener('click', function(e) {
            if (pwdInput.type === 'password') {
                pwdInput.type = 'text';
                e.target.innerText = 'visibility_off';
            } else {
                pwdInput.type = 'password';
                e.target.innerText = 'visibility';
            }
        });
    }

    // 2. 表单拦截与 Ajax 提交
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            btn.disabled = true;
            btn.innerHTML = '<i class="material-icons" style="animation: spin 1s linear infinite; font-size: 1.4rem;">autorenew</i> 验证中...';
            errorBox.style.display = 'none';
            card.classList.remove('shake-animation');

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    body: new FormData(loginForm),
                    redirect: 'follow',
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                const text = await response.text();
                const regex = /<div class="error-msg"[^>]*id="errorBox"[^>]*>(.*?)<\/div>/s;
                const match = text.match(regex);

                if (match && match[1].trim() !== "") {
                    errorBox.innerText = match[1];
                    errorBox.style.display = 'block';
                    card.classList.remove('shake-animation');
                    void card.offsetWidth;
                    card.classList.add('shake-animation');
                } else if (text.includes('error-msg') || response.url.includes('/login')) {
                    // ❌ 登录失败
                    let errorText = "Wrong username or password, please try again.";
                    const match = text.match(/<div class="error-msg"[^>]*>(.*?)<\/div>/);
                    if (match && match[1]) errorText = match[1];

                    errorBox.innerText = errorText;
                    errorBox.style.display = 'block';

                    void card.offsetWidth;
                    card.classList.add('shake-animation');

                    btn.disabled = false;
                    btn.innerHTML = 'LOGIN';
                } else {
                    // ✅ 登录成功
                    btn.innerHTML = '<i class="material-icons" style="font-size: 1.4rem;">check_circle</i> 验证通过';
                    btn.style.background = '#1db954';

                    setTimeout(() => {
                        mask.classList.add('login-success');
                        setTimeout(() => {
                            window.location.href = response.url;
                        }, 1500);
                    }, 500);
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    errorBox.innerText = 'Request timeout. Check server connection.';
                } else {
                    errorBox.innerText = "Network error. Check server connection.";
                }
                errorBox.style.display = 'block';
                card.classList.add('shake-animation');
            } finally {
                clearTimeout(timeoutId);
                btn.disabled = false;
                btn.innerHTML = 'LOGIN';
            }
        });
    }
});