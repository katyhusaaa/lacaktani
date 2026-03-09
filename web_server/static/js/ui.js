// static/js/ui.js

// Helper Notifikasi SweetAlert yang bisa diexport ke file lain
export const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
});

export function initUIDrawer() {
    const btnSettings = document.getElementById('btnSettings');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');
    const drawerOverlay = document.getElementById('drawerOverlay');
    const settingsDrawer = document.getElementById('settingsDrawer');

    const openDrawer = () => {
        if(drawerOverlay) drawerOverlay.classList.add('active');
        if(settingsDrawer) settingsDrawer.classList.add('active');
        document.body.style.overflow = 'hidden';
    };
    const closeDrawer = () => {
        if(drawerOverlay) drawerOverlay.classList.remove('active');
        if(settingsDrawer) settingsDrawer.classList.remove('active');
        document.body.style.overflow = '';
    };

    if (btnSettings) btnSettings.addEventListener('click', openDrawer);
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);
}

export function initPremiumPopup() {
    const premiumButtons = document.querySelectorAll('.btn-premium-trigger');
    premiumButtons.forEach(btn => {
        btn.addEventListener('mouseover', () => { btn.style.borderColor = 'var(--primary)'; });
        btn.addEventListener('mouseout', () => { btn.style.borderColor = '#E2E8F0'; });

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            Swal.fire({
                title: '<span style="font-weight:900; font-size: 24px;">Upgrade ke LacakTani <span style="color:#E11D48">PRO</span></span>',
                html: `
                    <p style="color: #475569; font-size: 14px; margin-bottom: 24px;">Fitur yang Anda pilih membutuhkan lisensi premium. Pilih paket yang sesuai dengan luas kebun Anda.</p>
                    <div style="display: flex; gap: 16px; text-align: left; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 200px; border: 1px solid #E2E8F0; padding: 20px; border-radius: 16px; background: white;">
                            <h4 style="font-weight: 800; color: #475569; margin-bottom: 8px;">Petani Pemula</h4>
                            <div style="font-size: 24px; font-weight: 900; color: #0F172A; margin-bottom: 16px;">Rp 0<span style="font-size: 12px; font-weight: 600; color: #94A3B8;">/bln</span></div>
                            <ul style="font-size: 12px; color: #475569; padding-left: 16px; line-height: 1.8; margin-bottom: 24px;">
                                <li>Deteksi Real-time</li><li>Batas 1 Sesi/Hari</li><li>No Cloud Backup</li>
                            </ul>
                            <button disabled style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #E2E8F0; background: #F8FAFC; color: #94A3B8; font-weight: 700; cursor: not-allowed;">Current Plan</button>
                        </div>
                        <div style="flex: 1; min-width: 200px; border: 2px solid #E11D48; padding: 20px; border-radius: 16px; background: #FFF0F2; box-shadow: 0 10px 25px -5px rgba(225, 29, 72, 0.2); position: relative;">
                            <span style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #E11D48; color: white; font-size: 10px; font-weight: 800; padding: 4px 12px; border-radius: 100px;">PALING LARIS</span>
                            <h4 style="font-weight: 800; color: #E11D48; margin-bottom: 8px;">Juragan Kebun</h4>
                            <div style="font-size: 24px; font-weight: 900; color: #0F172A; margin-bottom: 16px;">Rp 149rb<span style="font-size: 12px; font-weight: 600; color: #94A3B8;">/bln</span></div>
                            <ul style="font-size: 12px; color: #475569; padding-left: 16px; line-height: 1.8; margin-bottom: 24px;">
                                <li><strong>Live Heatmap GPS</strong></li><li><strong>Cloud Sync 30 Hari</strong></li><li>Sesi Tanpa Batas</li><li>Export Data CSV/Excel</li>
                            </ul>
                            <button onclick="Swal.fire('Fitur Dummy!', 'Ini cuma buat gaya-gayaan TA doang wkwkwk', 'info')" style="width: 100%; padding: 10px; border-radius: 8px; border: none; background: #E11D48; color: white; font-weight: 700; cursor: pointer; box-shadow: 0 4px 10px rgba(225, 29, 72, 0.3);">Upgrade Sekarang</button>
                        </div>
                        <div style="flex: 1; min-width: 200px; border: 1px solid #E2E8F0; padding: 20px; border-radius: 16px; background: white;">
                            <h4 style="font-weight: 800; color: #475569; margin-bottom: 8px;">Agri-Corp</h4>
                            <div style="font-size: 24px; font-weight: 900; color: #0F172A; margin-bottom: 16px;">Custom</div>
                            <ul style="font-size: 12px; color: #475569; padding-left: 16px; line-height: 1.8; margin-bottom: 24px;">
                                <li>Integrasi Drone Auto-Pilot</li><li>Private Database</li><li>Multiple Farm Dashboard</li><li>API Access 24/7</li>
                            </ul>
                            <button onclick="Swal.fire('Halo Investor!', 'Silakan hubungi kami untuk pendanaan.', 'success')" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #0F172A; background: white; color: #0F172A; font-weight: 700; cursor: pointer;">Hubungi Kami</button>
                        </div>
                    </div>
                `,
                width: 900,
                showConfirmButton: false,
                showCloseButton: true
            });
        });
    });
}

