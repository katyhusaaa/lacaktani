/**
 * UI MODULE
 */

// --- TOAST ---
export function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
    el.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

// --- DATE ---
export function setDate(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
}

// --- TABS ---
export function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
        el.classList.add('hidden');
    });
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    const target = document.getElementById(tabId);
    if (target) {
        target.classList.remove('hidden');
        setTimeout(() => target.classList.add('active'), 50);
    }
    const btn = document.querySelector(`.nav-item[data-target="${tabId}"]`);
    if (btn) btn.classList.add('active');
}

// --- THEME ---
export function initTheme() {
    const isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) document.body.setAttribute('data-theme', 'dark');
    updateThemeIcon(isDark);
}

export function toggleTheme() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
    updateThemeIcon(!isDark);
}

function updateThemeIcon(isDark) {
    const btn = document.getElementById('themeToggle');
    if (btn) btn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}
