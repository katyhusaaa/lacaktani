// static/js/camera_engine.js
import { Toast } from './ui.js';

// ==========================================
// FUNGSI RESET MANUAL (TOMBOL CLEAR)
// ==========================================
window.clearAllData = async () => {
    try {
        await fetch('/api/reset_stats', { method: 'POST' });
        document.getElementById('statMatang').textContent = "0";
        document.getElementById('statMentah').textContent = "0";
        document.getElementById('statBerbunga').textContent = "0";
        Toast.fire({ icon: 'info', title: 'Data Deteksi Dihapus' });
        
        // Update Console Log
        if(window.addLogToConsole) window.addLogToConsole("[SYSTEM] Seluruh counter di-reset ke 0.");
    } catch (err) { console.error("Gagal reset", err); }
};

window.resetSpecificCounter = async (type) => {
    const map = { 'matang': 'statMatang', 'mentah': 'statMentah', 'bunga': 'statBerbunga' };
    const el = document.getElementById(map[type]);
    if (el) {
        el.textContent = "0";
        el.style.color = "#E11D48";
        setTimeout(() => { el.style.color = "#0F172A"; }, 500);
        
        if(window.addLogToConsole) window.addLogToConsole(`[SYSTEM] Counter ${type.toUpperCase()} di-reset.`);
    }
};

// ==========================================
// UTILITY: FUNGSI UPDATE ANIMASI SINYAL
// ==========================================
function updateSignalBars(rssi) {
    const bars = document.querySelectorAll('#signalBars .bar');
    const rssiText = document.getElementById('rssiText');
    const dashStatusText = document.getElementById('dashStatusText');
    
    if (!bars.length) return;
    bars.forEach(bar => bar.style.background = '#334155');

    if (rssi === null) {
        if(dashStatusText) { dashStatusText.textContent = 'Kamera Lokal'; dashStatusText.style.color = '#0EA5E9'; }
        if(rssiText) rssiText.style.display = 'none';
        return;
    }

    if (rssi === -100) {
        if(dashStatusText) { dashStatusText.textContent = 'Sinyal Terputus'; dashStatusText.style.color = '#E11D48'; }
        if(rssiText) rssiText.style.display = 'none';
        return;
    }

    if(rssiText) { rssiText.style.display = 'inline-block'; rssiText.textContent = `${rssi} dBm`; }

    if (rssi >= -60) {
        bars.forEach(bar => bar.style.background = '#10B981');
        if(dashStatusText) { dashStatusText.textContent = 'Sinyal Kuat'; dashStatusText.style.color = '#10B981'; }
    } else if (rssi >= -70) {
        bars[0].style.background = '#F59E0B'; bars[1].style.background = '#F59E0B'; bars[2].style.background = '#F59E0B';
        if(dashStatusText) { dashStatusText.textContent = 'Sinyal Sedang'; dashStatusText.style.color = '#F59E0B'; }
    } else if (rssi >= -80) {
        bars[0].style.background = '#F97316'; bars[1].style.background = '#F97316';
        if(dashStatusText) { dashStatusText.textContent = 'Sinyal Lemah'; dashStatusText.style.color = '#F97316'; }
    } else {
        bars[0].style.background = '#E11D48';
        if(dashStatusText) { dashStatusText.textContent = 'Sinyal Buruk'; dashStatusText.style.color = '#E11D48'; }
    }
}

// Tambahkan flag global ini di luar fungsi agar bisa diakses semua bagian
window.isCameraConnected = false;