// ==========================================
// INISIALISASI SETTING, LOCK ESP32, & PRESET KUSTOM
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    const btnESP32 = document.getElementById('btnPilihESP32');
    const btnWebcam = document.getElementById('btnPilihWebcam');
    const areaESP32 = document.getElementById('areaKoneksiESP32');
    const areaWebcam = document.getElementById('areaKoneksiWebcam');
    const iconWebcam = document.getElementById('iconWebcam');
    const selectDevice = document.getElementById('selectWebcamDevice');

    window.activeSourceType = 'esp32';

    // --- 1. FUNGSI LOCK/UNLOCK OTOMATIS BERDASARKAN SUMBER KAMERA ---
    function syncSettingLock() {
        const isESP32 = window.activeSourceType === 'esp32';
        const container = document.getElementById('espGroupContainer');
        const indicator = document.getElementById('lockStatusIndicator');
        if (container && indicator) {
            container.style.opacity = isESP32 ? "1" : "0.3";
            container.style.pointerEvents = isESP32 ? "auto" : "none";
            container.style.filter = isESP32 ? "none" : "grayscale(1)";
            indicator.style.display = isESP32 ? "none" : "flex";
        }
    }

    if (btnESP32) {
        btnESP32.addEventListener('click', () => {
            window.activeSourceType = 'esp32';
            btnESP32.classList.add('active');
            btnWebcam.classList.remove('active');
            
            btnESP32.style.borderColor = 'var(--primary)';
            btnESP32.style.background = 'var(--primary-soft)';
            btnESP32.style.boxShadow = '0 8px 20px rgba(225, 29, 72, 0.15)';
            
            btnWebcam.style.borderColor = 'var(--border-color)';
            btnWebcam.style.background = 'white';
            btnWebcam.style.boxShadow = 'none';
            if(iconWebcam) iconWebcam.setAttribute('stroke', '#64748B');

            areaESP32.style.display = 'block';
            areaWebcam.style.display = 'none';
            syncSettingLock();
        });
    }

    if (btnWebcam) {
        btnWebcam.addEventListener('click', async () => {
            window.activeSourceType = 'webcam';
            btnWebcam.classList.add('active');
            btnESP32.classList.remove('active');
            
            btnWebcam.style.borderColor = '#0EA5E9';
            btnWebcam.style.background = '#F0F9FF';
            btnWebcam.style.boxShadow = '0 8px 20px rgba(14, 165, 233, 0.15)';
            if(iconWebcam) iconWebcam.setAttribute('stroke', '#0EA5E9');
            
            btnESP32.style.borderColor = 'var(--border-color)';
            btnESP32.style.background = 'white';
            btnESP32.style.boxShadow = 'none';

            areaESP32.style.display = 'none';
            areaWebcam.style.display = 'block';
            syncSettingLock();

            if (selectDevice) {
                selectDevice.innerHTML = '<option value="" disabled selected>Meminta izin & mencari kamera...</option>';
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    const videoDevices = devices.filter(device => device.kind === 'videoinput');
                    stream.getTracks().forEach(track => track.stop());

                    selectDevice.innerHTML = ''; 
                    if (videoDevices.length === 0) {
                        selectDevice.innerHTML = '<option value="" disabled>Kamera tidak ditemukan!</option>';
                        return;
                    }
                    videoDevices.forEach((device, index) => {
                        const option = document.createElement('option');
                        option.value = index; 
                        option.text = device.label || `Kamera ${index + 1}`;
                        selectDevice.appendChild(option);
                    });
                } catch (err) {
                    console.error("Error Kamera:", err);
                    selectDevice.innerHTML = '<option value="" disabled>Akses Ditolak Browser / Error</option>';
                }
            }
        });
    }

    // --- FIX CONFIDENCE SLIDER AGAR REAL-TIME ---
    const aiSlider = document.getElementById('aiConfidence');
    const aiLabel = document.getElementById('valConf');
    if (aiSlider) {
        aiSlider.addEventListener('input', (e) => { if(aiLabel) aiLabel.textContent = e.target.value; });
        aiSlider.addEventListener('change', async (e) => {
            await fetch('/api/cam_control', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ var: 'ai_conf', val: e.target.value })
            });
        });
    }

    // ========================================================
    // --- SISTEM USER CUSTOM PRESET (DIPERBAIKI 100%) ---
    // ========================================================
    
    // Pastikan ID ini SAMA PERSIS dengan ID yang ada di file HTML lu
    const allSettingIds = [
        'aiConfidence', 'resSelect', 'camBrightness', 'camContrast', 
        'camSaturation', 'camExposure', 'camVflip', 'camHmirror', 
        'camAwb', 'camAec', 'camLenc'
    ];

