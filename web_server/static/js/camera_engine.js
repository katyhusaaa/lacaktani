// static/js/camera_engine.js
import { Toast } from './ui.js';

// ==========================================
// UTILITY: FUNGSI UPDATE ANIMASI SINYAL
// ==========================================
function updateSignalBars(rssi) {
    const bars = document.querySelectorAll('#signalBars .bar');
    const rssiText = document.getElementById('rssiText');
    const dashStatusText = document.getElementById('dashStatusText');
    
    if (!bars.length) return;

    // Reset warna jadi abu-abu
    bars.forEach(bar => bar.style.background = '#334155');

    // Jika offline / tidak ada sinyal
    if (rssi === -100 || !rssi) {
        if(dashStatusText) {
            dashStatusText.textContent = 'Offline';
            dashStatusText.style.color = '#94A3B8';
        }
        if(rssiText) rssiText.style.display = 'none';
        return;
    }

    // Jika Terkoneksi
    if(dashStatusText) {
        dashStatusText.textContent = 'Terkoneksi';
        dashStatusText.style.color = '#10B981';
    }
    if(rssiText) {
        rssiText.style.display = 'inline-block';
        rssiText.textContent = `${rssi} dBm`;
    }

    // Logika pewarnaan batang sinyal
    if (rssi >= -60) {
        // 4 Batang Hijau (Kuat)
        bars.forEach(bar => bar.style.background = '#10B981');
    } else if (rssi >= -70) {
        // 3 Batang Kuning (Sedang)
        bars[0].style.background = '#F59E0B';
        bars[1].style.background = '#F59E0B';
        bars[2].style.background = '#F59E0B';
    } else if (rssi >= -80) {
        // 2 Batang Oranye (Lemah)
        bars[0].style.background = '#F97316';
        bars[1].style.background = '#F97316';
    } else {
        // 1 Batang Merah (Sekarat)
        bars[0].style.background = '#E11D48';
    }
}

