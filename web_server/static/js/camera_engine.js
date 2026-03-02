// static/js/camera_engine.js
import { Toast } from './ui.js';

export function initCameraStream() {
    const btnBukaModalIP = document.getElementById('btnBukaModalIP');
    const modalIP = document.getElementById('modalIP');
    const btnTutupModalIP = document.getElementById('btnTutupModalIP');
    const btnKonfirmasiMencatat = document.getElementById('btnKonfirmasiMencatat');
    const ipInput = document.getElementById('camIpInput');
    const liveVideo = document.getElementById('liveVideo');
    const dashStatusText = document.getElementById('dashStatusText');
    let fpsInterval;

    if (btnBukaModalIP) btnBukaModalIP.addEventListener('click', () => modalIP.classList.add('active'));
    if (btnTutupModalIP) btnTutupModalIP.addEventListener('click', () => modalIP.classList.remove('active'));

    if (btnKonfirmasiMencatat) {
        btnKonfirmasiMencatat.addEventListener('click', async () => {
            const ip = ipInput.value.trim();
            if (!ip) {
                Swal.fire({ icon: 'info', title: 'IP Kosong', text: 'Masukkan IP ESP32 Anda.', confirmButtonColor: '#E11D48' });
                return;
            }
            
            const originalText = btnKonfirmasiMencatat.textContent;
            btnKonfirmasiMencatat.textContent = "Menghubungkan...";
            btnKonfirmasiMencatat.disabled = true;

            try {
                const response = await fetch('/api/connect_cam', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip: ip })
                });
                const data = await response.json();

                if (data.status === 'success') {
                    modalIP.classList.remove('active');
                    btnBukaModalIP.innerHTML = `Terkoneksi: <span style="font-weight:900; color:white;">${ip}</span>`;
                    btnBukaModalIP.style.background = '#475569';
                    if(dashStatusText) dashStatusText.textContent = ip;
                    
                    Toast.fire({ icon: 'success', title: 'Kamera Terhubung' });
                    if(liveVideo) liveVideo.src = "/video_feed?t=" + new Date().getTime();
                    
                    // Interval cek FPS & Deteksi
                    fpsInterval = setInterval(async () => {
                        try {
                            const statsRes = await fetch('/api/stream_stats');
                            if (statsRes.ok) {
                                const stats = await statsRes.json();
                                if(document.getElementById('fpsText')) document.getElementById('fpsText').textContent = `${stats.fps || 0} FPS`;
                                if(document.getElementById('statMatang') && stats.matang !== undefined) document.getElementById('statMatang').textContent = stats.matang;
                                if(document.getElementById('statMentah') && stats.mentah !== undefined) document.getElementById('statMentah').textContent = stats.mentah;
                                if(document.getElementById('statBerbunga') && stats.bunga !== undefined) document.getElementById('statBerbunga').textContent = stats.bunga;
                            }
                        } catch(e) {}
                    }, 1000);
                } else {
                    Swal.fire({ icon: 'error', title: 'Koneksi Gagal', text: data.message, confirmButtonColor: '#E11D48' });
                }
            } catch(e) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal menghubungi server.', confirmButtonColor: '#E11D48' });
            } finally {
                btnKonfirmasiMencatat.textContent = originalText;
                btnKonfirmasiMencatat.disabled = false;
            }
        });
    }
}