// ==========================================
// 1. INISIALISASI STREAM KAMERA 
// ==========================================
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
    
    const btnAutoScan = document.getElementById('btnAutoScan');
    if (btnAutoScan) {
        btnAutoScan.addEventListener('click', async () => {
            const originalHtml = btnAutoScan.innerHTML;
            btnAutoScan.innerHTML = `Mencari...`;
            btnAutoScan.disabled = true;
            if(window.addLogToConsole) window.addLogToConsole("[NETWORK] Scanning IP lokal...");
            
            try {
                const res = await fetch('/api/scan_network');
                const data = await res.json();
                if (data.status === 'success') {
                    ipInput.value = data.ip;
                    Toast.fire({ icon: 'success', title: 'ESP32 Ditemukan!' });
                    if(window.addLogToConsole) window.addLogToConsole(`[NETWORK] ESP32 terdeteksi di ${data.ip}`);
                } else {
                    Swal.fire({ icon: 'warning', title: 'Tidak Ditemukan', text: data.message });
                    if(window.addLogToConsole) window.addLogToConsole("[NETWORK] Gagal menemukan ESP32.");
                }
            } catch (err) { Swal.fire({ icon: 'error', title: 'Error Scan', text: 'Gagal scan jaringan.' }); } 
            finally { btnAutoScan.innerHTML = originalHtml; btnAutoScan.disabled = false; }
        });
    }

    if (btnKonfirmasiMencatat) {
        btnKonfirmasiMencatat.addEventListener('click', async () => {
            let payload = {};
            let displayText = "Lokal";

            if (window.activeSourceType === 'webcam') {
                const selectElement = document.getElementById('selectWebcamDevice');
                const camIndex = selectElement ? selectElement.value : "";
                if (camIndex === "") return;
                payload = { type: 'webcam', index: parseInt(camIndex) };
                displayText = selectElement.options[selectElement.selectedIndex].text; 
            } else {
                const ip = ipInput ? ipInput.value.trim() : "";
                if (!ip) return;
                payload = { type: 'esp32', ip: ip };
                displayText = ip;
            }

            const originalText = btnKonfirmasiMencatat.textContent;
            btnKonfirmasiMencatat.textContent = "Loading...";
            btnKonfirmasiMencatat.disabled = true;
            
            if(window.addLogToConsole) window.addLogToConsole(`[STREAM] Menghubungkan ke ${displayText}...`);

            try {
                const response = await fetch('/api/connect_cam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const data = await response.json();

                if (data.status === 'success') {
                    // --- UPDATE BARU: KAMERA BERHASIL KONEK, NYALAKAN TOMBOL ---
                    window.isCameraConnected = true;
                    const btnSesi = document.getElementById('btnSesiPatroli');
                    const btnTestAI = document.getElementById('btnToggleAI');
                    if (btnSesi) {
                        btnSesi.style.opacity = "1";
                        btnSesi.style.cursor = "pointer";
                        btnSesi.style.filter = "none";
                    }
                    if (btnTestAI) {
                        btnTestAI.style.opacity = "1";
                        btnTestAI.style.cursor = "pointer";
                        btnTestAI.style.filter = "none";
                    }
                    // -----------------------------------------------------------

                    if(modalIP) modalIP.classList.remove('active');
                    if (btnBukaModalIP) btnBukaModalIP.innerHTML = `Terkoneksi: <b>${displayText}</b>`;
                    if (dashStatusText) dashStatusText.textContent = displayText;
                    Toast.fire({ icon: 'success', title: 'Kamera Terhubung' });
                    
                    if(window.addLogToConsole) window.addLogToConsole(`[STREAM] Berhasil terhubung. Memuat video feed...`);
                    if (liveVideo) liveVideo.src = "/video_feed?t=" + new Date().getTime();

                    if(fpsInterval) clearInterval(fpsInterval);
                    fpsInterval = setInterval(async () => {
                        try {
                            const statsRes = await fetch('/api/stream_stats');
                            if (statsRes.ok) {
                                const stats = await statsRes.json();
                                
                                if (document.getElementById('statMatang')) document.getElementById('statMatang').textContent = stats.matang ?? 0;
                                if (document.getElementById('statMentah')) document.getElementById('statMentah').textContent = stats.mentah ?? 0;
                                if (document.getElementById('statBerbunga')) document.getElementById('statBerbunga').textContent = stats.bunga ?? 0;
                                if (document.getElementById('fpsText')) document.getElementById('fpsText').textContent = `${stats.fps || 0} FPS`;

                                updateSignalBars(stats.rssi);

                                const resLabel = document.getElementById('resText');
                                if (resLabel) {
                                    let activeRes = stats.resolution; 
                                    if (!activeRes || activeRes === '---') {
                                        const resSelect = document.getElementById('resSelect');
                                        if (resSelect) activeRes = resSelect.value;
                                    }
                                    const resMap = { '4': '320x240', '5': '400x296', '6': '640x480', '7': '800x600', '8': '1024x768', '9': '1280x1024', '10': '1600x1200' };
                                    if (window.activeSourceType === 'webcam') { resLabel.textContent = "Auto (USB)"; } 
                                    else { resLabel.textContent = resMap[activeRes] || activeRes || '---'; }
                                }

                                const hwBadge = document.getElementById('hwDebugBadge');
                                const hwText = document.getElementById('hwDebugText');
                                if (hwBadge && hwText) {
                                    if (window.activeSourceType === 'esp32' && stats.free_ram !== null && stats.temp !== null) {
                                        hwBadge.style.display = 'flex';
                                        const ramKB = (stats.free_ram / 1024).toFixed(1);
                                        hwText.textContent = `${stats.temp}°C | ${ramKB} KB`;
                                        hwText.style.color = (stats.temp > 65) ? '#E11D48' : 'white';
                                    } else {
                                        hwBadge.style.display = 'none';
                                    }
                                }

                                const satBadge = document.getElementById('gpsSatBadge');
                                const latText = document.getElementById('gpsLatText');
                                const lngText = document.getElementById('gpsLngText');

                                if (satBadge && latText && lngText) {
                                    satBadge.innerText = `🛰️ ${stats.gps_sat || 0} SAT`;
                                    if (stats.gps_sat < 4) {
                                        satBadge.style.color = '#FBBF24'; 
                                        satBadge.style.borderColor = 'rgba(251, 191, 36, 0.3)';
                                        satBadge.style.background = 'rgba(251, 191, 36, 0.15)';
                                    } else {
                                        satBadge.style.color = '#34D399'; 
                                        satBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                                        satBadge.style.background = 'rgba(16, 185, 129, 0.15)';
                                    }

                                    if (stats.gps_lat && stats.gps_lng) {
                                        latText.innerText = `Lat: ${stats.gps_lat.toFixed(6)}`;
                                        lngText.innerText = `Lng: ${stats.gps_lng.toFixed(6)}`;
                                        latText.style.color = '#F8FAFC';
                                        lngText.style.color = '#F8FAFC';
                                    } else {
                                        latText.innerText = `Lat: NO FIX`;
                                        lngText.innerText = `Lng: NO FIX`;
                                        latText.style.color = '#94A3B8';
                                        lngText.style.color = '#94A3B8';
                                    }
                                }
                            }
                        } catch (e) { }
                    }, 1000);
                } else {
                    if(window.addLogToConsole) window.addLogToConsole(`[ERROR] Koneksi ditolak: ${data.message}`);
                }
            } catch (e) { 
                if(window.addLogToConsole) window.addLogToConsole(`[ERROR] Terjadi gangguan jaringan.`);
            } 
            finally { btnKonfirmasiMencatat.textContent = originalText; btnKonfirmasiMencatat.disabled = false; }
        });
    }
}

