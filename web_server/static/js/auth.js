// static/js/auth.js
import { Toast } from './ui.js';

export function initAuth() {
    const btnBukaModalAuth = document.getElementById('btnBukaModalAuth'); 
    const modalAuth = document.getElementById('modalAuth');
    const btnTutupAuthModal = document.getElementById('btnTutupAuthModal');

    if (btnBukaModalAuth && modalAuth) {
        const tabLogin = document.getElementById('tabLogin');
        const tabRegister = document.getElementById('tabRegister');
        const loginFormUI = document.getElementById('loginForm');
        const registerFormUI = document.getElementById('registerForm');

        btnBukaModalAuth.addEventListener('click', () => modalAuth.classList.add('active'));
        if(btnTutupAuthModal) btnTutupAuthModal.addEventListener('click', () => modalAuth.classList.remove('active'));

        if(tabLogin && tabRegister) {
            tabLogin.addEventListener('click', () => {
                tabLogin.classList.add('active'); tabRegister.classList.remove('active');
                tabLogin.style.color = 'var(--text-dark)'; tabLogin.style.borderBottom = '3px solid var(--text-dark)';
                tabRegister.style.color = 'var(--text-muted)'; tabRegister.style.borderBottom = '3px solid transparent';
                loginFormUI.style.display = 'block'; registerFormUI.style.display = 'none';
            });
            tabRegister.addEventListener('click', () => {
                tabRegister.classList.add('active'); tabLogin.classList.remove('active');
                tabRegister.style.color = 'var(--text-dark)'; tabRegister.style.borderBottom = '3px solid var(--text-dark)';
                tabLogin.style.color = 'var(--text-muted)'; tabLogin.style.borderBottom = '3px solid transparent';
                registerFormUI.style.display = 'block'; loginFormUI.style.display = 'none';
            });
        }

        if(loginFormUI) {
            loginFormUI.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('btnLoginBtn');
                btn.textContent = 'Memuat...';
                try {
                    const res = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            username: document.getElementById('logUser').value, 
                            password: document.getElementById('logPass').value 
                        })
                    });
                    const data = await res.json();
                    if (data.status === 'success') {
                        Toast.fire({ icon: 'success', title: 'Berhasil Login!' });
                        setTimeout(() => { window.location.reload(); }, 1000); 
                    } else { 
                        Swal.fire({ icon: 'error', title: 'Login Gagal', text: data.message, confirmButtonColor: '#E11D48' });
                        btn.textContent = 'Otorisasi & Masuk'; 
                    }
                } catch (err) { 
                    Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal terhubung ke server', confirmButtonColor: '#E11D48' });
                    btn.textContent = 'Otorisasi & Masuk'; 
                }
            });
        }

        if(registerFormUI) {
            registerFormUI.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('btnRegBtn');
                btn.textContent = 'Mendaftarkan...';
                try {
                    const res = await fetch('/api/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            username: document.getElementById('regUser').value, 
                            password: document.getElementById('regPass').value 
                        })
                    });
                    const data = await res.json();
                    if (data.status === 'success') {
                        Swal.fire({ icon: 'success', title: 'Berhasil', text: data.message, confirmButtonColor: '#10B981' });
                        tabLogin.click(); 
                    } else {
                        Swal.fire({ icon: 'error', title: 'Pendaftaran Gagal', text: data.message, confirmButtonColor: '#E11D48' });
                    }
                    btn.textContent = 'Buat Kredensial Baru';
                } catch (err) { 
                    Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal terhubung ke server', confirmButtonColor: '#E11D48' });
                    btn.textContent = 'Buat Kredensial Baru'; 
                }
            });
        }
    }
}

export function initLogout() {
    const btnLogoutBtn = document.getElementById('btnLogoutBtn');
    if (btnLogoutBtn) {
        btnLogoutBtn.addEventListener('click', async () => {
            Swal.fire({
                title: 'Akhiri Sesi?',
                text: "Video akan dimatikan dan Anda akan keluar.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#E11D48',
                cancelButtonColor: '#475569',
                confirmButtonText: 'Ya, Logout',
                cancelButtonText: 'Batal'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    await fetch('/api/logout', { method: 'POST' });
                    window.location.reload(); 
                }
            });
        });
    }
}