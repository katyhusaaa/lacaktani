// static/js/main.js

import { initUIDrawer, initPremiumPopup } from './ui.js';
import { initAuth, initLogout } from './auth.js';
// 👇 PERHATIKAN BARIS INI: initDragAndDropModel udah gw tambahin di sini
import { initCameraStream, initAIControls, initPatrolSession, initHardwareSliders, initDragAndDropModel } from './camera_engine.js';

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
        
        // 👇 PERHATIKAN BARIS INI: Fungsinya sekarang dipanggil!
        initDragAndDropModel(); 
    }

});