// ==========================================
// 2. INISIALISASI KONTROL AI 
// ==========================================
export function initAIControls() {
    const btnToggleAI = document.getElementById('btnToggleAI');
    const aiStatusBadge = document.getElementById('aiStatusBadge');
    const aiStatusText = document.getElementById('aiStatusText');
    let isAIActive = false;
    window.isSessionActive = false;

    // Redupkan tombol saat web pertama kali dibuka
    if (btnToggleAI && !window.isCameraConnected) {
        btnToggleAI.style.opacity = "0.5";
        btnToggleAI.style.cursor = "not-allowed";
        btnToggleAI.style.filter = "grayscale(100%)";
    }

    window.matikanAI = async () => {
        isAIActive = false;
        if (btnToggleAI) { 
            btnToggleAI.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> <span>Test Mode AI</span>`; 
            btnToggleAI.style.background = "rgba(15, 23, 42, 0.9)"; 
        }
        if (aiStatusBadge) aiStatusBadge.style.background = "rgba(225, 29, 72, 0.9)";
        if (aiStatusText) aiStatusText.textContent = "AI STANDBY (OFF)";
        
        await fetch('/api/toggle_ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: false }) });
        await fetch('/api/reset_stats', { method: 'POST' });
        
        document.getElementById('statMatang').textContent = "0";
        document.getElementById('statMentah').textContent = "0";
        document.getElementById('statBerbunga').textContent = "0";
        
        if(window.addLogToConsole) window.addLogToConsole("[AI] YOLOv5 Engine dimatikan. Data dibersihkan.");
    };

    window.nyalakanAI = async () => {
        isAIActive = true;
        if (btnToggleAI) { 
            btnToggleAI.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> <span>Jeda Test AI</span>`; 
            btnToggleAI.style.background = "#10B981"; 
        }
        if (aiStatusBadge) aiStatusBadge.style.background = "rgba(16, 185, 129, 0.9)";
        if (aiStatusText) aiStatusText.textContent = "DETECTING";
        await fetch('/api/toggle_ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true }) });
        
        if(window.addLogToConsole) window.addLogToConsole("[AI] YOLOv5 Engine diaktifkan. Mencari objek...");
    };

    if (btnToggleAI) {
        btnToggleAI.addEventListener('click', () => {
            // CEGAH KLIK KALAU KAMERA MATI
            if (!window.isCameraConnected) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Sinyal Video Kosong',
                    text: 'Tidak bisa menguji AI tanpa aliran video. Silakan Konek Kamera terlebih dahulu.',
                    confirmButtonColor: '#0EA5E9'
                });
                return;
            }

            if (window.isSessionActive) { 
                Swal.fire({ icon: 'warning', title: 'Sesi Aktif', text: 'AI tidak bisa dimatikan manual saat Sesi Patroli berjalan!' }); 
                return; 
            }
            if (isAIActive) window.matikanAI(); else window.nyalakanAI();
        });
    }
}

