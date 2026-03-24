// static/js/camera_engine.js
import { Toast } from './ui.js';

window.isCameraConnected = false;
window.isSessionActive = false;
window.activeSourceType = 'esp32'; // Default

// ==========================================
// 1. FUNGSI RESET & UI LOGIC
// ==========================================
window.clearAllData = async () => {
    try {
        await fetch('/api/reset_stats', { method: 'POST' });
        ['statMatang', 'statMentah', 'statBerbunga'].forEach(id => {
            if(document.getElementById(id)) document.getElementById(id).textContent = "0";
        });
        Toast.fire({ icon: 'info', title: 'Data Deteksi Dihapus' });
        if(window.addLogToConsole) window.addLogToConsole("[SYSTEM] Seluruh counter di-reset ke 0.");
    } catch (err) { console.error("Gagal reset", err); }
};

window.resetSpecificCounter = async (type) => {
    const map = { 'matang': 'statMatang', 'mentah': 'statMentah', 'bunga': 'statBerbunga' };
    const el = document.getElementById(map[type]);
    if (el) {
        el.textContent = "0";
        el.style.color = "#E11D48";
        setTimeout(() => { el.style.color = "var(--text-dark)"; }, 500);
        if(window.addLogToConsole) window.addLogToConsole(`[SYSTEM] Counter ${type.toUpperCase()} di-reset.`);
    }
};

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
        [0,1,2].forEach(i => bars[i].style.background = '#F59E0B');
        if(dashStatusText) { dashStatusText.textContent = 'Sinyal Sedang'; dashStatusText.style.color = '#F59E0B'; }
    } else if (rssi >= -80) {
        [0,1].forEach(i => bars[i].style.background = '#F97316');
        if(dashStatusText) { dashStatusText.textContent = 'Sinyal Lemah'; dashStatusText.style.color = '#F97316'; }
    } else {
        bars[0].style.background = '#E11D48';
        if(dashStatusText) { dashStatusText.textContent = 'Sinyal Buruk'; dashStatusText.style.color = '#E11D48'; }
    }
}

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

