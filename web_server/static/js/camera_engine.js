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
// 2. KONEKSI KAMERA & NETWORK
// ==========================================
export function initCameraStream() {
    const btnAutoScan = document.getElementById('btnAutoScan');
    const btnKonfirmasiMencatat = document.getElementById('btnKonfirmasiMencatat');
    const btnBukaModalIP = document.getElementById('btnBukaModalIP');
    const modalIP = document.getElementById('modalIP');
    const ipInput = document.getElementById('camIpInput');
    const liveVideo = document.getElementById('liveVideo');
    let fpsInterval;

    // Set IP History
    if (ipInput) ipInput.value = localStorage.getItem('defaultCameraIp') || "";

    // Toggle Source Buttons
    const btnESP32 = document.getElementById('btnPilihESP32');
    const btnWebcam = document.getElementById('btnPilihWebcam');
    
    if(btnESP32 && btnWebcam) {
        btnESP32.addEventListener('click', () => {
            window.activeSourceType = 'esp32';
            btnESP32.style.borderColor = 'var(--primary)'; btnESP32.style.background = 'var(--primary-soft)';
            btnWebcam.style.borderColor = 'var(--border-color)'; btnWebcam.style.background = 'white';
            document.getElementById('areaKoneksiESP32').style.display = 'block';
            document.getElementById('areaKoneksiWebcam').style.display = 'none';
            syncSettingLock();
        });
        
        btnWebcam.addEventListener('click', async () => {
            window.activeSourceType = 'webcam';
            btnWebcam.style.borderColor = '#0EA5E9'; btnWebcam.style.background = '#F0F9FF';
            btnESP32.style.borderColor = 'var(--border-color)'; btnESP32.style.background = 'white';
            document.getElementById('areaKoneksiESP32').style.display = 'none';
            document.getElementById('areaKoneksiWebcam').style.display = 'block';
            syncSettingLock();

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
                    Toast.fire({ icon: 'success', title: 'ESP32 Ditemukan!' });
                } else {
                    Swal.fire({ icon: 'warning', title: 'Tidak Ditemukan', text: data.message });
                }
            } catch (err) { Swal.fire('Error', 'Gagal scan jaringan', 'error'); } 
            finally { btnAutoScan.innerHTML = orig; btnAutoScan.disabled = false; }
        });
    }

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
                localStorage.setItem('defaultCameraIp', payload.ip); // Simpan history IP
            }

            btnKonfirmasiMencatat.textContent = "Menghubungkan..."; btnKonfirmasiMencatat.disabled = true;

            try {
                const response = await fetch('/api/connect_cam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const data = await response.json();

                if (data.status === 'success') {
                    window.isCameraConnected = true;
                    // Aktifkan Tombol AI & Patroli
                    ['btnSesiPatroli', 'btnToggleAI'].forEach(id => {
                        const el = document.getElementById(id);
                        if(el) { el.style.opacity = "1"; el.style.cursor = "pointer"; el.style.filter = "none"; }
                    });

                    if(modalIP) modalIP.classList.remove('active');
                    if(btnBukaModalIP) btnBukaModalIP.innerHTML = `Kamera: <b>${displayText}</b>`;
                    if(document.getElementById('dashStatusText')) document.getElementById('dashStatusText').textContent = displayText;
                    
                    Toast.fire({ icon: 'success', title: 'Kamera Terhubung' });
                    if (liveVideo) liveVideo.src = "/video_feed?t=" + new Date().getTime();

                    // ==========================================
                    // LOOP TELEMETRI (UPDATE DATA UI)
                    // ==========================================
                    if(fpsInterval) clearInterval(fpsInterval);
                    fpsInterval = setInterval(async () => {
                        try {
                            const statsRes = await fetch('/api/stream_stats');
                            if (statsRes.ok) {
                                const stats = await statsRes.json();
                                
                                // Update Deteksi Tani
                                if(document.getElementById('statMatang')) document.getElementById('statMatang').textContent = stats.matang ?? 0;
                                if(document.getElementById('statMentah')) document.getElementById('statMentah').textContent = stats.mentah ?? 0;
                                if(document.getElementById('statBerbunga')) document.getElementById('statBerbunga').textContent = stats.bunga ?? 0;
                                
                                // Update FPS
                                if(document.getElementById('fpsText')) document.getElementById('fpsText').textContent = `${stats.fps || 0} FPS`;
                                
                                // Update Suhu
                                if(document.getElementById('tempText')) {
                                    let suhu = stats.temp ?? 0;
                                    document.getElementById('tempText').textContent = `${suhu} °C`;
                                }

                                // Update RAM 
                                if(document.getElementById('ramText')) {
                                    let ramInfo = stats.free_ram ?? 0;
                                    document.getElementById('ramText').textContent = `${ramInfo} KB RAM`;
                                }
                                
                                updateSignalBars(stats.rssi);

                                // Update Resolusi Label
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
                            }
                        } catch(e){}
                    }, 1000);
                } else {
                    Swal.fire('Koneksi Ditolak', data.message, 'error');
                }
            } catch (e) { Swal.fire('Error', 'Gangguan Jaringan', 'error'); } 
            finally { btnKonfirmasiMencatat.textContent = "Connect Stream"; btnKonfirmasiMencatat.disabled = false; }
        });
    }
}
// ==========================================
// 3. AI & PATROLI LOGIC
// ==========================================
export function initAIControls() {
    const btnToggleAI = document.getElementById('btnToggleAI');
    const aiBadge = document.getElementById('aiStatusBadge');
    const aiText = document.getElementById('aiStatusText');
    let isAIActive = false;

    if (btnToggleAI && !window.isCameraConnected) {
        btnToggleAI.style.opacity = "0.5"; btnToggleAI.style.cursor = "not-allowed"; btnToggleAI.style.filter = "grayscale(100%)";
    }

    window.matikanAI = async () => {
        isAIActive = false;
        if(btnToggleAI) { btnToggleAI.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> <span>Uji Coba AI</span>`; btnToggleAI.style.background = "#0F172A"; }
        if(aiBadge) aiBadge.style.background = "rgba(225, 29, 72, 0.9)";
        if(aiText) aiText.textContent = "AI STANDBY (OFF)";
        await fetch('/api/toggle_ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: false }) });
        await fetch('/api/reset_stats', { method: 'POST' });
        window.clearAllData();
    };

    window.nyalakanAI = async () => {
        isAIActive = true;
        if(btnToggleAI) { btnToggleAI.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> <span>Jeda Test AI</span>`; btnToggleAI.style.background = "#10B981"; }
        if(aiBadge) aiBadge.style.background = "rgba(16, 185, 129, 0.9)";
        if(aiText) aiText.textContent = "DETECTING...";
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
    
    ['camVflip', 'camAwb', 'camAec', 'camLenc'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('change', e => fetch('/api/cam_control', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({var: id.replace('cam','').toLowerCase(), val: e.target.value}) }));
    });

    const resSel = document.getElementById('resSelect');
    if(resSel) resSel.addEventListener('change', e => {
        if(window.activeSourceType !== 'webcam') fetch('/api/set_resolution', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({val: e.target.value}) });
    });

    syncSettingLock();
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