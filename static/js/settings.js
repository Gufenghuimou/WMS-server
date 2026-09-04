// static/js/settings.js

(() => {

    // ==========================================
    // 1. 页面初始化入口
    // ==========================================
    window.initSettingsPage = async function() {
        const user = window.CURRENT_USER;
        if (!user) {
            console.error("User context missing.");
            return;
        }

        // 🌟 将全局存储的 User 数据回填到前端输入框
        const usernameInput = document.getElementById('settingsUsername');
        const fullNameInput = document.getElementById('settingsFullName');
        const avatarPreview = document.getElementById('setAvatarPreview');

        if (usernameInput) usernameInput.value = user.username;
        if (fullNameInput) fullNameInput.value = user.full_name || '';

        // 🌟 动态加载头像，利用系统版本号防止浏览器缓存导致换头像不生效
        if (avatarPreview) {
            const cacheBuster = window.SYS_VER || new Date().getTime();
            avatarPreview.src = `/static/avatars/${user.username}.jpg?t=${cacheBuster}`;
            avatarPreview.style.display = 'block';
        }

        // 绑定事件
        bindSettingsEvents();
    };

    // ==========================================
    // 2. 表单与交互事件绑定
    // ==========================================
    function bindSettingsEvents() {
        const avatarInput = document.getElementById('avatarInput');
        const btnUploadAvatar = document.getElementById('btnUploadAvatar');
        const settingsForm = document.getElementById('settingsForm');

        // 点击按钮触发隐藏的 file input
        if (btnUploadAvatar && avatarInput) {
            btnUploadAvatar.onclick = () => avatarInput.click();
        }

        // 实时预览头像逻辑
        if (avatarInput) {
            avatarInput.onchange = function(e) {
                if (this.files && this.files[0]) {
                    let reader = new FileReader();
                    reader.onload = function(e) {
                        const preview = document.getElementById('setAvatarPreview');
                        if (preview) {
                            preview.src = e.target.result;
                            preview.style.display = 'block';
                            // 隐藏兜底的 icon
                            if(preview.nextElementSibling) preview.nextElementSibling.style.display = 'none';
                        }
                    }
                    reader.readAsDataURL(this.files[0]);
                }
            };
        }

        // 表单 Ajax 提交逻辑
        if (settingsForm) {
            settingsForm.onsubmit = async function(e) {
                e.preventDefault();

                let formData = new FormData(this);
                let msgBox = document.getElementById('settingsMsgBox');
                let btn = document.getElementById('submitBtn');
                
                // 缓存按钮内部的文本，保留 i18n 的 span
                let originalBtnHTML = btn.innerHTML; 

                // 按钮进入加载状态
                btn.disabled = true;
                btn.innerHTML = `<i class="material-icons" style="font-size: 1.2rem; animation: spin 1s linear infinite;">autorenew</i> ${t('settings.saving') || 'Saving...'}`;
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
                        btn.innerHTML = originalBtnHTML;

                        msgBox.style.transform = "translateX(-5px)";
                        setTimeout(() => msgBox.style.transform = "translateX(5px)", 100);
                        setTimeout(() => msgBox.style.transform = "translateX(0)", 200);

                    } else if (data.status === 'success') {
                        // ✅ 成功处理
                        msgBox.innerText = data.message;
                        msgBox.classList.add('msg-success');
                        msgBox.style.display = 'block';
                        btn.innerHTML = `<i class="material-icons" style="font-size: 1.2rem;">check_circle</i> ${t('settings.save_success') || 'Success'}`;
                        btn.style.background = '#1db954'; // 变绿

                        // 延时刷新或跳回登录页 (因为修改了密码或资料，reload 能顺便刷新 base.js 获取新数据)
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
                    msgBox.innerText = t('settings.network_error') || 'Network Error';
                    msgBox.classList.add('msg-error');
                    msgBox.style.display = 'block';
                    btn.disabled = false;
                    btn.innerHTML = originalBtnHTML;
                }
            };
        }
    }

})();