/**
 * LacakTani Pro — Main Controller
 */
import * as API from './modules/api.js';
import * as UI from './modules/ui.js';

let selectedFiles = [];
let batchResults = [];
let chartData = { matang: [], mentah: [], berbunga: [], labels: [] };
let statsChart = null;

document.addEventListener('DOMContentLoaded', () => {
    UI.setDate('currentDate');
    UI.initTheme();
    initChart();
    loadModelList();
    loadHistory();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('themeToggle')?.addEventListener('click', UI.toggleTheme);
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => UI.switchTab(btn.getAttribute('data-target')));
    });

    // Settings
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files);
        });
        fileInput.addEventListener('change', e => e.target.files?.length && handleFileSelect(e.target.files));
    }

    document.querySelector('.btn-save-settings')?.addEventListener('click', handleSaveSettings);
    document.querySelector('.btn-upload-model')?.addEventListener('click', handleUploadModel);
    document.getElementById('btnDetectSettings')?.addEventListener('click', runBatchDetection);

    // Live Cam
    document.getElementById('btnConnectCam')?.addEventListener('click', () => UI.toast('Fitur Live Cam coming soon', 'info'));
    document.getElementById('btnExportHistory')?.addEventListener('click', () => window.location.href = '/api/export_history');
}

function handleFileSelect(files) {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (arr.length === 0) return UI.toast('Pilih file gambar', 'error');
    selectedFiles = arr;
    renderSelectedFiles();
    const settingsDetectBtn = document.getElementById('btnDetectSettings');
    if (settingsDetectBtn) settingsDetectBtn.disabled = false;
    UI.toast(`${arr.length} gambar dipilih`, 'success');
}

function renderSelectedFiles() {
    const el = document.getElementById('selectedFiles');
    if (!el) return;
    el.innerHTML = selectedFiles.length ? `
        <div class="selected-count">${selectedFiles.length} file dipilih</div>
        <div class="selected-names">${selectedFiles.map(f => f.name).slice(0, 5).join(', ')}${selectedFiles.length > 5 ? '...' : ''}</div>
    ` : '';
}

async function runBatchDetection() {
    if (!selectedFiles.length) return UI.toast('Pilih gambar dulu', 'error');
    const btn = document.getElementById('btnDetectSettings');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...'; }
    batchResults = [];

    const container = document.getElementById('batchResults');
    const placeholder = document.getElementById('batchPlaceholder');
    if (placeholder) placeholder.classList.add('hidden');
    if (container) container.innerHTML = '';

    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        try {
            const formData = new FormData();
            formData.append('file', file);
            const data = await API.postPredict(formData);
            if (data.image_data && data.stats) {
                const origUrl = URL.createObjectURL(file);
                batchResults.push({
                    original: origUrl,
                    result: 'data:image/jpeg;base64,' + data.image_data,
                    stats: data.stats,
                    top: data.top_detection
                });
                appendBatchResult(origUrl, data.image_data, data.stats, data.top_detection, container);
                await saveToHistory(file, data);
                updateChart(data.stats);
            }
        } catch (e) {
            UI.toast(`Gagal: ${file.name}`, 'error');
        }
    }

    if (batchResults.length > 0) {
        showLastCompare();
        updateStats(batchResults[batchResults.length - 1].stats, batchResults[batchResults.length - 1].top);
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-sparkles"></i> Jalankan Deteksi'; }
    UI.toast(`Selesai: ${batchResults.length}/${selectedFiles.length} berhasil`, 'success');
}

function appendBatchResult(origUrl, resultB64, stats, top, container) {
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'batch-item';
    div.innerHTML = `
        <div class="batch-compare">
            <div><img src="${origUrl}" alt="Original"></div>
            <div><img src="data:image/jpeg;base64,${resultB64}" alt="Result"></div>
        </div>
        <div class="batch-meta">
            <span>M:${stats?.matang || 0} | N:${stats?.mentah || 0} | B:${stats?.berbunga || 0}</span>
            ${top ? `<span class="top-badge">${top.label} ${(top.confidence * 100).toFixed(0)}%</span>` : ''}
        </div>
    `;
    container.appendChild(div);
}

