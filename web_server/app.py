from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from functools import wraps
from detection import get_prediction, load_custom_model
import os
import sqlite3
import base64
import csv
import io
from werkzeug.security import check_password_hash, generate_password_hash
from datetime import datetime

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'lacaktani-pro-secret-key-change-in-production')

# Konfigurasi
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_FOLDER = os.path.join(BASE_DIR, '..', 'business-logic', 'models')
DB_PATH = os.path.join(BASE_DIR, '..', 'lacaktani.db')

if not os.path.exists(MODELS_FOLDER):
    os.makedirs(MODELS_FOLDER)

# Default credentials: admin/admin (hashed)
DEFAULT_USER = 'admin'
DEFAULT_PASS_HASH = generate_password_hash('admin', method='pbkdf2:sha256')

APP_SETTINGS = {
    'confidence': 0.4,
    'current_model': 'best.pt'
}


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT,
        original_b64 TEXT,
        result_b64 TEXT,
        matang INTEGER,
        mentah INTEGER,
        berbunga INTEGER,
        top_label TEXT,
        top_confidence REAL
    )''')
    conn.commit()
    conn.close()


init_db()


@app.route('/login', methods=['GET', 'POST'])
def login():
    if session.get('logged_in'):
        return redirect(url_for('index'))
    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        if username == DEFAULT_USER and check_password_hash(DEFAULT_PASS_HASH, password):
            session['logged_in'] = True
            session['username'] = username
            return redirect(url_for('index'))
        error = 'Username atau password salah'
    return render_template('login.html', error=error or None)


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.route('/')
@login_required
def index():
    return render_template('index.html', username=session.get('username', 'User'))


@app.route('/predict', methods=['POST'])
@login_required
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    allowed = {'image/jpeg', 'image/png', 'image/webp', 'image/jpg'}
    if file.content_type and file.content_type.lower() not in allowed:
        return jsonify({'error': 'Format tidak didukung'}), 400
    raw = file.read()
    if len(raw) > 10 * 1024 * 1024:
        return jsonify({'error': 'File terlalu besar (max 10MB)'}), 400
    result = get_prediction(raw, conf_threshold=APP_SETTINGS['confidence'])
    if result is None:
        return jsonify({'error': 'Model Error'}), 500
    return jsonify(result)


@app.route('/api/settings', methods=['POST'])
@login_required
def update_settings():
    data = request.json
    if data and 'confidence' in data:
        try:
            val = float(data['confidence'])
            if 0.1 <= val <= 0.9:
                APP_SETTINGS['confidence'] = val
                return jsonify({'status': 'success'})
        except (ValueError, TypeError):
            pass
    return jsonify({'status': 'error'}), 400


@app.route('/api/upload_model', methods=['POST'])
@login_required
def upload_model():
    if 'model_file' not in request.files:
        return jsonify({'status': 'error', 'message': 'No file'}), 400
    file = request.files['model_file']
    if not file or file.filename == '':
        return jsonify({'status': 'error', 'message': 'No file'}), 400
    if not file.filename.lower().endswith('.pt'):
        return jsonify({'status': 'error', 'message': 'Hanya file .pt'}), 400
    safe_name = os.path.basename(file.filename)
    filepath = os.path.join(MODELS_FOLDER, safe_name)
    file.save(filepath)
    success, msg = load_custom_model(filepath)
    if success:
        APP_SETTINGS['current_model'] = safe_name
        return jsonify({'status': 'success', 'model_name': safe_name})
    return jsonify({'status': 'error', 'message': msg}), 500


@app.route('/api/list_models', methods=['GET'])
@login_required
def list_models():
    try:
        files = [f for f in os.listdir(MODELS_FOLDER) if f.endswith('.pt')]
        return jsonify({'models': files, 'current': APP_SETTINGS['current_model']})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/change_model', methods=['POST'])
@login_required
def change_model():
    data = request.json
    model_name = data.get('model_name')
    if not model_name:
        return jsonify({'status': 'error', 'message': 'Model name required'}), 400
    filepath = os.path.join(MODELS_FOLDER, model_name)
    if os.path.exists(filepath):
        success, msg = load_custom_model(filepath)
        if success:
            APP_SETTINGS['current_model'] = model_name
            return jsonify({'status': 'success', 'current': model_name})
        return jsonify({'status': 'error', 'message': msg}), 500
    return jsonify({'status': 'error', 'message': 'File tidak ditemukan'}), 404


@app.route('/api/delete_model', methods=['POST'])
@login_required
def delete_model():
    data = request.json
    model_name = data.get('model_name')
    if not model_name:
        return jsonify({'status': 'error', 'message': 'Model name required'}), 400
    if model_name == APP_SETTINGS['current_model']:
        return jsonify({'status': 'error', 'message': 'Tidak bisa hapus model aktif'}), 400
    filepath = os.path.join(MODELS_FOLDER, model_name)
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
            return jsonify({'status': 'success'})
        except Exception as e:
            return jsonify({'status': 'error', 'message': str(e)}), 500
    return jsonify({'status': 'error', 'message': 'File tidak ditemukan'}), 404


@app.route('/api/history', methods=['GET'])
@login_required
def get_history():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT id, created_at, result_b64, matang, mentah, berbunga, top_label, top_confidence FROM history ORDER BY id DESC LIMIT 100')
    rows = c.fetchall()
    conn.close()
    data = []
    for r in rows:
        data.append({
            'id': r[0], 'created_at': r[1], 'result_b64': r[2],
            'matang': r[3], 'mentah': r[4], 'berbunga': r[5],
            'top_label': r[6], 'top_confidence': r[7]
        })
    return jsonify({'history': data})


@app.route('/api/history', methods=['POST'])
@login_required
def save_history():
    data = request.json
    if not data:
        return jsonify({'status': 'error'}), 400
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''INSERT INTO history (created_at, original_b64, result_b64, matang, mentah, berbunga, top_label, top_confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)''', (
        data.get('created_at', datetime.now().isoformat()),
        data.get('original_b64', ''),
        data.get('result_b64', ''),
        data.get('matang', 0),
        data.get('mentah', 0),
        data.get('berbunga', 0),
        data.get('top_label', ''),
        data.get('top_confidence', 0)
    ))
    conn.commit()
    hid = c.lastrowid
    conn.close()
    return jsonify({'status': 'success', 'id': hid})


@app.route('/api/history/<int:hid>', methods=['DELETE'])
@login_required
def delete_history(hid):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('DELETE FROM history WHERE id = ?', (hid,))
    conn.commit()
    conn.close()
    return jsonify({'status': 'success'})


@app.route('/api/export_history')
@login_required
def export_history():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT created_at, matang, mentah, berbunga, top_label, top_confidence FROM history ORDER BY id DESC')
    rows = c.fetchall()
    conn.close()
    output = io.StringIO()
    w = csv.writer(output)
    w.writerow(['Tanggal', 'Matang', 'Mentah', 'Berbunga', 'Klasifikasi Tertinggi', 'Confidence'])
    for r in rows:
        w.writerow([r[0], r[1], r[2], r[3], r[4] or '-', f"{float(r[5] or 0):.0%}"])
    output.seek(0)
    from flask import Response
    return Response(output.getvalue(), mimetype='text/csv',
                    headers={'Content-Disposition': 'attachment; filename=riwayat_lacaktani.csv'})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