// ==========================================
// 1. INISIALISASI STREAM KAMERA (MODAL & KONEKSI)
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
    
    // --- LOGIKA AUTO SCAN IP ESP32 ---
    const btnAutoScan = document.getElementById('btnAutoScan');
    if (btnAutoScan) {
        btnAutoScan.addEventListener('click', async () => {
            const originalHtml = btnAutoScan.innerHTML;
            btnAutoScan.innerHTML = `<span style="font-size: 12px;">Mencari...</span>`;
            btnAutoScan.disabled = true;
            btnAutoScan.style.opacity = '0.7';

            try {
                const res = await fetch('/api/scan_network');
                const data = await res.json();
                
                if (data.status === 'success') {
                    ipInput.value = data.ip;
                    Toast.fire({ icon: 'success', title: 'ESP32 Ditemukan!' });
                } else {
                    Swal.fire({ icon: 'warning', title: 'Tidak Ditemukan', text: data.message, confirmButtonColor: '#E11D48' });
                }
            } catch (err) {
                Swal.fire({ icon: 'error', title: 'Error Scan', text: 'Gagal memindai jaringan lokal.', confirmButtonColor: '#E11D48' });
            } finally {
                btnAutoScan.innerHTML = originalHtml;
                btnAutoScan.disabled = false;
                btnAutoScan.style.opacity = '1';
            }
        });
    }

    // --- LOGIKA HUBUNGKAN STREAM (WEBCAM / ESP32) ---
    if (btnKonfirmasiMencatat) {
        btnKonfirmasiMencatat.addEventListener('click', async () => {
            let payload = {};
            let displayText = "Lokal";

            // Cek Mode yang dipilih user
            if (window.activeSourceType === 'webcam') {
                const selectElement = document.getElementById('selectWebcamDevice');
                const camIndex = selectElement ? selectElement.value : "";
                
                if (camIndex === "") {
                    Swal.fire({ icon: 'info', title: 'Ups!', text: 'Pilih perangkat kamera lokalnya dulu.', confirmButtonColor: '#E11D48' });
                    return;
                }
                payload = { type: 'webcam', index: parseInt(camIndex) };
                displayText = selectElement.options[selectElement.selectedIndex].text; 
            } else {
                const ip = ipInput ? ipInput.value.trim() : "";
                
                if (!ip) {
                    Swal.fire({ icon: 'info', title: 'IP Kosong', text: 'Masukkan IP ESP32 Anda.', confirmButtonColor: '#E11D48' });
                    return;
                }
                payload = { type: 'esp32', ip: ip };
                displayText = ip;
            }

            const originalText = btnKonfirmasiMencatat.textContent;
            btnKonfirmasiMencatat.textContent = "Menghubungkan...";
            btnKonfirmasiMencatat.disabled = true;

            try {
                // Tembak API
                const response = await fetch('/api/connect_cam', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();

                // Kalau Sukses Terkoneksi
                if (data.status === 'success') {
                    if(modalIP) modalIP.classList.remove('active');
                    
                    if (btnBukaModalIP) {
                        btnBukaModalIP.innerHTML = `Terkoneksi: <span style="font-weight:900; color:white;">${displayText}</span>`;
                        btnBukaModalIP.style.background = '#475569';
                    }
                    
                    if (dashStatusText) dashStatusText.textContent = displayText;

                    Toast.fire({ icon: 'success', title: 'Kamera Terhubung' });
                    
                    if (liveVideo) liveVideo.src = "/video_feed?t=" + new Date().getTime();

                    // Interval cek FPS, Deteksi, Sinyal & Resolusi (Tiap 1 Detik)
                    if(fpsInterval) clearInterval(fpsInterval); // Bersihkan interval lama jika ada
                    fpsInterval = setInterval(async () => {
                        try {
                            const statsRes = await fetch('/api/stream_stats');
                            if (statsRes.ok) {
                                const stats = await statsRes.json();
                                
                                // Update FPS
                                if (document.getElementById('fpsText')) 
                                    document.getElementById('fpsText').textContent = `${stats.fps || 0} FPS`;
                                
                                // Update Counter Buah
                                if (document.getElementById('statMatang') && stats.matang !== undefined) 
                                    document.getElementById('statMatang').textContent = stats.matang;
                                if (document.getElementById('statMentah') && stats.mentah !== undefined) 
                                    document.getElementById('statMentah').textContent = stats.mentah;
                                if (document.getElementById('statBerbunga') && stats.bunga !== undefined) 
                                    document.getElementById('statBerbunga').textContent = stats.bunga;

                                // Update Sinyal Telemetry
                                updateSignalBars(stats.rssi);

                                // Update Label Resolusi
                                const resLabel = document.getElementById('resText');
                                if (resLabel) {
                                    let activeRes = stats.res;

                                    if (activeRes === '---' || !activeRes) {
                                        const resSelect = document.getElementById('resSelect');
                                        if (resSelect) activeRes = resSelect.value;
                                    }

                                    const resMap = {
                                        '4': '320x240',   '5': '400x296',   '6': '640x480', 
                                        '7': '800x600',   '8': '1024x768',  '9': '1280x1024', 
                                        '10': '1600x1200'
                                    };
                                    
                                    if (window.activeSourceType === 'webcam') {
                                        resLabel.textContent = "Auto (USB)";
                                    } else {
                                        resLabel.textContent = resMap[activeRes] || activeRes || '---';
                                    }
                                }
                            }
                        } catch (e) { }
                    }, 1000);
                } else {
                    Swal.fire({ icon: 'error', title: 'Koneksi Gagal', text: data.message, confirmButtonColor: '#E11D48' });
                }
            } catch (e) {
                Swal.fire({ icon: 'error', title: 'Error', text: 'Gagal menghubungi server.', confirmButtonColor: '#E11D48' });
            } finally {
                btnKonfirmasiMencatat.textContent = originalText;
                btnKonfirmasiMencatat.disabled = false;
            }
        });
    }
}

