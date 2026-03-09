// static/js/main.js

import { initUIDrawer, initPremiumPopup } from './ui.js';
import { initAuth, initLogout, initProfile } from './auth.js';
import { initCameraStream, initAIControls, initPatrolSession, initHardwareSliders, initDragAndDropModel } from './camera_engine.js';

// --- FUNGSI GLOBAL LOG SYSTEM (WAJIB ADA DI SINI) ---
window.addLogToConsole = function(msg) {
    const consoleEl = document.getElementById('systemConsole');
    if (!consoleEl) return;
    
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    const newLog = document.createElement('div');
    newLog.className = 'log-entry';
    newLog.innerHTML = `<span class="log-time">${timeStr}</span> ${msg}`;
    
    consoleEl.appendChild(newLog);
    consoleEl.scrollTop = consoleEl.scrollHeight; // Auto scroll ke bawah
};

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Inisialisasi Auth (Landing Page)
    initAuth();
    initPremiumPopup();

    // 2. Inisialisasi Dashboard & Hardware (Jika elemen Dashboard ada)
    const phaseDashboard = document.getElementById('networkStatusBadge'); // Pake patokan badge sinyal
    if (phaseDashboard) {
        initLogout();
        initUIDrawer();
        initCameraStream();
        initAIControls();
        initPatrolSession();
        initHardwareSliders();
        initProfile();
        initDragAndDropModel(); 
    }
});