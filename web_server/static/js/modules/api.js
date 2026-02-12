/**
 * API MODULE
 */

const API_BASE = '';

export async function postPredict(formData) {
    const r = await fetch(API_BASE + '/predict', { method: 'POST', body: formData });
    return r.json();
}

export async function postSettings(confidenceValue) {
    const r = await fetch(API_BASE + '/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confidence: parseFloat(confidenceValue) })
    });
    return r.json();
}

export async function getModelList() {
    const r = await fetch(API_BASE + '/api/list_models');
    return r.json();
}

export async function postChangeModel(modelName) {
    const r = await fetch(API_BASE + '/api/change_model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: modelName })
    });
    return r.json();
}

export async function postDeleteModel(modelName) {
    const r = await fetch(API_BASE + '/api/delete_model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: modelName })
    });
    return r.json();
}

export async function postUploadModel(formData) {
    const r = await fetch(API_BASE + '/api/upload_model', { method: 'POST', body: formData });
    return r.json();
}

export async function getHistory() {
    const r = await fetch(API_BASE + '/api/history');
    return r.json();
}

export async function saveHistory(data) {
    const r = await fetch(API_BASE + '/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return r.json();
}

export async function deleteHistory(id) {
    const r = await fetch(API_BASE + '/api/history/' + id, { method: 'DELETE' });
    return r.json();
}