// ==========================================
// 3. INISIALISASI SESI PATROLI 
// ==========================================
export function initPatrolSession() {
    const btnSesiPatroli = document.getElementById('btnSesiPatroli');
    const swDisplay = document.getElementById('patrolStopwatch');
    let patrolTimer; 
    let patrolSeconds = 0;

    // Redupkan tombol patroli saat web pertama kali dibuka
    if (btnSesiPatroli && !window.isCameraConnected) {
        btnSesiPatroli.style.opacity = "0.5";
        btnSesiPatroli.style.cursor = "not-allowed";
        btnSesiPatroli.style.filter = "grayscale(100%)";
    }

    function startStopwatch() {
        if (!swDisplay) return;
        patrolSeconds = 0; 
        swDisplay.style.color = "#10B981"; 
        if (patrolTimer) clearInterval(patrolTimer);
        patrolTimer = setInterval(() => {
            patrolSeconds++;
            const hrs = String(Math.floor(patrolSeconds / 3600)).padStart(2, '0');
            const mins = String(Math.floor((patrolSeconds % 3600) / 60)).padStart(2, '0');
            const secs = String(patrolSeconds % 60).padStart(2, '0');
            swDisplay.textContent = `${hrs}:${mins}:${secs}`;
        }, 1000);
    }

    function stopStopwatch() {
        clearInterval(patrolTimer);
        if (swDisplay) swDisplay.style.color = "#10B981"; // Tetap neon hijau walau berhenti
    }

    if (btnSesiPatroli) {
        btnSesiPatroli.addEventListener('click', () => {
            // CEGAH KLIK KALAU KAMERA MATI
            if (!window.isCameraConnected) {
                Swal.fire({
                    icon: 'error',
                    title: 'Akses Ditolak',
                    text: 'Sistem tidak dapat memulai perekaman laporan panen tanpa sinyal video. Hubungkan kamera terlebih dahulu.',
                    confirmButtonColor: '#E11D48'
                });
                if(window.addLogToConsole) window.addLogToConsole("[SYSTEM] Gagal memulai sesi: Kamera Offline.");
                return;
            }

            if (!window.isSessionActive) {
                Swal.fire({
                    title: 'Mulai Sesi Patroli?',
                    html: `
                        <div style="font-size: 14px; color: #64748B; margin-bottom: 20px;">
                            Sistem akan mulai merekam perhitungan objek dan menyimpannya ke dalam Database Riwayat secara otomatis.
                        </div>
                        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 8px; text-align: left; display: flex; gap: 12px; align-items: flex-start;">
                            <div style="color: #0EA5E9; margin-top: 2px;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            </div>
                            <div style="font-size: 12px; color: #475569; line-height: 1.5;">
                                <strong>Pro Tip:</strong> Pastikan Anda telah mengatur <i>Confidence Threshold</i> dan <i>Resolusi</i> dengan benar di menu Settings sebelum memulai, agar kalkulasi panen akurat.
                            </div>
                        </div>
                    `,
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonColor: '#E11D48',
                    cancelButtonColor: '#94A3B8',
                    confirmButtonText: 'Ya, Mulai Terbang',
                    cancelButtonText: 'Batal',
                    customClass: { popup: 'swal-premium-popup', title: 'swal-premium-title' }
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.isSessionActive = true;
                        
                        btnSesiPatroli.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg> Akhiri & Simpan Laporan`;
                        btnSesiPatroli.style.background = "#E11D48";
                        
                        if (typeof window.nyalakanAI === 'function') window.nyalakanAI();
                        startStopwatch();
                        
                        fetch('/api/start_session', { method: 'POST' });
                        Toast.fire({ icon: 'success', title: 'Sesi Patroli Dimulai!' });
                        if(window.addLogToConsole) window.addLogToConsole("[PATROLI] Sesi inspeksi kebun di-mulai.");
                    }
                });

            } else {
                Swal.fire({
                    title: 'Akhiri Sesi?',
                    text: "Data kalkulasi akan disimpan ke menu Riwayat dan AI akan dihentikan sementara.",
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#10B981', 
                    cancelButtonColor: '#94A3B8',
                    confirmButtonText: 'Ya, Simpan Laporan',
                    cancelButtonText: 'Lanjut Terbang'
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.isSessionActive = false;
                        
                        btnSesiPatroli.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-.5-.5-2.5 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.5l-1 2c-.2.5.1 1 .6 1.1l7.4 1.9-4.6 4.6-2.1-.7c-.4-.1-.9.2-1.1.5l-.8 1.6c-.2.5.1 1 .6 1.1l4 .8 1.5 4c.1.5.6.8 1.1.6l1.6-.8c.4-.2.6-.6.5-1.1l-.7-2.1 4.6-4.6 1.9 7.4c.1.5.6.8 1.1.6l2-1c.4-.3.6-.7.5-1.2z"></path></svg> MULAI SESI PATROLI`;
                        btnSesiPatroli.style.background = "linear-gradient(to bottom, rgba(225,29,72,0.15), rgba(225,29,72,0.05))";
                        
                        stopStopwatch();

                        fetch('/api/stop_session', { method: 'POST' })
                            .then(res => res.json())
                            .then(async data => {
                                if (typeof window.matikanAI === 'function') window.matikanAI();
                                if (data.status === 'success') {
                                    Swal.fire({ icon: 'success', title: 'Laporan Tersimpan!', text: 'Hasil deteksi masuk ke database riwayat.', confirmButtonColor: '#10B981' });
                                    if(window.addLogToConsole) window.addLogToConsole("[PATROLI] Sesi dihentikan. Data disimpan ke Database.");
                                }
                            });
                    }
                });
            }
        });
    }
}