function showLastCompare() {
    const last = batchResults[batchResults.length - 1];
    const placeholder = document.getElementById('comparePlaceholder');
    const split = document.getElementById('compareSplit');
    const topDiv = document.getElementById('topDetection');
    const origImg = document.getElementById('compareOriginal');
    const resultImg = document.getElementById('compareResult');
    if (placeholder) placeholder.classList.add('hidden');
    if (split) split.classList.remove('hidden');
    if (topDiv) topDiv.classList.remove('hidden');
    if (origImg) origImg.src = last.original;
    if (resultImg) resultImg.src = last.result;
}

function updateStats(stats, top) {
    ['matang', 'mentah', 'berbunga'].forEach(k => {
        const el = document.getElementById('stat' + k.charAt(0).toUpperCase() + k.slice(1));
        if (el) el.textContent = stats?.[k] ?? 0;
    });
    const labelEl = document.getElementById('topLabel');
    const confEl = document.getElementById('topConf');
    const matangEl = document.getElementById('matangCount');
    if (labelEl) labelEl.textContent = top?.label || '—';
    if (confEl) confEl.textContent = top ? (top.confidence * 100).toFixed(1) + '%' : '—';
    if (matangEl) matangEl.textContent = top?.matang_siap_panen ?? stats?.matang ?? 0;
}

async function saveToHistory(file, data) {
    const reader = new FileReader();
    reader.onload = async () => {
        const b64 = reader.result.split(',')[1];
        await API.saveHistory({
            created_at: new Date().toISOString(),
            result_b64: data.image_data,
            matang: data.stats?.matang || 0,
            mentah: data.stats?.mentah || 0,
            berbunga: data.stats?.berbunga || 0,
            top_label: data.top_detection?.label || '',
            top_confidence: data.top_detection?.confidence || 0
        });
    };
    reader.readAsDataURL(file);
}

function updateChart(stats) {
    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    chartData.labels.push(now);
    chartData.matang.push(stats?.matang || 0);
    chartData.mentah.push(stats?.mentah || 0);
    chartData.berbunga.push(stats?.berbunga || 0);
    if (chartData.labels.length > 20) {
        chartData.labels.shift();
        chartData.matang.shift();
        chartData.mentah.shift();
        chartData.berbunga.shift();
    }
    if (statsChart) statsChart.update();
}

function initChart() {
    const ctx = document.getElementById('statsChart')?.getContext('2d');
    if (!ctx) return;
    statsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                { label: 'Matang', data: chartData.matang, borderColor: '#dc2626', tension: 0.3, fill: true },
                { label: 'Mentah', data: chartData.mentah, borderColor: '#16a34a', tension: 0.3, fill: true },
                { label: 'Berbunga', data: chartData.berbunga, borderColor: '#ca8a04', tension: 0.3, fill: true }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'top' } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

