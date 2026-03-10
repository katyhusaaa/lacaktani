// static/js/auth.js
// static/js/auth.js
import { Toast } from './ui.js';

export function initAuth() {
    const btnBukaModalAuth = document.getElementById('btnBukaModalAuth'); 
    const modalAuth = document.getElementById('modalAuth');
    const btnTutupAuthModal = document.getElementById('btnTutupAuthModal');

    if (btnBukaModalAuth && modalAuth) {
        const tabLogin = document.getElementById('tabLogin');
        const tabRegister = document.getElementById('tabRegister');
        const authTabs = document.getElementById('authTabs'); // Pembungkus tab

        const loginFormUI = document.getElementById('loginForm');
        const registerFormUI = document.getElementById('registerForm');
        const lupaAkunFormUI = document.getElementById('lupaAkunForm'); // Form baru

        const btnTampilkanLupaAkun = document.getElementById('btnTampilkanLupaAkun');
        const btnKembaliKeLogin = document.getElementById('btnKembaliKeLogin');

        btnBukaModalAuth.addEventListener('click', () => modalAuth.classList.add('active'));
        if(btnTutupAuthModal) btnTutupAuthModal.addEventListener('click', () => modalAuth.classList.remove('active'));

        // LOGIC PINDAH TAB (Login/Register)
        if(tabLogin && tabRegister) {
            tabLogin.addEventListener('click', () => {
                tabLogin.classList.add('active'); tabRegister.classList.remove('active');
                loginFormUI.style.display = 'block'; 
                registerFormUI.style.display = 'none';
                lupaAkunFormUI.style.display = 'none'; // Sembunyikan lupa akun
            });
            tabRegister.addEventListener('click', () => {
                tabRegister.classList.add('active'); tabLogin.classList.remove('active');
                registerFormUI.style.display = 'block'; 
                loginFormUI.style.display = 'none';
                lupaAkunFormUI.style.display = 'none'; // Sembunyikan lupa akun
            });
        }

        // LOGIC MUNCULIN FORM LUPA AKUN
        if (btnTampilkanLupaAkun) {
            btnTampilkanLupaAkun.addEventListener('click', (e) => {
                e.preventDefault();
                loginFormUI.style.display = 'none';
                registerFormUI.style.display = 'none';
                authTabs.style.display = 'none'; // Hilangkan tombol tab atas
                lupaAkunFormUI.style.display = 'block';
            });
        }

        // LOGIC KEMBALI DARI LUPA AKUN KE LOGIN
        if (btnKembaliKeLogin) {
            btnKembaliKeLogin.addEventListener('click', (e) => {
                e.preventDefault();
                lupaAkunFormUI.style.display = 'none';
                authTabs.style.display = 'flex'; // Munculkan lagi tab atas
                tabLogin.click(); // Trigger klik tab login
            });
        }

        // ===================================
        // SUBMIT LOGIN FORM
        // ===================================
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
                        btn.textContent = 'Masuk ke Workspace'; 
                    }
                } catch (err) { 
                    Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal terhubung ke server', confirmButtonColor: '#E11D48' });
                    btn.textContent = 'Masuk ke Workspace'; 
                }
            });
        }

        // ===================================
        // SUBMIT REGISTER FORM
        // ===================================
        if(registerFormUI) {
            registerFormUI.addEventListener('submit', async (e) => {
                // ... (Kode register lo biarin utuh kayak sebelumnya) ...
                e.preventDefault();
                const btn = document.getElementById('btnRegBtn');
                btn.textContent = 'Mendaftarkan...';
                try {
                    const res = await fetch('/api/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            nama_lengkap: document.getElementById('regNama').value, 
                            email: document.getElementById('regEmail').value,       
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
                    btn.textContent = 'Daftar Sekarang';
                } catch (err) { 
                    Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal terhubung ke server', confirmButtonColor: '#E11D48' });
                    btn.textContent = 'Daftar Sekarang'; 
                }
            });
        }

        // ===================================
        // SUBMIT FORM LUPA AKUN (API BARU)
        // ===================================
        if(lupaAkunFormUI) {
            lupaAkunFormUI.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('btnKirimRecovery');
                const originalText = btn.textContent;
                btn.textContent = 'Memeriksa Data...';
                
                try {
                    const res = await fetch('/api/recovery', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: document.getElementById('recoveryEmail').value })
                    });
                    const data = await res.json();
                    
                    if (data.status === 'success') {
                        Swal.fire({ icon: 'success', title: 'Terkirim!', text: data.message, confirmButtonColor: '#10B981' });
                        lupaAkunFormUI.reset();
                        btnKembaliKeLogin.click(); // Balikin tampilannya ke layar Login
                    } else {
                        Swal.fire({ icon: 'error', title: 'Gagal', text: data.message, confirmButtonColor: '#E11D48' });
                    }
                } catch (err) {
                    Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal menghubungi server.', confirmButtonColor: '#E11D48' });
                } finally {
                    btn.textContent = originalText;
                }
            });
        }
    }
}

