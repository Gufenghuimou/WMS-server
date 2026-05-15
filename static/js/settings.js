// ==========================================
// 实时预览头像
// ==========================================
window.previewUserAvatar = function(input) {
    if (input.files && input.files[0]) {
        let reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('setAvatarPreview').src = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
};

// ==========================================
// 设置表单提交处理
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const settingsForm = document.getElementById('settingsForm');

    if (settingsForm) {
        settingsForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            let formData = new FormData(this);
            let msgBox = document.getElementById('settingsMsgBox');
            let btn = document.getElementById('submitBtn');
            let originalBtnText = btn.innerHTML;

            // 按钮进入加载状态
            btn.disabled = true;
            btn.innerHTML = `<i class="material-icons" style="font-size: 1.2rem; animation: spin 1s linear infinite;">autorenew</i> ${SETTINGS_I18N.saving}`;
            msgBox.style.display = 'none';
            msgBox.className = 'settings-msg';

            try {
                let response = await fetch('/user/update_settings', {
                    method: 'POST',
                    body: formData
                });

                let data = await response.json();

                if (data.status === 'error') {
                    // ❌ 失败处理 (带震动动画)
                    msgBox.innerText = data.message;
                    msgBox.classList.add('msg-error');
                    msgBox.style.display = 'block';
                    btn.disabled = false;
                    btn.innerHTML = originalBtnText;

                    msgBox.style.transform = "translateX(-5px)";
                    setTimeout(() => msgBox.style.transform = "translateX(5px)", 100);
                    setTimeout(() => msgBox.style.transform = "translateX(0)", 200);

                } else if (data.status === 'success') {
                    // ✅ 成功处理
                    msgBox.innerText = data.message;
                    msgBox.classList.add('msg-success');
                    msgBox.style.display = 'block';
                    btn.innerHTML = `<i class="material-icons" style="font-size: 1.2rem;">check_circle</i> ${SETTINGS_I18N.save_success}`;
                    btn.style.background = '#1db954'; // 变绿

                    // 延时刷新或跳回登录页(如果改了密码)
                    setTimeout(() => {
                        if (data.action === 'logout') {
                            window.location.href = '/login';
                        } else {
                            window.location.reload();
                        }
                    }, 1500);
                }
            } catch (error) {
                console.error(error);
                msgBox.innerText = SETTINGS_I18N.network_error;
                msgBox.classList.add('msg-error');
                msgBox.style.display = 'block';
                btn.disabled = false;
                btn.innerHTML = originalBtnText;
            }
        });
    }
});