export function initAIControls() {
    const btnToggleAI = document.getElementById('btnToggleAI');
    const aiStatusBadge = document.getElementById('aiStatusBadge');
    const aiStatusText = document.getElementById('aiStatusText');
    let isAIActive = false;

    // Logika Session Exposed ke window biar bisa dibaca AI Toggle
    window.isSessionActive = false; 

    window.matikanAI = () => {
        isAIActive = false;
        if(btnToggleAI) {
            btnToggleAI.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> <span>Test Mode AI (Tanpa Record)</span>`;
            btnToggleAI.style.background = "rgba(15, 23, 42, 0.9)";
        }
        if (aiStatusBadge) aiStatusBadge.style.background = "rgba(225, 29, 72, 0.9)";
        if (aiStatusText) aiStatusText.textContent = "AI STANDBY (OFF)";
        fetch('/api/toggle_ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: false }) });
    };

    window.nyalakanAI = () => {
        isAIActive = true;
        if(btnToggleAI) {
            btnToggleAI.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> <span>Jeda Test AI</span>`;
            btnToggleAI.style.background = "#10B981"; 
        }
        if (aiStatusBadge) aiStatusBadge.style.background = "rgba(16, 185, 129, 0.9)"; 
        if (aiStatusText) aiStatusText.textContent = "AI DETECTING";
        fetch('/api/toggle_ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true }) });
    };

    if (btnToggleAI) {
        btnToggleAI.addEventListener('click', () => {
            if(window.isSessionActive) {
                Swal.fire({icon: 'warning', title: 'Sesi Sedang Berjalan', text: 'Tidak bisa mematikan AI saat sesi penerbangan aktif!', confirmButtonColor: '#E11D48'});
                return;
            }
            if(isAIActive) window.matikanAI(); else window.nyalakanAI();
        });
    }
}

export function initPatrolSession() {
    const btnSesiPatroli = document.getElementById('btnSesiPatroli');
    
    if (btnSesiPatroli) {
        btnSesiPatroli.addEventListener('click', () => {
            if (!window.isSessionActive) {
                let timerInterval;
                Swal.fire({
                    title: 'Siap Terbang!',
                    html: 'Merekam data kebun dalam <b></b> detik...',
                    timer: 3000,
                    timerProgressBar: true,
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                        const b = Swal.getHtmlContainer().querySelector('b');
                        b.style.fontSize = '30px';
                        b.style.color = '#E11D48';
                        timerInterval = setInterval(() => {
                            b.textContent = Math.ceil(Swal.getTimerLeft() / 1000);
                        }, 100);
                    },
                    willClose: () => {
                        clearInterval(timerInterval);
                    }
                }).then((result) => {
                    if (result.dismiss === Swal.DismissReason.timer) {
                        window.isSessionActive = true;
                        btnSesiPatroli.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12"></rect></svg> Akhiri & Simpan Laporan`;
                        btnSesiPatroli.classList.add('btn-record-active');
                        
                        // Gunakan function window.nyalakanAI yang diexpose dari fungsi sebelumnnya
                        if(typeof window.nyalakanAI === 'function') window.nyalakanAI();
                        
                        Toast.fire({ icon: 'success', title: 'Sesi Patroli Dimulai!' });
                    }
                });

            } else {
                Swal.fire({
                    title: 'Akhiri Patroli?',
                    text: "Data panen akan dianalisis dan disimpan ke riwayat.",
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#10B981',
                    cancelButtonColor: '#475569',
                    confirmButtonText: 'Ya, Simpan Laporan',
                    cancelButtonText: 'Teruskan Terbang'
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.isSessionActive = false;
                        btnSesiPatroli.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Mulai Sesi Patroli`;
                        btnSesiPatroli.classList.remove('btn-record-active');
                        
                        if(typeof window.matikanAI === 'function') window.matikanAI();

                        Swal.fire({
                            icon: 'success',
                            title: 'Laporan Tersimpan!',
                            text: 'Estimasi panen berhasil dikalkulasi.',
                            confirmButtonColor: '#10B981'
                        });
                    }
                });
            }
        });
    }
}

export function initHardwareSliders() {
    // Logika Pengaturan ESP32 (Slider & Dropdown)
    const camControls = [
        { id: 'camBrightness', varName: 'brightness', valId: 'valBrightness' },
        { id: 'camContrast', varName: 'contrast', valId: 'valContrast' },
        { id: 'camSaturation', varName: 'saturation', valId: 'valSaturation' },
        { id: 'camExposure', varName: 'ae_level', valId: 'valExposure' }
    ];

    camControls.forEach(ctrl => {
        const slider = document.getElementById(ctrl.id);
        const valDisplay = document.getElementById(ctrl.valId);

        if (slider && valDisplay) {
            slider.addEventListener('input', (e) => {
                const v = parseInt(e.target.value);
                valDisplay.textContent = v > 0 ? `+${v}` : v;
            });
            slider.addEventListener('change', async (e) => {
                try {
                    await fetch('/api/cam_control', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ var: ctrl.varName, val: e.target.value })
                    });
                } catch (err) { console.error(`Gagal merubah ${ctrl.varName}`); }
            });
        }
    });

    const aiSensorControls = [
        { id: 'camVflip', varName: 'vflip' },
        { id: 'camHmirror', varName: 'hmirror' },
        { id: 'camAwb', varName: 'awb' },
        { id: 'camAec', varName: 'aec' },
        { id: 'camLenc', varName: 'lenc' }
    ];

    aiSensorControls.forEach(ctrl => {
        const selectEl = document.getElementById(ctrl.id);
        if (selectEl) {
            selectEl.addEventListener('change', async (e) => {
                document.body.style.cursor = 'wait';
                try {
                    await fetch('/api/cam_control', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ var: ctrl.varName, val: e.target.value })
                    });
                    Toast.fire({ icon: 'success', title: 'Setting tersimpan' });
                } catch (err) { console.error(`Gagal merubah ${ctrl.varName}`); } 
                finally { document.body.style.cursor = 'default'; }
            });
        }
    });
}