// LOGIC TOMBOL LOGOUT (Di file HTML)
// Tidak perlu ada fungsi initLogout() di sini karena sudah dipindah ke dashboard.html

export function initLogout() {
    console.log("Fungsi initLogout formalitas aktif.");
}

// --- FUNGSI KHUSUS HALAMAN PROFIL ---
export function initProfile() {
    // Cek apakah ada elemen Ganti Foto (Tanda kita berada di profile.html)
    const btnGantiFoto = document.getElementById('btnGantiFoto');
    if (!btnGantiFoto) return;

    // 2. LOGIC UPDATE NAMA
    const formUpdateNama = document.getElementById('formUpdateNama');
    if (formUpdateNama) {
        formUpdateNama.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnSimpanNama');
            const origText = btn.innerText;
            btn.innerText = 'Menyimpan...';
            
            try {
                const res = await fetch('/api/update_profile', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ nama_lengkap: document.getElementById('profNama').value })
                });
                const data = await res.json();
                if(data.status === 'success') {
                    Toast.fire({icon: 'success', title: 'Nama diperbarui!'});
                    
                    // Update teks nama di layar
                    const displayNamaOperator = document.getElementById('displayNamaOperator');
                    if(displayNamaOperator) displayNamaOperator.innerText = document.getElementById('profNama').value;
                    
                    // Update Inisial (Hanya jika belum upload foto)
                    const avatarWrap = document.getElementById('profileAvatarWrap');
                    if (avatarWrap) {
                        const spanInitial = avatarWrap.querySelector('span'); // Nyari tag <span> di dalem lingkaran
                        if (spanInitial) {
                            const nameParts = document.getElementById('profNama').value.trim().split(' ');
                            let initial = nameParts[0].charAt(0).toUpperCase();
                            if(nameParts.length > 1) initial += nameParts[1].charAt(0).toUpperCase();
                            spanInitial.innerText = initial;
                        }
                    }
                } else { Swal.fire({icon: 'error', title: 'Gagal', text: data.message}); }
            } catch(err) { Swal.fire('Error', 'Gagal terhubung ke server', 'error'); }
            finally { btn.innerText = origText; }
        });
    }

    // 3. LOGIC GANTI EMAIL (TOGGLE & SUBMIT)
    const btnBukaGantiEmail = document.getElementById('btnBukaGantiEmail');
    const formGantiEmail = document.getElementById('formGantiEmail');
    const btnBatalGantiEmail = document.getElementById('btnBatalGantiEmail');

    if (btnBukaGantiEmail && formGantiEmail) {
        btnBukaGantiEmail.addEventListener('click', () => {
            formGantiEmail.style.display = 'block';
            btnBukaGantiEmail.style.display = 'none';
        });

        btnBatalGantiEmail.addEventListener('click', () => {
            formGantiEmail.style.display = 'none';
            btnBukaGantiEmail.style.display = 'block';
            formGantiEmail.reset();
        });

        formGantiEmail.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnKirimVerifEmail');
            const origText = btn.innerText;
            btn.innerText = 'Mengirim Link...';

            try {
                const res = await fetch('/api/request_email_change', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        new_email: document.getElementById('profEmailBaru').value,
                        password: document.getElementById('profPassConfirmEmail').value
                    })
                });
                const data = await res.json();
                if(data.status === 'success') {
                    Swal.fire({ icon: 'success', title: 'Email Terkirim!', text: 'Silakan cek kotak masuk email baru Anda.', confirmButtonColor: '#10B981' });
                    formGantiEmail.reset();
                    formGantiEmail.style.display = 'none';
                    btnBukaGantiEmail.style.display = 'block';
                } else { Swal.fire({icon: 'error', title: 'Gagal', text: data.message, confirmButtonColor: '#E11D48'}); }
            } catch(err) { Swal.fire('Error', 'Gagal terhubung ke server', 'error'); }
            finally { btn.innerText = origText; }
        });
    }

    // 4. LOAD & SIMPAN PREFERENSI GCS (LOCAL STORAGE)
    const loadGCSPreferences = () => {
        const setVal = (id, key, def) => { if(document.getElementById(id)) document.getElementById(id).value = localStorage.getItem(key) || def; };
        const setCheck = (id, key, def) => { if(document.getElementById(id)) document.getElementById(id).checked = localStorage.getItem(key) !== null ? localStorage.getItem(key) === 'true' : def; };

        setVal('prefIpKamera', 'defaultCameraIp', '');
        setVal('prefResolution', 'defaultCameraRes', '6');
        setVal('prefDefaultConf', 'defaultConf', '0.50');
        
        setCheck('prefShowFPS', 'showFPS', true);
        setCheck('prefShowTele', 'showTele', true);

        if(document.getElementById('valDefConf') && document.getElementById('prefDefaultConf')) {
            document.getElementById('valDefConf').innerText = document.getElementById('prefDefaultConf').value;
            document.getElementById('prefDefaultConf').addEventListener('input', (e) => document.getElementById('valDefConf').innerText = e.target.value);
        }
    };
    loadGCSPreferences();

    const btnSimpanPreferensi = document.getElementById('btnSimpanPreferensi');
    if (btnSimpanPreferensi) {
        btnSimpanPreferensi.addEventListener('click', () => {
            localStorage.setItem('defaultCameraIp', document.getElementById('prefIpKamera').value);
            localStorage.setItem('defaultCameraRes', document.getElementById('prefResolution').value);
            localStorage.setItem('defaultConf', document.getElementById('prefDefaultConf').value);
            localStorage.setItem('showFPS', document.getElementById('prefShowFPS').checked);
            localStorage.setItem('showTele', document.getElementById('prefShowTele').checked);
            Toast.fire({ icon: 'success', title: 'Konfigurasi GCS Disimpan!' });
        });
    }

