// static/js/main.js

import { initUIDrawer, initPremiumPopup } from './ui.js';
import { initAuth, initLogout } from './auth.js';
import { initCameraStream, initAIControls, initPatrolSession, initHardwareSliders } from './camera_engine.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Inisialisasi Auth (Landing Page)
    initAuth();
    initPremiumPopup();

    // 2. Inisialisasi Dashboard & Hardware (Jika elemen Dashboard ada)
    const phaseDashboard = document.getElementById('phaseDashboard');
    if (phaseDashboard) {
        initLogout();
        initUIDrawer();
        initCameraStream();
        initAIControls();
        initPatrolSession();
        initHardwareSliders();
        
        // Logika Upload Model .pt (Bisa ditambahkan jadi module terpisah kalau mau)
        // ... (Logika upload model tetap ditaruh disini atau dipindah ke ai_engine.js nanti)
    }

});