// ==========================================
// 2. INISIALISASI KONTROL AI (TOGGLE)
// ==========================================
export function initAIControls() {
    const btnToggleAI = document.getElementById('btnToggleAI');
    const aiStatusBadge = document.getElementById('aiStatusBadge');
    const aiStatusText = document.getElementById('aiStatusText');
    let isAIActive = false;

    window.isSessionActive = false;

    window.matikanAI = () => {
        isAIActive = false;
        if (btnToggleAI) {
            btnToggleAI.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> <span>Test Mode AI (Tanpa Record)</span>`;
            btnToggleAI.style.background = "rgba(15, 23, 42, 0.9)";
        }
        if (aiStatusBadge) aiStatusBadge.style.background = "rgba(225, 29, 72, 0.9)";
        if (aiStatusText) aiStatusText.textContent = "AI STANDBY (OFF)";
        fetch('/api/toggle_ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: false }) });
    };

    window.nyalakanAI = () => {
        isAIActive = true;
        if (btnToggleAI) {
            btnToggleAI.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> <span>Jeda Test AI</span>`;
            btnToggleAI.style.background = "#10B981";
        }
        if (aiStatusBadge) aiStatusBadge.style.background = "rgba(16, 185, 129, 0.9)";
        if (aiStatusText) aiStatusText.textContent = "AI DETECTING";
        fetch('/api/toggle_ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true }) });
    };

    if (btnToggleAI) {
        btnToggleAI.addEventListener('click', () => {
            if (window.isSessionActive) {
                Swal.fire({ icon: 'warning', title: 'Sesi Sedang Berjalan', text: 'Tidak bisa mematikan AI saat sesi penerbangan aktif!', confirmButtonColor: '#E11D48' });
                return;
            }
            if (isAIActive) window.matikanAI(); else window.nyalakanAI();
        });
    }
}

// ==========================================
// 3. INISIALISASI SESI PATROLI & STOPWATCH
// ==========================================
export function initPatrolSession() {
    const btnSesiPatroli = document.getElementById('btnSesiPatroli');
    const swDisplay = document.getElementById('patrolStopwatch');
    
    // Variabel Global untuk Stopwatch
    let patrolTimer;
    let patrolSeconds = 0;

    function startStopwatch() {
        if (!swDisplay) return;
        
        patrolSeconds = 0;
        swDisplay.textContent = "00:00:00";
        swDisplay.style.color = "#10B981"; // Berubah hijau nyala pas jalan
        
        if (patrolTimer) clearInterval(patrolTimer); // Bersihin sisa timer kalau ada

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
        if (swDisplay) swDisplay.style.color = "#94A3B8"; // Kembali warna abu-abu
    }

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
                    willClose: () => { clearInterval(timerInterval); }
                }).then((result) => {
                    if (result.dismiss === Swal.DismissReason.timer) {
                        window.isSessionActive = true;
                        btnSesiPatroli.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12"></rect></svg> Akhiri & Simpan Laporan`;
                        btnSesiPatroli.classList.add('btn-record-active');

                        // Nyalakan AI secara otomatis
                        if (typeof window.nyalakanAI === 'function') window.nyalakanAI();
                        
                        Toast.fire({ icon: 'success', title: 'Sesi Patroli Dimulai!' });
                        
                        // JALANKAN STOPWATCH!
                        startStopwatch();

                        fetch('/api/start_session', { method: 'POST' });
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

                        // MATIKAN STOPWATCH!
                        stopStopwatch();

                        fetch('/api/stop_session', { method: 'POST' })
                            .then(res => res.json())
                            .then(data => {
                                if (typeof window.matikanAI === 'function') window.matikanAI();
                                if (data.status === 'success') {
                                    Swal.fire({ icon: 'success', title: 'Laporan Tersimpan!', text: 'Estimasi panen berhasil dikalkulasi & masuk database.', confirmButtonColor: '#10B981' });
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
    // A. Logika Pengaturan ESP32 (Slider & Dropdown Biasa)
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

    // B. LOGIKA GANTI RESOLUSI ESP32
    const resSelect = document.getElementById('resSelect');
    if (resSelect) {
        resSelect.addEventListener('change', async (e) => {
            if (window.activeSourceType === 'webcam') {
                Swal.fire({ icon: 'info', title: 'Hanya untuk ESP32', text: 'Pengaturan resolusi ini khusus untuk stream dari ESP32-CAM.', confirmButtonColor: '#10B981' });
                return;
            }

            document.body.style.cursor = 'wait';
            try {
                const response = await fetch('/api/set_resolution', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ val: e.target.value })
                });
                const data = await response.json();
                
                if (data.status === 'success') {
                    Toast.fire({ icon: 'success', title: 'Resolusi Kamera Diubah!' });
                } else {
                    Swal.fire('Gagal', data.message || 'Gagal mengubah resolusi', 'error');
                }
            } catch (err) { console.error("Gagal ganti resolusi:", err); } 
            finally { document.body.style.cursor = 'default'; }
        });
    }

    // C. LOGIKA SLIDER AI CONFIDENCE THRESHOLD
    const aiConfSlider = document.getElementById('aiConfidence');
    const valConfDisplay = document.getElementById('valConf');

    if (aiConfSlider && valConfDisplay) {
        aiConfSlider.addEventListener('input', (e) => { valConfDisplay.textContent = e.target.value; });
        aiConfSlider.addEventListener('change', async (e) => {
            try {
                await fetch('/api/cam_control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ var: 'ai_conf', val: e.target.value })
                });
                Toast.fire({ icon: 'success', title: `Threshold AI diubah: ${e.target.value}` });
            } catch (err) { console.error("Gagal update confidence:", err); }
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
                if (data.models.length === 0) {
                    sortableList.innerHTML = `<div style="padding:10px; color:gray; font-size:12px;">Belum ada model .pt</div>`;
                    return;
                }

                data.models.forEach((modelName, index) => {
                    const isActive = index === 0;
                    const activeClass = isActive ? 'active-model' : '';
                    const badgeHtml = isActive ? '<span class="badge-active-model">Active</span>' : '';
                    
                    const html = `
                        <div class="sortable-item ${activeClass}" draggable="true" data-model="${modelName}">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span class="drag-handle">⋮⋮</span>
                                <span class="model-name">${modelName}</span>
                            </div>
                            ${badgeHtml}
                        </div>
                    `;
                    sortableList.insertAdjacentHTML('beforeend', html);
                });
                attachDragEvents();
            }
        } catch (err) { console.error("Gagal load daftar model:", err); }
    };

    if (uploadInput) {
        uploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.name.endsWith('.pt')) {
                Swal.fire('Error', 'File harus berformat .pt (PyTorch Weights)', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('file', file);
            Toast.fire({ icon: 'info', title: 'Mengunggah model...' });

            try {
                const res = await fetch('/api/upload_model', { method: 'POST', body: formData });
                const data = await res.json();
                
                if (data.status === 'success') {
                    Toast.fire({ icon: 'success', title: data.message });
                    fetchAndRenderModels(); 
                } else {
                    Swal.fire('Error Upload', data.message, 'error');
                }
            } catch (err) { Swal.fire('Error', 'Terjadi kesalahan jaringan', 'error'); }
        });
    }

    const attachDragEvents = () => {
        const items = sortableList.querySelectorAll('.sortable-item');
        
        items.forEach(item => {
            item.addEventListener('dragstart', () => setTimeout(() => item.classList.add('dragging'), 0));
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                updateActiveModel(sortableList); 
            });
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
            const res = await fetch('/api/set_active_model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model_name: topModelName })
            });
            const data = await res.json();
            
            if (data.status === 'success') {
                Toast.fire({ icon: 'success', title: `Engine AI beralih ke: ${topModelName}` });
            } else {
                Swal.fire('Error Engine AI', data.message, 'error');
            }
        } catch (err) { console.error("Gagal ganti model:", err); }
    };

    fetchAndRenderModels();
}