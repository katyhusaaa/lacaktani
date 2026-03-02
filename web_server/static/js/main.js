document.addEventListener('DOMContentLoaded', () => {

    // ==================================================
    // 0. LOGIKA DRAWER (PANEL SAMPING SETTINGS)
    // ==================================================
    const btnOpenDrawer = document.getElementById('btnOpenDrawer'); 
    const openDrawerLink = document.getElementById('openDrawerLink'); 
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');
    const drawerOverlay = document.getElementById('drawerOverlay');
    const settingsDrawer = document.getElementById('settingsDrawer');

    const openDrawer = (e) => {
        if (e) e.preventDefault();
        drawerOverlay.classList.add('active');
        settingsDrawer.classList.add('active');
        document.body.style.overflow = 'hidden'; 
    };

    const closeDrawer = () => {
        drawerOverlay.classList.remove('active');
        settingsDrawer.classList.remove('active');
        document.body.style.overflow = ''; 
    };

    if (btnOpenDrawer) btnOpenDrawer.addEventListener('click', openDrawer);
    if (openDrawerLink) openDrawerLink.addEventListener('click', openDrawer);
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer); 


    // ==================================================
    // 1. ELEMEN DOM UTAMA (Fase & Navigasi)
    // ==================================================
    const phaseSetup = document.getElementById('phaseSetup');
    const phaseDashboard = document.getElementById('phaseDashboard');
    const ipInput = document.getElementById('camIpInput');
    const btnKonfirmasiMencatat = document.getElementById('btnKonfirmasiMencatat');

    // DOM khusus Landing Page baru
    const btnBukaModal = document.getElementById('btnBukaModal');
    const modalIP = document.getElementById('modalIP');
    const btnTutupModal = document.getElementById('btnTutupModal');

    // Top Nav Bar & Dashboard Elements
    const networkStatusBadge = document.getElementById('networkStatusBadge');
    const dashStatusText = document.getElementById('dashStatusText');
    const btnAkhiriSesi = document.getElementById('btnAkhiriSesi');
    const btnSettings = document.getElementById('btnSettings');
    const liveVideo = document.getElementById('liveVideo');
    const fpsText = document.getElementById('fpsText');

    let fpsInterval;


    // ==================================================
    // 2. LOGIKA SETUP (MODAL) & KONEKSI KAMERA
    // ==================================================
    // Klik "Mulai Deteksi" di Landing -> Buka Modal
    if (btnBukaModal) {
        btnBukaModal.addEventListener('click', () => {
            modalIP.classList.add('active');
        });
    }

    // Klik "Batal" di Modal -> Tutup Modal
    if (btnTutupModal) {
        btnTutupModal.addEventListener('click', () => {
            modalIP.classList.remove('active');
        });
    }

    // Klik "Hubungkan & Mulai AI" -> Proses Koneksi ke ESP32
    if (btnKonfirmasiMencatat) {
        btnKonfirmasiMencatat.addEventListener('click', async () => {
            const ip = ipInput.value.trim();
            if (!ip) return alert("Silakan masukkan IP Address ESP32 Anda!");

            // Ubah text tombol biar keliatan lagi loading
            const originalText = btnKonfirmasiMencatat.textContent;
            btnKonfirmasiMencatat.textContent = "Menghubungkan...";
            btnKonfirmasiMencatat.disabled = true;

            try {
                // Tembak API Flask buat nyambungin ESP32
                const response = await fetch('/api/connect_cam', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ip: ip })
                });
                const data = await response.json();

                if (data.status === 'success') {
                    // TUTUP MODAL & PINDAH FASE KE DASHBOARD
                    modalIP.classList.remove('active');
                    phaseSetup.classList.add('hidden');
                    phaseDashboard.classList.remove('hidden');

                    // Munculin UI Top Navbar
                    if (networkStatusBadge) networkStatusBadge.classList.remove('hidden');
                    if (btnAkhiriSesi) btnAkhiriSesi.classList.remove('hidden');
                    if (btnSettings) btnSettings.classList.remove('hidden');

                    // Update Status IP di pojok atas video
                    if(dashStatusText) dashStatusText.textContent = `${ip}`;

                    // Mulai tembak stream video YOLOv5
                    if(liveVideo) liveVideo.src = "/video_feed?t=" + new Date().getTime();

                    // Tarik data FPS dan Jumlah Deteksi tiap 1 detik
                    fpsInterval = setInterval(async () => {
                        try {
                            const res = await fetch('/api/stream_stats');
                            if (res.ok) {
                                const stats = await res.json();
                                
                                if(document.getElementById('fpsText')) {
                                    document.getElementById('fpsText').textContent = `${stats.fps || 0} FPS`;
                                }
                                if(document.getElementById('statMatang') && stats.matang !== undefined) {
                                    document.getElementById('statMatang').textContent = stats.matang;
                                }
                                if(document.getElementById('statMentah') && stats.mentah !== undefined) {
                                    document.getElementById('statMentah').textContent = stats.mentah;
                                }
                                if(document.getElementById('statBerbunga') && stats.bunga !== undefined) {
                                    document.getElementById('statBerbunga').textContent = stats.bunga;
                                }
                            }
                        } catch (e) {
                            // Abaikan error kalau jaringan kedip
                        }
                    }, 1000); 

                } else {
                    alert("Error: " + data.message);
                }
            } catch (error) {
                alert("Gagal menghubungi server lokal. Pastikan Flask berjalan.");
            } finally {
                // Balikin tombol ke semula kalau gagal/selesai
                btnKonfirmasiMencatat.textContent = originalText;
                btnKonfirmasiMencatat.disabled = false;
            }
        });
    }

    // Klik "Akhiri Sesi" -> Putus Stream & Balik ke Setup Landing
    if (btnAkhiriSesi) {
        btnAkhiriSesi.addEventListener('click', () => {
            if (confirm("Yakin ingin mengakhiri sesi deteksi?")) {
                // Matikan stream & interval angka
                if(liveVideo) liveVideo.src = "";
                clearInterval(fpsInterval);

                // Tukar UI kembali ke fase Setup (Landing Page)
                phaseDashboard.classList.add('hidden');
                phaseSetup.classList.remove('hidden');

                // Sembunyikan UI Top Navbar di landing page
                if (btnAkhiriSesi) btnAkhiriSesi.classList.add('hidden');
                
                // Reset form Setup
                ipInput.value = "";
                modalIP.classList.remove('active'); // Pastikan modal ketutup
                
                // Matikan saklar AI kalau posisinya lagi nyala
                const btnToggleAI = document.getElementById('btnToggleAI');
                if(btnToggleAI && isAIActive) {
                    btnToggleAI.click(); // Trigger klik palsu buat matiin AI
                }
            }
        });
    }

    // Tombol Setting di Navbar Atas (Buat buka drawer)
    if (btnSettings) {
        btnSettings.addEventListener('click', openDrawer);
    }


    // ==================================================
    // 3. KONTROL RESOLUSI ESP32 (Di dalam Drawer)
    // ==================================================
    const resSelect = document.getElementById('resSelect');
    if (resSelect) {
        resSelect.addEventListener('change', async (e) => {
            const val = e.target.value;
            document.body.style.cursor = 'wait';
            resSelect.disabled = true;

            try {
                const res = await fetch('/api/set_resolution', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ val: val })
                });

                const data = await res.json();
                if (data.status !== 'success') {
                    alert("Gagal ubah resolusi: " + data.message);
                    resSelect.value = "6"; 
                }
            } catch (err) {
                alert("Server error saat ganti resolusi.");
                resSelect.value = "6";
            } finally {
                document.body.style.cursor = 'default';
                resSelect.disabled = false;
            }
        });
    }


    // ==================================================
    // 4. KONTROL LENSA & VISUAL (Di dalam Drawer)
    // ==================================================
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
                const val = parseInt(e.target.value);
                valDisplay.textContent = val > 0 ? `+${val}` : val;
            });

            slider.addEventListener('change', async (e) => {
                try {
                    await fetch('/api/cam_control', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ var: ctrl.varName, val: e.target.value })
                    });
                } catch (err) {
                    console.error(`Gagal merubah ${ctrl.varName}`);
                }
            });
        }
    });


    // ==================================================
    // 5. LOGIKA UPLOAD MODEL AI (.pt)
    // ==================================================
    const uploadBtn = document.getElementById('uploadModelBtn');
    const uploadStatus = document.getElementById('uploadStatus');
    const aiModelSelect = document.getElementById('aiModel');

    if (uploadBtn && uploadStatus && aiModelSelect) {
        uploadBtn.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.name.endsWith('.pt')) {
                alert("Hanya file model (.pt) yang diizinkan untuk engine AI!");
                uploadBtn.value = "";
                return;
            }

            if (file.size > 50 * 1024 * 1024) {
                alert("Ukuran file melebihi batas (Maks 50MB).");
                uploadBtn.value = "";
                return;
            }

            const formData = new FormData();
            formData.append('file', file);

            uploadStatus.style.display = 'block';
            uploadStatus.textContent = 'Memverifikasi keamanan & mengunggah...';
            uploadStatus.style.color = 'var(--text-muted)';

            try {
                const res = await fetch('/api/upload_model', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (data.status === 'success') {
                    uploadStatus.textContent = 'Berhasil! Model siap digunakan.';
                    uploadStatus.style.color = '#10B981';

                    const newOption = document.createElement('option');
                    newOption.value = data.filename;
                    newOption.textContent = `${data.filename} (Baru)`;
                    aiModelSelect.appendChild(newOption);
                    aiModelSelect.value = data.filename;

                    aiModelSelect.dispatchEvent(new Event('change'));
                } else {
                    uploadStatus.textContent = `Ditolak: ${data.message}`;
                    uploadStatus.style.color = '#E11D48';
                }
            } catch (err) {
                uploadStatus.textContent = 'Koneksi ke server terputus.';
                uploadStatus.style.color = '#E11D48';
            } finally {
                uploadBtn.value = "";
                setTimeout(() => { uploadStatus.style.display = 'none'; }, 4000);
            }
        });
    }

    // ==================================================
    // 6. KONTROL CONFIDENCE (ANTI-ZOMBIE FIX)
    // ==================================================
    const aiConfidenceSliders = document.querySelectorAll('[id="aiConfidence"]');
    const valConfTexts = document.querySelectorAll('[id="valConf"]');

    aiConfidenceSliders.forEach(slider => {
        slider.addEventListener('input', (e) => {
            const newVal = parseFloat(e.target.value).toFixed(2);
            valConfTexts.forEach(txt => {
                txt.textContent = newVal;
            });
            aiConfidenceSliders.forEach(otherSlider => {
                if (otherSlider !== slider) otherSlider.value = e.target.value;
            });
        });

        slider.addEventListener('change', async (e) => {
            try {
                await fetch('/api/set_ai_params', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ confidence: e.target.value })
                });
            } catch (err) {
                console.error("Gagal update confidence AI");
            }
        });
    });


    // ==================================================
    // 7. SAKLAR DETEKSI AI (ON/OFF)
    // ==================================================
    const btnToggleAI = document.getElementById('btnToggleAI');
    const aiStatusBadge = document.getElementById('aiStatusBadge');
    const aiStatusText = document.getElementById('aiStatusText');
    let isAIActive = false;

    if (btnToggleAI) {
        btnToggleAI.addEventListener('click', async () => {
            isAIActive = !isAIActive; // Ganti status

            if (isAIActive) {
                // UI Saat AI Menyala
                btnToggleAI.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> <span>Jeda Deteksi AI</span>`;
                btnToggleAI.style.background = "rgba(15, 23, 42, 0.8)";
                btnToggleAI.style.backdropFilter = "blur(4px)";
                btnToggleAI.style.boxShadow = "0 4px 15px rgba(0,0,0,0.3)";
                btnToggleAI.style.border = "1px solid rgba(255,255,255,0.2)";

                if (aiStatusBadge && aiStatusText) {
                    aiStatusBadge.style.background = "rgba(16, 185, 129, 0.8)"; 
                    aiStatusText.textContent = "AI DETECTING";
                }
            } else {
                // UI Saat AI Mati
                btnToggleAI.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> <span>Mulai Deteksi AI</span>`;
                btnToggleAI.style.background = "var(--primary)";
                btnToggleAI.style.backdropFilter = "none";
                btnToggleAI.style.boxShadow = "0 4px 20px rgba(225,29,72,0.5)";
                btnToggleAI.style.border = "none";

                if (aiStatusBadge && aiStatusText) {
                    aiStatusBadge.style.background = "rgba(225, 29, 72, 0.8)";
                    aiStatusText.textContent = "AI STANDBY (OFF)";
                }
            }

            // Kirim perintah on/off ke Flask
            try {
                await fetch('/api/toggle_ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ active: isAIActive })
                });
            } catch (err) {
                console.error("Gagal mengirim status AI");
            }
        });
    }

}); // AKHIR DARI DOMContentLoaded