window.saveCurrentAsPreset = async () => {
    // Gunakan SweetAlert2 untuk form input yang elegan
    const { value: presetName } = await Swal.fire({
        title: 'Simpan Preset',
        text: 'Masukkan nama untuk konfigurasi lensa saat ini:',
        input: 'text',
        inputPlaceholder: 'Misal: Kebun Pagi Terik',
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#E11D48', // Warna merah primary LacakTani
        cancelButtonColor: '#94A3B8',  // Warna abu-abu tombol cancel
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
        background: '#FFFFFF',
        customClass: {
            title: 'swal-title-custom',
            input: 'saas-input' // Minjam class CSS lu biar inputnya seragam
        },
        inputValidator: (value) => {
            if (!value) {
                return 'Nama preset tidak boleh kosong!';
            }
        }
    });

    // Jika user menekan tombol Simpan dan namanya ada
    if (presetName) {
        try {
            // Animasi loading
            Swal.fire({
                title: 'Menyimpan...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Tembak API untuk simpan preset (Pastikan endpoint lu ini /api/save_preset atau sesuaikan)
            const response = await fetch('/api/save_preset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: presetName })
            });

            const data = await response.json();

            if (data.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil!',
                    text: `Preset "${presetName}" tersimpan.`,
                    confirmButtonColor: '#10B981' // Hijau sukses
                });
                
                // Tambahkan log ke console jika fungsi addLogToConsole ada
                if (window.addLogToConsole) {
                    window.addLogToConsole(`[SYSTEM] Preset lensa "${presetName}" berhasil disimpan.`);
                }
                
                // Refresh list preset jika ada fungsinya
                if (typeof loadUserPresets === 'function') loadUserPresets();
                
            } else {
                Swal.fire('Gagal', data.message || 'Terjadi kesalahan saat menyimpan.', 'error');
            }
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Gagal menghubungi server.', 'error');
        }
    }
};

    window.applyPreset = function(mode) {
        let vals = {};
        
        if (mode === 'high_accuracy') {
            vals = { aiConfidence: "0.75", resSelect: "8", camBrightness: "0", camContrast: "1", camSaturation: "1", camExposure: "0", camVflip: "0", camHmirror: "0", camAwb: "1", camAec: "1", camLenc: "1" };
        } else if (mode === 'standard') {
            vals = { aiConfidence: "0.45", resSelect: "6", camBrightness: "0", camContrast: "0", camSaturation: "0", camExposure: "0", camVflip: "0", camHmirror: "0", camAwb: "1", camAec: "1", camLenc: "1" };
        } else {
            const userPresets = JSON.parse(localStorage.getItem('userPresets') || '{}');
            vals = userPresets[mode] || {};
        }

        if (Object.keys(vals).length > 0) {
            let delay = 0; // Kasih delay kecil biar ESP32 nggak kaget diserbu 11 perintah sekaligus
            
            Object.keys(vals).forEach(id => {
                const el = document.getElementById(id);
                // Pastikan tipe data sama saat membandingkan
                if (el && String(el.value) !== String(vals[id])) {
                    el.value = vals[id];
                    el.dispatchEvent(new Event('input')); 
                    
                    // Delay pengiriman ke ESP32 tiap 50ms (0.05 detik)
                    setTimeout(() => {
                        el.dispatchEvent(new Event('change'));
                    }, delay);
                    delay += 50; 
                }
            });
            
            Toast.fire({ icon: 'success', title: `Menggunakan Preset: ${mode}` });
        }
    };

    // FUNGSI BARU: MENGHAPUS PRESET (Klik Kanan)
    window.deletePreset = function(e, name) {
        e.preventDefault(); // Matikan menu klik kanan bawaan browser
        
        Swal.fire({
            title: 'Hapus Preset?',
            text: `Apakah lu yakin mau hapus preset "${name}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#E11D48',
            cancelButtonColor: '#475569',
            confirmButtonText: 'Ya, Hapus!'
        }).then((result) => {
            if (result.isConfirmed) {
                let userPresets = JSON.parse(localStorage.getItem('userPresets') || '{}');
                delete userPresets[name]; // Hapus dari memori
                localStorage.setItem('userPresets', JSON.stringify(userPresets));
                renderUserPresets(); // Render ulang UI
                Toast.fire({ icon: 'info', title: `Preset ${name} dihapus.` });
            }
        });
    };

    function renderUserPresets() {
        const container = document.getElementById('userPresetList');
        if(!container) return;
        
        const userPresets = JSON.parse(localStorage.getItem('userPresets') || '{}');
        
        // Render dengan tambahan oncontextmenu (Klik Kanan)
        container.innerHTML = Object.keys(userPresets).map(name => 
            `<button 
                onclick="applyPreset('${name}')" 
                oncontextmenu="deletePreset(event, '${name}')" 
                class="btn-outline" 
                title="Klik Kiri: Terapkan | Klik Kanan: Hapus"
                style="font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
            >${name}</button>`
        ).join('');
    }
    
    renderUserPresets();
    syncSettingLock(); 
});

// Inisialisasi
document.addEventListener('DOMContentLoaded', () => {
    updateNavClock();
    setInterval(updateNavClock, 1000);
});
