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
    // Logika Drawer Pengaturan
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
    // Logika Pop-up Iseng (Paywall)
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