// ==========================================
// 2. KONEKSI KAMERA & NETWORK (DENGAN SESSION MEMORY)
// ==========================================
export function initCameraStream() {
    const btnAutoScan = document.getElementById('btnAutoScan');
    const btnKonfirmasiMencatat = document.getElementById('btnKonfirmasiMencatat');
    const btnBukaModalIP = document.getElementById('btnBukaModalIP');
    const modalIP = document.getElementById('modalIP');
    const ipInput = document.getElementById('camIpInput');
    const liveVideo = document.getElementById('liveVideo');
    let fpsInterval;

    // --- FUNGSI LOOP TELEMETRI (Diekstrak biar bisa jalan otomatis pas refresh) ---
    const startTelemetryLoop = () => {
        if(fpsInterval) clearInterval(fpsInterval);
        fpsInterval = setInterval(async () => {
            try {
                const statsRes = await fetch('/api/stream_stats');
                if (statsRes.ok) {
                    const stats = await statsRes.json();
                    
                    if(document.getElementById('statMatang')) document.getElementById('statMatang').textContent = stats.matang ?? 0;
                    if(document.getElementById('statMentah')) document.getElementById('statMentah').textContent = stats.mentah ?? 0;
                    if(document.getElementById('statBerbunga')) document.getElementById('statBerbunga').textContent = stats.bunga ?? 0;
                    
                    if(document.getElementById('fpsText')) document.getElementById('fpsText').textContent = `${stats.fps || 0} FPS`;
                    
                    if(document.getElementById('tempText')) {
                        let suhu = stats.temp ?? 0;
                        document.getElementById('tempText').textContent = `${suhu} °C`;
                    }

                    if(document.getElementById('ramText')) {
                        let ramInfo = stats.free_ram ?? 0;
                        document.getElementById('ramText').textContent = `${ramInfo} KB RAM`;
                    }
                    
                    updateSignalBars(stats.rssi);

                    const resLabel = document.getElementById('resText');
                    if (resLabel) {
                        if(window.activeSourceType === 'webcam') {
                            resLabel.textContent = "USB Cam";
                        } else {
                            const resMap = { 
                                '4':'320x240', '5':'400x296', '6':'640x480', 
                                '7':'800x600', '8':'1024x768', '9':'1280x1024', '10':'1600x1200' 
                            };
                            let currentRes = stats.res ?? null; 
                            resLabel.textContent = resMap[String(currentRes)] || currentRes || '---';
                        }
                    }

                    // ==========================================
                    // UPDATE UI MAP & GPS (VERSI DETAIL & ANIMASI)
                    // ==========================================
                    const mapTitle = document.getElementById('mapStatusTitle');
                    const mapDesc = document.getElementById('mapStatusDesc');
                    const mapIcon = document.getElementById('mapStatusIcon');
                    const gpsLatEl = document.getElementById('gpsLatText');
                    const gpsLngEl = document.getElementById('gpsLngText');
                    const gpsSatBadge = document.getElementById('gpsSatBadge');

                    let gpsError = stats.gps_error ?? 0;
                    let gpsSat = stats.gps_sat ?? 0;
                    let gpsLat = stats.gps_lat ?? null;
                    let gpsLng = stats.gps_lng ?? null;

                    if (mapTitle) {
                        if (window.activeSourceType === 'webcam') {
                            mapTitle.textContent = "Mode Debug (Lokal)"; mapTitle.style.color = "#64748B";
                            mapDesc.innerHTML = "GPS Drone dinonaktifkan di mode Webcam.";
                            mapIcon.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="1.5" style="margin-bottom: 12px; opacity: 0.5;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;
                            if(gpsSatBadge) { gpsSatBadge.textContent = "N/A"; gpsSatBadge.style.color = "#64748B"; gpsSatBadge.style.background = "#E2E8F0"; gpsSatBadge.style.borderColor = "#CBD5E1"; }
                            if(gpsLatEl) gpsLatEl.textContent = "Lat: ---";
                            if(gpsLngEl) gpsLngEl.textContent = "Lng: ---";
                        } else if (gpsError === 1) {
                            mapTitle.textContent = "GPS Hardware Error!"; mapTitle.style.color = "#E11D48"; 
                            mapDesc.innerHTML = `<div style="line-height: 1.6;">Tidak ada aliran data dari Modul GPS.<br><span style="background: rgba(225,29,72,0.1); padding: 4px 8px; border-radius: 4px; font-weight: 800; color: #E11D48; display: inline-block; margin-top: 6px;">CEK: Pin TX/RX Terbalik atau Kabel Kendor!</span></div>`;
                            mapIcon.innerHTML = `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#E11D48" stroke-width="2" style="margin-bottom: 16px; animation: pulse-danger 1.5s infinite;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
                            if(gpsSatBadge) { gpsSatBadge.textContent = "ERR"; gpsSatBadge.style.color = "#E11D48"; gpsSatBadge.style.background = "rgba(225, 29, 72, 0.15)"; gpsSatBadge.style.borderColor = "rgba(225, 29, 72, 0.3)"; }
                            if(gpsLatEl) gpsLatEl.textContent = "Lat: ERR";
                            if(gpsLngEl) gpsLngEl.textContent = "Lng: ERR";
                        } else if (gpsLat === null || gpsSat < 4) { 
                            mapTitle.textContent = "Mencari Satelit..."; mapTitle.style.color = "#F59E0B"; 
                            mapDesc.innerHTML = `Menganalisa posisi... (<strong style="color:#F59E0B;">${gpsSat}</strong> Satelit ditemukan)<br><span style="font-size:10px;">Bawa drone ke area outdoor/terbuka.</span>`;
                            mapIcon.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="1.5" style="margin-bottom: 16px; animation: spin-radar 3s linear infinite;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
                            if(gpsSatBadge) { gpsSatBadge.textContent = `${gpsSat} SAT`; gpsSatBadge.style.color = "#F59E0B"; gpsSatBadge.style.background = "rgba(245, 158, 11, 0.15)"; gpsSatBadge.style.borderColor = "rgba(245, 158, 11, 0.3)"; }
                            if(gpsLatEl) gpsLatEl.textContent = "Lat: WAIT";
                            if(gpsLngEl) gpsLngEl.textContent = "Lng: WAIT";
                        } else {
                            mapTitle.textContent = "Satelit Terkunci (Locked)"; mapTitle.style.color = "#10B981"; 
                            mapDesc.innerHTML = `<span style="color:#10B981; font-weight:700;">Akurasi Tinggi.</span> Sistem siap memetakan jalur terbang.`;
                            mapIcon.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" style="margin-bottom: 16px; animation: float-success 3s ease-in-out infinite;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
                            if(gpsSatBadge) { gpsSatBadge.textContent = `${gpsSat} SAT`; gpsSatBadge.style.color = "#10B981"; gpsSatBadge.style.background = "rgba(16, 185, 129, 0.15)"; gpsSatBadge.style.borderColor = "rgba(16, 185, 129, 0.3)"; }
                            if(gpsLatEl) gpsLatEl.textContent = `Lat: ${parseFloat(gpsLat).toFixed(4)}`;
                            if(gpsLngEl) gpsLngEl.textContent = `Lng: ${parseFloat(gpsLng).toFixed(4)}`;
                        }
                    }
                }
            } catch(e){}
        }, 1000);
    };

    // --- FUNGSI DISCONNECT ---
    window.disconnectCamera = async () => {
        const { isConfirmed } = await Swal.fire({
            title: 'Putuskan Koneksi?',
            text: 'Stream video dan telemetri akan dihentikan.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#E11D48',
            cancelButtonColor: '#475569',
            confirmButtonText: 'Ya, Putuskan'
        });

        if (isConfirmed) {
            window.isCameraConnected = false;
            
            // Hapus Memory Sesi
            localStorage.removeItem('activeSessionConnected');
            localStorage.removeItem('activeSessionDisplayText');
            
            if (fpsInterval) clearInterval(fpsInterval);
            if (liveVideo) liveVideo.src = "";
            
            document.getElementById('streamPlaceholder').style.display = 'flex';
            if (btnBukaModalIP) btnBukaModalIP.innerHTML = 'Koneksi Kamera';
            document.getElementById('dashStatusText').textContent = 'Standby';
            document.getElementById('dashStatusText').style.color = 'var(--text-dark)';
            updateSignalBars(null);
            ['resText', 'fpsText', 'tempText', 'ramText'].forEach(id => {
                if(document.getElementById(id)) document.getElementById(id).textContent = '-';
            });

            const mapTitle = document.getElementById('mapStatusTitle');
            const mapDesc = document.getElementById('mapStatusDesc');
            const mapIcon = document.getElementById('mapStatusIcon');
            if (mapTitle) {
                mapTitle.textContent = "Map Loading..."; mapTitle.style.color = "#64748B";
                mapDesc.textContent = "Menunggu koneksi kamera...";
                mapIcon.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; opacity: 0.5;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
            }
            const gpsSatBadge = document.getElementById('gpsSatBadge');
            if(gpsSatBadge) { gpsSatBadge.textContent = "0 SAT"; gpsSatBadge.style.color = "#34D399"; gpsSatBadge.style.background = "rgba(16, 185, 129, 0.15)"; gpsSatBadge.style.borderColor = "rgba(16, 185, 129, 0.3)"; }
            if(document.getElementById('gpsLatText')) document.getElementById('gpsLatText').textContent = "Lat: WAIT";
            if(document.getElementById('gpsLngText')) document.getElementById('gpsLngText').textContent = "Lng: WAIT";

            if (typeof window.matikanAI === 'function' && window.isSessionActive) window.matikanAI();
            ['btnSesiPatroli', 'btnToggleAI'].forEach(id => {
                const el = document.getElementById(id);
                if(el) { el.style.opacity = "0.5"; el.style.cursor = "not-allowed"; el.style.filter = "grayscale(100%)"; }
            });

            import('./ui.js').then(({ Toast }) => { Toast.fire({ icon: 'info', title: 'Koneksi Diputus' }); });
        }
    };

    if (ipInput) ipInput.value = localStorage.getItem('defaultCameraIp') || "";

    const btnESP32 = document.getElementById('btnPilihESP32');
    const btnWebcam = document.getElementById('btnPilihWebcam');
    
    if(btnESP32 && btnWebcam) {
        btnESP32.addEventListener('click', () => {
            window.activeSourceType = 'esp32';
            btnESP32.style.borderColor = 'var(--primary)'; btnESP32.style.background = 'var(--primary-soft)';
            btnWebcam.style.borderColor = 'var(--border-color)'; btnWebcam.style.background = 'white';
            document.getElementById('areaKoneksiESP32').style.display = 'block';
            document.getElementById('areaKoneksiWebcam').style.display = 'none';
            if(typeof syncSettingLock === 'function') syncSettingLock();
        });
        
        btnWebcam.addEventListener('click', async () => {
            window.activeSourceType = 'webcam';
            btnWebcam.style.borderColor = '#0EA5E9'; btnWebcam.style.background = '#F0F9FF';
            btnESP32.style.borderColor = 'var(--border-color)'; btnESP32.style.background = 'white';
            document.getElementById('areaKoneksiESP32').style.display = 'none';
            document.getElementById('areaKoneksiWebcam').style.display = 'block';
            if(typeof syncSettingLock === 'function') syncSettingLock();

            const selectDevice = document.getElementById('selectWebcamDevice');
            if(selectDevice) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    selectDevice.innerHTML = devices.filter(d => d.kind === 'videoinput')
                        .map((d, i) => `<option value="${i}">${d.label || `Kamera ${i+1}`}</option>`).join('');
                    stream.getTracks().forEach(t => t.stop());
                } catch(e) { selectDevice.innerHTML = '<option disabled>Akses Ditolak/Error</option>'; }
            }
        });
    }

    if (btnAutoScan) {
        btnAutoScan.addEventListener('click', async () => {
            const orig = btnAutoScan.innerHTML;
            btnAutoScan.innerHTML = `Mencari...`; btnAutoScan.disabled = true;
            try {
                const res = await fetch('/api/scan_network');
                const data = await res.json();
                if (data.status === 'success') {
                    ipInput.value = data.ip;
                    import('./ui.js').then(({ Toast }) => { Toast.fire({ icon: 'success', title: 'ESP32 Ditemukan!' }); });
                } else {
                    Swal.fire({ icon: 'warning', title: 'Tidak Ditemukan', text: data.message });
                }
            } catch (err) { Swal.fire('Error', 'Gagal scan jaringan', 'error'); } 
            finally { btnAutoScan.innerHTML = orig; btnAutoScan.disabled = false; }
        });
    }

    // --- KLIK KONEKSI MANUAL ---
    if (btnKonfirmasiMencatat) {
        btnKonfirmasiMencatat.addEventListener('click', async () => {
            let payload = {}; let displayText = "Lokal";
            
            if (window.activeSourceType === 'webcam') {
                const selectElement = document.getElementById('selectWebcamDevice');
                if(!selectElement || selectElement.value === "") return;
                payload = { type: 'webcam', index: parseInt(selectElement.value) };
                displayText = selectElement.options[selectElement.selectedIndex].text; 
            } else {
                if(!ipInput || !ipInput.value.trim()) return;
                payload = { type: 'esp32', ip: ipInput.value.trim() };
                displayText = payload.ip;
                localStorage.setItem('defaultCameraIp', payload.ip);
            }

            btnKonfirmasiMencatat.textContent = "Menghubungkan..."; btnKonfirmasiMencatat.disabled = true;

            try {
                const response = await fetch('/api/connect_cam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const data = await response.json();

                if (data.status === 'success') {
                    window.isCameraConnected = true;
                    
                    // SIMPAN MEMORY SESI AGAR TAHAN REFRESH
                    localStorage.setItem('activeSessionConnected', 'true');
                    localStorage.setItem('activeSessionDisplayText', displayText);
                    localStorage.setItem('activeSessionSourceType', window.activeSourceType);

                    ['btnSesiPatroli', 'btnToggleAI'].forEach(id => {
                        const el = document.getElementById(id);
                        if(el) { el.style.opacity = "1"; el.style.cursor = "pointer"; el.style.filter = "none"; }
                    });

                    if(modalIP) modalIP.classList.remove('active');
                    if(btnBukaModalIP) btnBukaModalIP.innerHTML = `Kamera: <b>${displayText}</b>`;
                    if(document.getElementById('dashStatusText')) document.getElementById('dashStatusText').textContent = displayText;
                    
                    import('./ui.js').then(({ Toast }) => { Toast.fire({ icon: 'success', title: 'Kamera Terhubung' }); });
                    if (liveVideo) liveVideo.src = "/video_feed?t=" + new Date().getTime();

                    startTelemetryLoop(); // Mulai Telemetri
                } else {
                    Swal.fire('Koneksi Ditolak', data.message, 'error');
                }
            } catch (e) { Swal.fire('Error', 'Gangguan Jaringan', 'error'); } 
            finally { btnKonfirmasiMencatat.textContent = "Connect Stream"; btnKonfirmasiMencatat.disabled = false; }
        });
    }

    // ==========================================
    // AUTO-RESTORE SESSION SAAT REFRESH BROWSER
    // ==========================================
    if (localStorage.getItem('activeSessionConnected') === 'true') {
        window.isCameraConnected = true;
        window.activeSourceType = localStorage.getItem('activeSessionSourceType') || 'esp32';
        const savedDisplayText = localStorage.getItem('activeSessionDisplayText') || 'Reconnected';

        ['btnSesiPatroli', 'btnToggleAI'].forEach(id => {
            const el = document.getElementById(id);
            if(el) { el.style.opacity = "1"; el.style.cursor = "pointer"; el.style.filter = "none"; }
        });

        if(btnBukaModalIP) btnBukaModalIP.innerHTML = `Kamera: <b>${savedDisplayText}</b>`;
        if(document.getElementById('dashStatusText')) document.getElementById('dashStatusText').textContent = savedDisplayText;
        if (liveVideo) {
            document.getElementById('streamPlaceholder').style.display = 'none';
            liveVideo.src = "/video_feed?t=" + new Date().getTime();
        }

        startTelemetryLoop(); // Lanjutkan telemetri secara otomatis
    }
}
// ==========================================
// 3. AI & PATROLI LOGIC
// ==========================================
export function initAIControls() {
    const btnToggleAI = document.getElementById('btnToggleAI');
    const aiBadge = document.getElementById('aiStatusBadge');
    const aiText = document.getElementById('aiStatusText');
    const aiDot = document.getElementById('aiStatusDot'); // Ini titik lampunya
    let isAIActive = false;

    if (btnToggleAI && !window.isCameraConnected) {
        btnToggleAI.style.opacity = "0.5"; btnToggleAI.style.cursor = "not-allowed"; btnToggleAI.style.filter = "grayscale(100%)";
    }

    window.matikanAI = async () => {
        isAIActive = false;
        if(btnToggleAI) { btnToggleAI.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> <span>Uji Coba AI</span>`; btnToggleAI.style.background = "#0F172A"; }
        
        // Mode Standby (Kalem, abu-abu gelap)
        if(aiBadge) { aiBadge.style.background = "white"; aiBadge.style.borderColor = "#CBD5E1"; }
        if(aiDot) { aiDot.style.background = "#94A3B8"; aiDot.style.boxShadow = "none"; }
        if(aiText) { aiText.textContent = "SYS_STANDBY"; aiText.style.color = "#475569"; }

        await fetch('/api/toggle_ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: false }) });
        await fetch('/api/reset_stats', { method: 'POST' });
        window.clearAllData();
    };

    window.nyalakanAI = async () => {
        isAIActive = true;
        if(btnToggleAI) { btnToggleAI.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> <span>Jeda Test AI</span>`; btnToggleAI.style.background = "#10B981"; }
        
       // Di window.nyalakanAI ganti jadi ini (Tema Light):
        if(aiBadge) { aiBadge.style.background = "#F0FDF4"; aiBadge.style.borderColor = "#10B981"; }
        if(aiDot) { aiDot.style.background = "#10B981"; aiDot.style.boxShadow = "none"; }
        if(aiText) { aiText.textContent = "SYS_ACTIVE"; aiText.style.color = "#059669"; }

        await fetch('/api/toggle_ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true }) });
    };

    if(btnToggleAI) {
        btnToggleAI.addEventListener('click', () => {
            if(!window.isCameraConnected) return Swal.fire('Akses Ditolak', 'Hubungkan kamera dulu.', 'warning');
            if(window.isSessionActive) return Swal.fire('Sesi Aktif', 'Tidak bisa mematikan AI saat patroli.', 'warning');
            isAIActive ? window.matikanAI() : window.nyalakanAI();
        });
    }
}

export function initPatrolSession() {
    const btnSesi = document.getElementById('btnSesiPatroli');
    const swDisplay = document.getElementById('patrolStopwatch');
    let timer; let secs = 0;

    if (btnSesi && !window.isCameraConnected) {
        btnSesi.style.opacity = "0.5"; btnSesi.style.cursor = "not-allowed"; btnSesi.style.filter = "grayscale(100%)";
    }

    if(btnSesi) {
        btnSesi.addEventListener('click', () => {
            if(!window.isCameraConnected) return Swal.fire('Error', 'Hubungkan kamera terlebih dahulu', 'error');

            if(!window.isSessionActive) {
                Swal.fire({
                    title: 'Mulai Patroli?',
                    text: 'Data deteksi akan otomatis disimpan ke riwayat.',
                    icon: 'info', showCancelButton: true, confirmButtonText: 'Mulai', confirmButtonColor: '#E11D48'
                }).then(res => {
                    if(res.isConfirmed) {
                        window.isSessionActive = true;
                        btnSesi.innerHTML = 'Akhiri & Simpan'; btnSesi.style.background = "#E11D48";
                        if(typeof window.nyalakanAI === 'function') window.nyalakanAI();
                        
                        // Start Timer
                        secs = 0; clearInterval(timer);
                        timer = setInterval(() => {
                            secs++;
                            swDisplay.textContent = `${String(Math.floor(secs/3600)).padStart(2,'0')}:${String(Math.floor((secs%3600)/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`;
                        }, 1000);
                        
                        fetch('/api/start_session', { method: 'POST' });
                    }
                });
            } else {
                Swal.fire({
                    title: 'Akhiri & Simpan?',
                    icon: 'question', showCancelButton: true, confirmButtonText: 'Simpan', confirmButtonColor: '#10B981'
                }).then(res => {
                    if(res.isConfirmed) {
                        window.isSessionActive = false;
                        btnSesi.innerHTML = 'MULAI SESI PATROLI';
                        clearInterval(timer);
                        
                        fetch('/api/stop_session', { method: 'POST' }).then(() => {
                            if(typeof window.matikanAI === 'function') window.matikanAI();
                            Swal.fire('Tersimpan', 'Laporan masuk ke database.', 'success');
                        });
                    }
                });
            }
        });
    }
}

// ==========================================
// 4. SETTINGS DRAWER LOGIC
// ==========================================
export function initHardwareSliders() {
    const bindControl = (id, apiVar, valId) => {
        const el = document.getElementById(id);
        const valEl = document.getElementById(valId);
        if(el) {
            if(valEl) el.addEventListener('input', (e) => valEl.textContent = e.target.value);
            el.addEventListener('change', (e) => {
                fetch('/api/cam_control', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({var: apiVar, val: e.target.value}) });
            });
        }
    };

    bindControl('camBrightness', 'brightness', 'valBrightness');
    bindControl('camContrast', 'contrast', 'valContrast');
    bindControl('camSaturation', 'saturation', 'valSaturation');
    bindControl('camExposure', 'ae_level', 'valExposure');
    bindControl('aiConfidence', 'ai_conf', 'valConf');
    
    // --- UPDATE DI SINI: camHflip dan camRotate ditambahin ke dalam array ---
    ['camVflip', 'camAwb', 'camAec', 'camLenc', 'camHflip', 'camRotate'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('change', e => fetch('/api/cam_control', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({var: id.replace('cam','').toLowerCase(), val: e.target.value}) }));
    });

    const resSel = document.getElementById('resSelect');
    if(resSel) resSel.addEventListener('change', e => {
        if(window.activeSourceType !== 'webcam') fetch('/api/set_resolution', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({val: e.target.value}) });
    });

    if (typeof syncSettingLock === 'function') syncSettingLock();
}

export function initDragAndDropModel() {
    const list = document.getElementById('modelSortableList');
    const uploader = document.getElementById('uploadModelBtn');
    if(!list) return;

    window.deleteAIModel = async (e, name) => {
        e.stopPropagation();
        const { isConfirmed } = await Swal.fire({title: 'Hapus?', text: `Model ${name} akan dibuang.`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#E11D48'});
        if(isConfirmed) {
            fetch(`/api/delete_model/${name}`, { method: 'DELETE' }).then(() => renderModels());
        }
    };

    const renderModels = () => {
        fetch('/api/models').then(r => r.json()).then(data => {
            if(data.status === 'success') {
                list.innerHTML = data.models.map((m, i) => `
                    <div class="sortable-item ${i===0?'active-model':''}" data-model="${m}">
                        <span class="model-name">${m}</span>
                        ${i===0 ? '<span class="badge-active-model">Active</span>' : `<button onclick="deleteAIModel(event, '${m}')" style="background:none; border:none; color:#E11D48; cursor:pointer;">Hapus</button>`}
                    </div>
                `).join('');
                
                // Set aktif ke backend
                if(data.models.length > 0) fetch('/api/set_active_model', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({model_name: data.models[0]}) });
            }
        });
    };

    if(uploader) uploader.addEventListener('change', e => {
        if(!e.target.files[0]) return;
        const fd = new FormData(); fd.append('file', e.target.files[0]);
        Swal.fire({title: 'Mengunggah...', didOpen: () => Swal.showLoading()});
        fetch('/api/upload_model', { method: 'POST', body: fd }).then(r=>r.json()).then(d => {
            if(d.status === 'success') { Swal.fire('Sukses', 'Model diunggah', 'success'); renderModels(); }
            else Swal.fire('Gagal', d.message, 'error');
            uploader.value = '';
        });
    });

    renderModels();
}