// ==========================================
// 4. INISIALISASI HARDWARE (SLIDER ESP32)
// ==========================================
export function initHardwareSliders() {
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
            slider.addEventListener('input', (e) => { valDisplay.textContent = e.target.value; });
            slider.addEventListener('change', async (e) => { 
                await fetch('/api/cam_control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ var: ctrl.varName, val: e.target.value }) }); 
                if(window.addLogToConsole) window.addLogToConsole(`[HARDWARE] Parameter ${ctrl.varName} diset ke ${e.target.value}.`);
            });
        }
    });

    const aiSensorControls = [
        { id: 'camVflip', varName: 'vflip' }, { id: 'camHmirror', varName: 'hmirror' },
        { id: 'camAwb', varName: 'awb' }, { id: 'camAec', varName: 'aec' }, { id: 'camLenc', varName: 'lenc' }
    ];
    aiSensorControls.forEach(ctrl => {
        const selectEl = document.getElementById(ctrl.id);
        if (selectEl) {
            selectEl.addEventListener('change', async (e) => {
                await fetch('/api/cam_control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ var: ctrl.varName, val: e.target.value }) });
                if(window.addLogToConsole) window.addLogToConsole(`[HARDWARE] Pengaturan lensa ${ctrl.varName} diubah.`);
            });
        }
    });

    const resSelect = document.getElementById('resSelect');
    if (resSelect) {
        resSelect.addEventListener('change', async (e) => {
            if (window.activeSourceType === 'webcam') return;
            await fetch('/api/set_resolution', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ val: e.target.value }) });
            if(window.addLogToConsole) window.addLogToConsole(`[HARDWARE] Resolusi kamera diganti.`);
        });
    }

    const aiConfSlider = document.getElementById('aiConfidence');
    const valConfDisplay = document.getElementById('valConf');
    if (aiConfSlider && valConfDisplay) {
        aiConfSlider.addEventListener('input', (e) => { valConfDisplay.textContent = e.target.value; });
        aiConfSlider.addEventListener('change', async (e) => { 
            await fetch('/api/cam_control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ var: 'ai_conf', val: e.target.value }) }); 
            if(window.addLogToConsole) window.addLogToConsole(`[AI] Confidence Threshold diatur ke ${e.target.value}.`);
        });
    }
}

