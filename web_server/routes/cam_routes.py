# routes/cam_routes.py
import os
import requests
from urllib.parse import urlparse
from flask import Blueprint, request, jsonify, Response, current_app
from werkzeug.utils import secure_filename
from flask_login import login_required, current_user

from extensions import db
from core.camera_state import cam_state
from core.vision import generate_frames
from detection import get_prediction

cam_bp = Blueprint('cam', __name__)

ALLOWED_EXTENSIONS = {'pt'}
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@cam_bp.route('/api/connect_cam', methods=['POST'])
def connect_cam():
    data = request.json
    ip_address = data.get('ip')
    
    if not ip_address:
        return jsonify({'status': 'error', 'message': 'IP Address kosong!'}), 400

    test_url = f"http://{ip_address}:81/stream"
    try:
        response = requests.get(test_url, stream=True, timeout=3)
        if response.status_code == 200:
            cam_state.ACTIVE_CAMERA_URL = test_url
            return jsonify({'status': 'success', 'message': 'Kamera terhubung!'})
        else:
            return jsonify({'status': 'error', 'message': f'Kamera menolak (Status: {response.status_code}).'}), 404
    except requests.exceptions.RequestException:
        return jsonify({'status': 'error', 'message': f'Kamera di IP {ip_address} mati/tidak merespon.'}), 404

@cam_bp.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'Tidak ada file yang diupload'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'File kosong'}), 400

    raw_bytes = file.read()
    result = get_prediction(raw_bytes)
    if result is None:
        return jsonify({'error': 'Gagal memproses gambar'}), 500
    return jsonify(result)

@cam_bp.route('/video_feed')
def video_feed():
    # Manggil loop generator dari core/vision.py
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@cam_bp.route('/api/set_resolution', methods=['POST'])
def set_resolution():
    if not cam_state.ACTIVE_CAMERA_URL:
        return jsonify({'status': 'error', 'message': 'Kamera belum terhubung'}), 400

    data = request.json
    val = data.get('val') 
    ip_address = urlparse(cam_state.ACTIVE_CAMERA_URL).hostname 
    
    try:
        response = requests.get(f"http://{ip_address}/control?var=framesize&val={val}", timeout=3)
        if response.status_code == 200:
            return jsonify({'status': 'success'})
        return jsonify({'status': 'error', 'message': 'ESP32 menolak perintah'})
    except Exception:
        return jsonify({'status': 'error', 'message': 'Gagal menghubungi ESP32'}), 500
    
@cam_bp.route('/api/cam_control', methods=['POST'])
@login_required
def cam_control():
    data = request.json
    var_name = data.get('var') 
    val = int(data.get('val'))      
    
    # Simpan status ke tabel User
    if var_name == 'brightness': current_user.cam_bright = val
    elif var_name == 'contrast': current_user.cam_contrast = val
    elif var_name == 'saturation': current_user.cam_sat = val
    elif var_name == 'ae_level': current_user.cam_exp = val
    elif var_name == 'vflip': current_user.cam_vflip = val
    elif var_name == 'hmirror': current_user.cam_hmirror = val
    elif var_name == 'awb': current_user.cam_awb = val
    elif var_name == 'aec': current_user.cam_aec = val
    elif var_name == 'lenc': current_user.cam_lenc = val
    db.session.commit()

    if cam_state.ACTIVE_CAMERA_URL:
        ip = urlparse(cam_state.ACTIVE_CAMERA_URL).hostname 
        try: requests.get(f"http://{ip}/control?var={var_name}&val={val}", timeout=2)
        except: pass
    return jsonify({'status': 'success'})

@cam_bp.route('/api/upload_model', methods=['POST'])
def upload_model():
    if 'file' not in request.files: return jsonify({'status': 'error', 'message': 'No file'}), 400
    file = request.files['file']
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        # Gunakan current_app.config karena blueprint ga punya akses langsung ke app.config
        os.makedirs(current_app.config['UPLOAD_FOLDER'], exist_ok=True)
        file.save(os.path.join(current_app.config['UPLOAD_FOLDER'], filename))
        return jsonify({'status': 'success', 'message': 'Model diamankan', 'filename': filename})
    return jsonify({'status': 'error', 'message': 'Hanya file .pt!'}), 400

@cam_bp.route('/api/set_ai_params', methods=['POST'])
def set_ai_params():
    data = request.json
    if 'confidence' in data:
        cam_state.AI_CONFIDENCE = float(data['confidence'])
        print(f"[INFO] Confidence diubah ke: {cam_state.AI_CONFIDENCE}")
    if 'model' in data:
        cam_state.CURRENT_MODEL = data['model']
        print(f"[INFO] Model diubah ke: {cam_state.CURRENT_MODEL}")
    return jsonify({'status': 'success'})

@cam_bp.route('/api/toggle_ai', methods=['POST'])
def toggle_ai():
    cam_state.AI_ACTIVE = request.json.get('active', False)
    status_text = "AKTIF" if cam_state.AI_ACTIVE else "MATI"
    print(f"[INFO] Engine YOLOv5 sekarang: {status_text}")
    return jsonify({'status': 'success', 'ai_active': cam_state.AI_ACTIVE})

@cam_bp.route('/api/stream_stats')
def stream_stats():
    # Mengirim data langsung dari brankas (camera_state)
    return jsonify({
        'fps': cam_state.current_fps,
        'matang': cam_state.count_matang, 
        'mentah': cam_state.count_mentah,
        'bunga': cam_state.count_bunga
    })