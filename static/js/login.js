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

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    body: new FormData(loginForm),
                    redirect: 'follow'
                });

                const text = await response.text();

                if (text.includes('error-msg') || response.url.includes('/login')) {
                    // ❌ 登录失败
                    let errorText = "账号或密码错误，请重试";
                    const match = text.match(/<div class="error-msg"[^>]*>(.*?)<\/div>/);
                    if (match && match[1]) errorText = match[1];

                    errorBox.innerText = errorText;
                    errorBox.style.display = 'block';

                    void card.offsetWidth; // 触发重绘以重新播放动画
                    card.classList.add('shake-animation');

                    btn.disabled = false;
                    btn.innerHTML = '登 录 系 统';
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
                errorBox.innerText = "网络请求失败，请检查服务器连接";
                errorBox.style.display = 'block';
                card.classList.add('shake-animation');
                btn.disabled = false;
                btn.innerHTML = '登 录 系 统';
            }
        });
    }
});