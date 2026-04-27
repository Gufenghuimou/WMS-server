// 实时预览头像（挂载至 window 供 HTML 内联调用）
window.previewUserAvatar = function(input) {
    if (input.files && input.files[0]) {
        let reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('setAvatarPreview').src = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const settingsForm = document.getElementById('settingsForm');

    if (settingsForm) {
        // 异步拦截提交
        settingsForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            let formData = new FormData(this);
            let msgBox = document.getElementById('settingsMsgBox');
            let btn = document.getElementById('submitBtn');
            let originalBtnText = btn.innerHTML;

            btn.disabled = true;
            btn.innerHTML = '<i class="material-icons" style="font-size: 1.2rem; animation: spin 1s linear infinite;">autorenew</i> ${SETTINGS_I18N.saving}';
            msgBox.style.display = 'none';
            msgBox.className = 'settings-msg';

            try {
                let response = await fetch('/user/update_settings', {
                    method: 'POST',
                    body: formData
                });

                let data = await response.json();

                msgBox.innerText = data.message;
                msgBox.style.display = 'block';

                if (data.status === 'error') {
                    msgBox.classList.add('msg-error');
                    btn.disabled = false;
                    btn.innerHTML = originalBtnText;

                    msgBox.style.transform = "translateX(-5px)";
                    setTimeout(() => msgBox.style.transform = "translateX(5px)", 100);
                    setTimeout(() => msgBox.style.transform = "translateX(0)", 200);

                } else if (data.status === 'success') {
                    msgBox.classList.add('msg-success');
                    btn.innerHTML = '<i class="material-icons" style="font-size: 1.2rem;">check_circle</i>${SETTINGS_I18N.save_success}';
                    btn.style.background = '#1db954';

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