async function loadModelList() {
    const container = document.getElementById('modelList');
    if (!container) return;
    try {
        const data = await API.getModelList();
        if (data.models && data.models.length) {
            container.innerHTML = data.models.map(m => `
                <div class="model-item ${m === data.current ? 'active' : ''}" data-model="${m}">
                    <span>${m}</span>
                    <div class="model-actions">
                        <button class="btn-select ${m === data.current ? 'selected' : ''}" data-model="${m}" title="Pilih">${m === data.current ? 'Aktif' : 'Pilih'}</button>
                        <button class="btn-delete" data-model="${m}" title="Hapus" ${m === data.current ? 'disabled' : ''}><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `).join('');
            container.querySelectorAll('.btn-select').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const m = btn.getAttribute('data-model');
                    const res = await API.postChangeModel(m);
                    if (res.status === 'success') {
                        loadModelList();
                        UI.toast(`Model: ${m}`, 'success');
                    } else UI.toast(res.message || 'Gagal', 'error');
                });
            });
            container.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const m = btn.getAttribute('data-model');
                    if (!confirm(`Hapus model ${m}?`)) return;
                    const res = await API.postDeleteModel(m);
                    if (res.status === 'success') {
                        loadModelList();
                        UI.toast('Model dihapus', 'success');
                    } else UI.toast(res.message || 'Gagal', 'error');
                });
            });
        } else {
            container.innerHTML = '<div class="model-empty">Belum ada model. Upload file .pt di bawah.</div>';
        }
    } catch (e) {
        container.innerHTML = '<div class="model-error">Gagal memuat</div>';
    }
}

async function handleSaveSettings(e) {
    const btn = e.target;
    const range = document.getElementById('confRange');
    if (!range) return;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
    try {
        const res = await API.postSettings(range.value);
        if (res.status === 'success') UI.toast('Konfigurasi tersimpan', 'success');
        else UI.toast('Gagal', 'error');
    } catch (e) {
        UI.toast('Error', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Simpan';
    }
}

function handleUploadModel() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pt';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const btn = document.querySelector('.btn-upload-model');
        const orig = btn?.innerHTML;
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Upload...'; }
        try {
            const formData = new FormData();
            formData.append('model_file', file);
            const res = await API.postUploadModel(formData);
            if (res.status === 'success') {
                loadModelList();
                UI.toast(`Upload sukses: ${res.model_name}`, 'success');
            } else UI.toast(res.message || 'Gagal', 'error');
        } catch (e) {
            UI.toast('Error', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = orig; }
        }
    };
    input.click();
}

async function loadHistory() {
    const listEl = document.getElementById('historyList');
    const emptyEl = document.getElementById('historyEmpty');
    if (!listEl) return;
    try {
        const data = await API.getHistory();
        const items = data.history || [];
        // Populate chart from history
        const chartItems = items.slice(0, 20).reverse();
        chartItems.forEach(h => {
            chartData.labels.push(new Date(h.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
            chartData.matang.push(h.matang || 0);
            chartData.mentah.push(h.mentah || 0);
            chartData.berbunga.push(h.berbunga || 0);
        });
        if (chartItems.length && statsChart) statsChart.update();
        if (items.length === 0) {
            if (emptyEl) emptyEl.classList.remove('hidden');
            listEl.querySelectorAll('.history-item').forEach(el => el.remove());
        } else {
            if (emptyEl) emptyEl.classList.add('hidden');
            listEl.querySelectorAll('.history-item').forEach(el => el.remove());
            items.forEach(h => {
                const div = document.createElement('div');
                div.className = 'history-item card';
                div.innerHTML = `
                    <div class="history-thumb"><img src="data:image/jpeg;base64,${h.result_b64 || ''}" alt=""></div>
                    <div class="history-info">
                        <span class="history-date">${new Date(h.created_at).toLocaleString('id-ID')}</span>
                        <span class="history-stats">M:${h.matang} N:${h.mentah} B:${h.berbunga}</span>
                        ${h.top_label ? `<span class="history-top">${h.top_label} ${((h.top_confidence || 0) * 100).toFixed(0)}%</span>` : ''}
                    </div>
                    <button class="btn-delete-history" data-id="${h.id}"><i class="fa-solid fa-trash"></i></button>
                `;
                div.querySelector('.btn-delete-history')?.addEventListener('click', async () => {
                    await API.deleteHistory(h.id);
                    loadHistory();
                    UI.toast('Riwayat dihapus', 'success');
                });
                listEl.insertBefore(div, emptyEl);
            });
        }
    } catch (e) {
        if (emptyEl) emptyEl.classList.remove('hidden');
    }
}