// ==========================================
// 5. INISIALISASI DRAG AND DROP MODEL AI
// ==========================================
export function initDragAndDropModel() {
    const sortableList = document.getElementById('modelSortableList');
    const uploadInput = document.getElementById('uploadModelBtn');
    if (!sortableList) return;

    const fetchAndRenderModels = async () => {
        try {
            const res = await fetch('/api/models');
            const data = await res.json();
            if (data.status === 'success') {
                sortableList.innerHTML = ''; 
                data.models.forEach((modelName, index) => {
                    const isActive = index === 0;
                    const html = `<div class="sortable-item ${isActive ? 'active-model' : ''}" draggable="true" data-model="${modelName}"><span class="model-name">${modelName}</span>${isActive ? '<span class="badge-active-model">Active</span>' : ''}</div>`;
                    sortableList.insertAdjacentHTML('beforeend', html);
                });
                attachDragEvents();
            }
        } catch (err) { }
    };

    if (uploadInput) {
        uploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !file.name.endsWith('.pt')) return;
            const formData = new FormData();
            formData.append('file', file);
            Toast.fire({ icon: 'info', title: 'Mengunggah model...' });
            if(window.addLogToConsole) window.addLogToConsole(`[SYSTEM] Mengunggah model ${file.name}...`);
            try {
                const res = await fetch('/api/upload_model', { method: 'POST', body: formData });
                const data = await res.json();
                if (data.status === 'success') { 
                    Toast.fire({ icon: 'success', title: data.message }); 
                    if(window.addLogToConsole) window.addLogToConsole(`[SYSTEM] Model ${file.name} berhasil diunggah.`);
                    fetchAndRenderModels(); 
                }
            } catch (err) { }
        });
    }

    const attachDragEvents = () => {
        const items = sortableList.querySelectorAll('.sortable-item');
        items.forEach(item => {
            item.addEventListener('dragstart', () => setTimeout(() => item.classList.add('dragging'), 0));
            item.addEventListener('dragend', () => { item.classList.remove('dragging'); updateActiveModel(sortableList); });
        });

        sortableList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingItem = sortableList.querySelector('.dragging');
            if (!draggingItem) return;
            let siblings = [...sortableList.querySelectorAll('.sortable-item:not(.dragging)')];
            let nextSibling = siblings.find(sibling => e.clientY <= sibling.getBoundingClientRect().top + sibling.offsetHeight / 2);
            if (!nextSibling) sortableList.appendChild(draggingItem);
            else sortableList.insertBefore(draggingItem, nextSibling);
        });
    };

    const updateActiveModel = async (list) => {
        const allItems = list.querySelectorAll('.sortable-item');
        const topModelItem = allItems[0];
        const topModelName = topModelItem.getAttribute('data-model');

        allItems.forEach(item => {
            item.classList.remove('active-model');
            const badge = item.querySelector('.badge-active-model');
            if (badge) badge.remove();
        });

        topModelItem.classList.add('active-model');
        topModelItem.insertAdjacentHTML('beforeend', '<span class="badge-active-model">Active</span>');

        try {
            Toast.fire({ icon: 'info', title: `Memuat model ${topModelName}...` });
            if(window.addLogToConsole) window.addLogToConsole(`[AI] Menyiapkan model otak ${topModelName}...`);
            const res = await fetch('/api/set_active_model', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model_name: topModelName }) });
            const data = await res.json();
            if (data.status === 'success') { 
                Toast.fire({ icon: 'success', title: `Engine AI beralih ke: ${topModelName}` }); 
                if(window.addLogToConsole) window.addLogToConsole(`[AI] Engine berhasil beralih ke ${topModelName}.`);
            } 
        } catch (err) { }
    };

    fetchAndRenderModels();
}