// 5. GANTI FOTO PROFIL (Real Upload)
    const inputFotoProfil = document.getElementById('inputFotoProfil');
    
    if (inputFotoProfil) {
        inputFotoProfil.addEventListener('change', async (e) => {
            // Pastikan beneran ada file yang dipilih
            if(e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                
                // --- 1. Ganti Preview di Layar ---
                const reader = new FileReader();
                reader.onload = function(event) {
                    let imgEl = inputFotoProfil.parentElement.querySelector('img');
                    if (!imgEl) {
                        imgEl = document.createElement('img');
                        imgEl.style.width = '100%';
                        imgEl.style.height = '100%';
                        imgEl.style.objectFit = 'cover';
                        
                        const spanEl = inputFotoProfil.parentElement.querySelector('span');
                        if (spanEl) spanEl.remove();
                        
                        inputFotoProfil.parentElement.insertBefore(imgEl, inputFotoProfil.parentElement.firstChild);
                    }
                    imgEl.src = event.target.result;
                };
                reader.readAsDataURL(file);

                // --- 2. Kirim ke Server Backend ---
                // FIX UTAMA: Pakai FormData standar tanpa diotak-atik
                const formData = new FormData();
                formData.append('foto', file); 

                Swal.fire({title: 'Mengunggah...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
                
                try {
                    // PENTING: Jangan tambahin 'headers' apapun di sini
                    const res = await fetch('/api/upload_avatar', {
                        method: 'POST',
                        body: formData
                    });
                    
                    // Cek error HTTP (misal 400, 500) sebelum diparse ke JSON
                    if (!res.ok) {
                        const errData = await res.json();
                        throw new Error(errData.message || 'Server menolak request');
                    }
                    
                    const data = await res.json();
                    
                    if(data.status === 'success') {
                        Swal.fire({icon: 'success', title: 'Berhasil!', text: data.message, confirmButtonColor: '#10B981'});
                    } else {
                        Swal.fire({icon: 'error', title: 'Gagal', text: data.message});
                    }
                } catch(err) {
                    console.error("Upload error dari Fetch:", err.message);
                    Swal.fire('Gagal', err.message, 'error');
                }
            }
        });
    }
    // 6. LOGIC UPDATE PASSWORD
    const formPassword = document.getElementById('formPassword');
    if (formPassword) {
        formPassword.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnSimpanPassword');
            const origText = btn.innerText;
            btn.innerText = 'Memverifikasi...';
            try {
                const res = await fetch('/api/update_password', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ old_password: document.getElementById('oldPass').value, new_password: document.getElementById('newPass').value })
                });
                const data = await res.json();
                if(data.status === 'success') { Swal.fire({icon: 'success', title: 'Aman!', text: data.message, confirmButtonColor: '#10B981'}); formPassword.reset(); }
                else { Swal.fire({icon: 'error', title: 'Ditolak', text: data.message, confirmButtonColor: '#E11D48'}); }
            } catch(err) { Swal.fire('Error', 'Gagal terhubung ke server', 'error'); }
            finally { btn.innerText = origText; }
        });
    }

    // 7. DANGER ZONE
    const btnWipeHistory = document.getElementById('btnWipeHistory');
    if (btnWipeHistory) {
        btnWipeHistory.addEventListener('click', async () => {
            const result = await Swal.fire({
                title: 'Wipe Seluruh Data Laporan?', text: "Ini akan MENGHAPUS SEMUA riwayat penerbangan secara permanen! (Akun tetap aman)",
                icon: 'warning', showCancelButton: true, confirmButtonColor: '#F59E0B', confirmButtonText: 'Ya, Bersihkan Database', cancelButtonText: 'Batal'
            });
            if (result.isConfirmed) {
                Swal.showLoading();
                try {
                    const res = await fetch('/api/wipe_history', { method: 'DELETE' });
                    const data = await res.json();
                    if(data.status === 'success') Swal.fire({icon: 'success', title: 'Data Bersih!', text: 'Seluruh riwayat penerbangan telah dikosongkan.', confirmButtonColor: '#10B981'});
                } catch (err) { Swal.fire('Error', 'Gagal mengeksekusi wipe data.', 'error'); }
            }
        });
    }

    const btnHapusAkun = document.getElementById('btnHapusAkun');
    if (btnHapusAkun) {
        btnHapusAkun.addEventListener('click', async () => {
            const result = await Swal.fire({
                title: 'Hapus Akun Permanen?', text: "Ketik 'MUSNAH' di bawah ini untuk mengonfirmasi penghapusan.",
                input: 'text', icon: 'error', showCancelButton: true, confirmButtonColor: '#E11D48', confirmButtonText: 'MUSNAHKAN', cancelButtonText: 'Batal',
                inputValidator: (value) => { if (value !== 'MUSNAH') return 'Ketik MUSNAH dengan huruf kapital!' }
            });
            if (result.isConfirmed) {
                Swal.showLoading();
                await fetch('/api/delete_account', { method: 'POST' });
                Swal.fire({icon: 'success', title: 'Terhapus!', text: 'Mengalihkan...', showConfirmButton: false});
                setTimeout(() => window.location.href = '/', 2000);
            }
        });
    }
}
