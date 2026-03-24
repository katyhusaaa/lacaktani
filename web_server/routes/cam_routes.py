# routes/cam_routes.py
import os
import requests
from urllib.parse import urlparse
from flask import Blueprint, request, jsonify, Response, current_app
from werkzeug.utils import secure_filename
from flask_login import login_required, current_user

from db_models import FlightSession, DetectionLog
from datetime import datetime

from extensions import db
from core.camera_state import cam_state
from core.vision import generate_frames
from detection import get_prediction

from detection import reset_tracker
from detection import change_model

import socket
from concurrent.futures import ThreadPoolExecutor

import logging # Tambahin import ini di atas file

cam_bp = Blueprint('cam', __name__)

ALLOWED_EXTENSIONS = {'pt'}
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@cam_bp.route('/api/connect_cam', methods=['POST'])
@login_required
def connect_cam():
    data = request.json
    cam_type = data.get('type', 'esp32') # Cek tipe kameranya (esp32 atau webcam)

    # JIKA USER PILIH WEBCAM / DROIDCAM
    if cam_type == 'webcam':
        cam_index = data.get('index')
        if cam_index is None:
            return jsonify({'status': 'error', 'message': 'Pilih kamera dulu!'}), 400
        
        # PENTING: Ubah tipe data jadi Integer. cv2.VideoCapture(0) butuh angka!
        cam_state.ACTIVE_CAMERA_URL = int(cam_index) 
        return jsonify({'status': 'success', 'message': 'Kamera Lokal terhubung!'})

    # JIKA USER PILIH ESP32
    else:
        ip_address = data.get('ip')
        if not ip_address:
            return jsonify({'status': 'error', 'message': 'IP Address kosong!'}), 400

        test_url = f"http://{ip_address}:81/stream"
        try:
            # Ketuk pintu ESP32 nya dulu buat ngetes
            response = requests.get(test_url, stream=True, timeout=3)
            if response.status_code == 200:
                cam_state.ACTIVE_CAMERA_URL = test_url # Berupa String URL
                return jsonify({'status': 'success', 'message': 'Kamera ESP32 terhubung!'})
            else:
                return jsonify({'status': 'error', 'message': f'Kamera menolak (Status: {response.status_code}).'}), 404
        except requests.exceptions.RequestException:
            return jsonify({'status': 'error', 'message': f'Kamera di IP {ip_address} mati/tidak merespon.'}), 404

@cam_bp.route('/predict', methods=['POST'])
@login_required
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
@login_required
def video_feed():
    # Manggil loop generator dari core/vision.py
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@cam_bp.route('/api/set_resolution', methods=['POST'])
@login_required
def set_resolution():
    if not cam_state.ACTIVE_CAMERA_URL:
        return jsonify({'status': 'error', 'message': 'Kamera belum terhubung'}), 400

    data = request.json
    val = data.get('val') 
    ip_address = urlparse(cam_state.ACTIVE_CAMERA_URL).hostname 
    
    try:
        response = requests.get(f"http://{ip_address}/control?var=framesize&val={val}", timeout=3)
        if response.status_code == 200:
            # Simpan resolusi yang baru dipilih ke database profil user
            current_user.cam_res = str(val)
            db.session.commit()
            return jsonify({'status': 'success'})
        return jsonify({'status': 'error', 'message': 'ESP32 menolak perintah'})
    except Exception:
        return jsonify({'status': 'error', 'message': 'Gagal menghubungi ESP32'}), 500
    
@cam_bp.route('/api/cam_control', methods=['POST'])
@login_required
def cam_control():
    data = request.json
    var_name = data.get('var') 
    raw_val = data.get('val')      
    
    # 1. KHUSUS AI CONFIDENCE (Pakai Float / Desimal)
    if var_name == 'ai_conf':
        new_conf = float(raw_val)
        current_user.ai_conf = new_conf
        cam_state.AI_CONFIDENCE = new_conf # <-- INI KUNCI UTAMANYA! Update state memori
        db.session.commit()
        return jsonify({'status': 'success'})

    # ==========================================
    # 2. KHUSUS ROTASI & FLIP (Simpan ke cam_state biar dibaca vision.py)
    # ==========================================
    if var_name in ['rotate', 'hflip']:
        val_str = str(raw_val)
        if var_name == 'rotate': 
            current_user.cam_rotate = val_str # Simpan ke DB biar permanen
            cam_state.cam_rotate = val_str    # Simpan ke RAM biar langsung diputar
        elif var_name == 'hflip': 
            current_user.cam_hflip = val_str
            cam_state.cam_hflip = val_str
        db.session.commit()
        return jsonify({'status': 'success'})

    # 3. KHUSUS HARDWARE ESP32 (Pakai Integer / Bilangan Bulat)
    val = int(float(raw_val))
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
        # PENTING: Tambahin str() biar aman kalau lagi pake Index Webcam (angka 0)
        ip = urlparse(str(cam_state.ACTIVE_CAMERA_URL)).hostname 
        try: requests.get(f"http://{ip}/control?var={var_name}&val={val}", timeout=2)
        except: pass
        
    return jsonify({'status': 'success'})

@cam_bp.route('/api/set_ai_params', methods=['POST'])
@login_required
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
@login_required
def toggle_ai():
    cam_state.AI_ACTIVE = request.json.get('active', False)
    status_text = "AKTIF" if cam_state.AI_ACTIVE else "MATI"
    print(f"[INFO] Engine YOLOv5 sekarang: {status_text}")
    return jsonify({'status': 'success', 'ai_active': cam_state.AI_ACTIVE})

import random 

@cam_bp.route('/api/stream_stats')
@login_required
def stream_stats():
    # 1. Siapkan keranjang kosong (Default)
    stats_data = {
        'fps': getattr(cam_state, 'current_fps', 0),
        'matang': getattr(cam_state, 'count_matang', 0), 
        'mentah': getattr(cam_state, 'count_mentah', 0),
        'bunga': getattr(cam_state, 'count_bunga', 0),
        # Nah ini kuncinya, dia bakal ngambil resolusi dari DB lo sekarang
        'res': current_user.cam_res if current_user.cam_res else '---', 
        'rssi': None,
        'free_ram': None,
        'uptime': None,
        'temp': None,
        'gps_lat': getattr(cam_state, 'latest_lat', None), 
        'gps_lng': getattr(cam_state, 'latest_lng', None), 
        'gps_alt': None,
        'gps_sat': getattr(cam_state, 'latest_sat', 0)
    }
    
    # 2. Cek apakah ada kamera ESP32 yang terkoneksi
    if cam_state.ACTIVE_CAMERA_URL is not None: 
        if isinstance(cam_state.ACTIVE_CAMERA_URL, str) and "http" in cam_state.ACTIVE_CAMERA_URL:
            ip = urlparse(cam_state.ACTIVE_CAMERA_URL).hostname
            
            # --- TARIK SEMUA DATA SEKALI JALAN KE PORT 82 ---
            # Sesuai dengan source code .ino terbaru milik Anda
            try:
                resp = requests.get(f"http://{ip}:82/telemetry", timeout=0.5)
                if resp.status_code == 200:
                    data = resp.json()
                    
                    # Isi data hardware
                    stats_data['rssi'] = data.get('rssi', -100)
                    stats_data['free_ram'] = data.get('free_ram')
                    stats_data['uptime'] = data.get('uptime')
                    stats_data['temp'] = data.get('temp')
                    
                    # Isi data GPS (pastikan satelit dapet biar di UI ganti jadi ijo)
                    gps_sat = int(data.get('gps_sat', 0))
                    stats_data['gps_sat'] = gps_sat
                    cam_state.latest_sat = gps_sat
                    
                    # Kalau koordinat valid (bukan NULL) dari ESP32, masukin ke state
                    gps_lat = data.get('gps_lat')
                    gps_lng = data.get('gps_lng')
                    if gps_lat is not None and gps_lng is not None:
                        stats_data['gps_lat'] = float(gps_lat)
                        stats_data['gps_lng'] = float(gps_lng)
                        
                        cam_state.latest_lat = float(gps_lat)
                        cam_state.latest_lng = float(gps_lng)
                        
            except Exception as e:
                # print("Error fetch telemetry:", e)
                stats_data['rssi'] = -100 

    # 3. Kirim keranjang data ke Javascript (Dashboard HTML)
    return jsonify(stats_data)
    
@cam_bp.route('/api/start_session', methods=['POST'])
@login_required
def start_session():
    # 1. Bikin sesi penerbangan baru di database
    new_session = FlightSession(status='active', start_time=datetime.utcnow())
    db.session.add(new_session)
    db.session.commit()
    
    # 2. Simpan ID-nya ke state kamera
    cam_state.current_session_id = new_session.id
    
    # 3. Reset counter angka di layar jadi 0 lagi buat mulai seger
    cam_state.count_matang = 0
    cam_state.count_mentah = 0
    cam_state.count_bunga = 0
    
    # 4. RESET INGATAN KTP BYTETRACK! (BIAR GAK BAWA DATA SESI SEBELUMNYA)
    reset_tracker()
    
    return jsonify({'status': 'success', 'session_id': new_session.id})

@cam_bp.route('/api/stop_session', methods=['POST'])
@login_required
def stop_session():
    if not cam_state.current_session_id:
        return jsonify({'status': 'error', 'message': 'Tidak ada sesi aktif.'}), 400
        
    # 1. Cari sesi yang lagi jalan di database
    active_session = FlightSession.query.get(cam_state.current_session_id)
    
    if active_session:
        # 2. Simpan angka hasil panen terakhir ke database
        # (Nanti pas ByteTrack lu udah jalan, kita ganti logic ini pake COUNT dari tabel DetectionLog)
        active_session.total_matang = cam_state.count_matang
        active_session.total_mentah = cam_state.count_mentah
        active_session.total_bunga = cam_state.count_bunga
        
        # 3. Catat waktu selesai dan ubah status
        active_session.end_time = datetime.utcnow()
        active_session.status = 'completed'
        db.session.commit()
        
    # 4. Hapus ingatan sesi di memori karena udah mendarat
    cam_state.current_session_id = None
    
    return jsonify({'status': 'success', 'message': 'Laporan disimpan!'})

# Tentukan letak folder model lu
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'business-logic', 'models')

@cam_bp.route('/api/models', methods=['GET'])
@login_required
def list_models():
    """Ngasih daftar model .pt ke web (Frontend)"""
    if not os.path.exists(MODEL_DIR):
        os.makedirs(MODEL_DIR)
        
    # Cari semua file berakhiran .pt
    models = [f for f in os.listdir(MODEL_DIR) if f.endswith('.pt')]
    return jsonify({'status': 'success', 'models': models})

@cam_bp.route('/api/upload_model', methods=['POST'])
@login_required
def upload_model():
    """Nangkap file .pt yang di-upload user"""
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': 'Tidak ada file'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': 'File kosong'}), 400
        
    # --- SECURITY FIX: UPDATE MAGIC BYTES UNTUK PYTORCH ---
    header = file.read(4) # Baca 4 byte pertama
    file.seek(0) # Kembalikan kursor ke awal biar file bisa disave
    
    # Cek PyTorch Baru (ZIP format: PK..) atau Lama (Pickle: \x80..)
    is_valid_signature = header.startswith(b'PK') or header.startswith(b'\x80')
    
    if file.filename.endswith('.pt'):
        if is_valid_signature:
            filename = secure_filename(file.filename)
            filepath = os.path.join(MODEL_DIR, filename)
            file.save(filepath) 
            return jsonify({'status': 'success', 'message': f'Model {filename} aman dan berhasil diunggah!'})
        else:
            return jsonify({'status': 'error', 'message': 'File Ditolak: Bukan model PyTorch asli (Format tidak dikenali)!'}), 400
            
    return jsonify({'status': 'error', 'message': 'Format harus .pt'}), 400

@cam_bp.route('/api/delete_model/<model_name>', methods=['DELETE'])
@login_required
def delete_model(model_name):
    """Menghapus file model .pt dari server"""
    # Mencegah directory traversal attack (Hacker hapus file sistem)
    safe_model_name = secure_filename(model_name)
    filepath = os.path.join(MODEL_DIR, safe_model_name)

    # 1. Cek apakah file beneran ada
    if not os.path.exists(filepath):
        return jsonify({'status': 'error', 'message': 'Model tidak ditemukan di server!'}), 404

    # 2. Cek apakah model ini sedang dipakai oleh sistem AI saat ini
    # (Kalau dihapus pas lagi dipakai, AI bakal crash)
    if getattr(cam_state, 'CURRENT_MODEL', '') == safe_model_name:
        return jsonify({'status': 'error', 'message': 'Model sedang aktif! Ganti ke model lain dulu sebelum menghapus.'}), 400

    # 3. Eksekusi penghapusan file
    try:
        os.remove(filepath)
        return jsonify({'status': 'success', 'message': f'Model {safe_model_name} berhasil dibuang!'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Gagal menghapus file: {str(e)}'}), 500

@cam_bp.route('/api/set_active_model', methods=['POST'])
@login_required
def set_active_model():
    """Ganti model pas user nge-drag & drop urutan"""
    data = request.json
    model_name = data.get('model_name')
    
    if change_model(model_name):
        return jsonify({'status': 'success', 'message': f'Model aktif: {model_name}'})
    return jsonify({'status': 'error', 'message': 'Gagal memuat model'}), 500

# ==========================================
# FITUR AUTO DETECT ESP32
# ==========================================
def check_port(ip, port, timeout=0.5):
    """Fungsi ngetuk pintu ke IP tertentu buat ngecek port 81 kebuka gak"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(timeout)
            s.connect((ip, port))
        return ip
    except:
        return None

@cam_bp.route('/api/scan_network', methods=['GET'])
@login_required
def scan_network():
    # 1. Cari tau IP laptop lu sekarang (misal 192.168.1.5)
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except:
        local_ip = "192.168.1.1" # Fallback

    # 2. Ambil 3 blok angka pertamanya (192.168.1.)
    subnet = '.'.join(local_ip.split('.')[:-1]) + '.'
    
    # 3. Bikin daftar target IP (192.168.1.1 sampai 192.168.1.254)
    ips_to_scan = [f"{subnet}{i}" for i in range(1, 255)]

    found_ips = []
    # 4. Kerahkan 50 kurir (thread) sekaligus buat ngecek port 81 (Biar cepet!)
    with ThreadPoolExecutor(max_workers=50) as executor:
        results = executor.map(lambda ip: check_port(ip, 81), ips_to_scan)
        for res in results:
            if res:
                found_ips.append(res)

    if found_ips:
        # Kalau ketemu, kirim IP yang pertama kali nyaut
        return jsonify({'status': 'success', 'ip': found_ips[0]})
    
    return jsonify({'status': 'error', 'message': 'Tidak ada ESP32 yang merespon di jaringan ini.'}), 404

@cam_bp.route('/api/delete_session/<int:session_id>', methods=['DELETE'])
@login_required
def delete_session(session_id):
    session_to_delete = FlightSession.query.get(session_id)
    
    if session_to_delete:
        # --- SECURITY FIX: AUDIT LOGGING ---
        logging.warning(f"[AUDIT] User {current_user.username} menghapus Laporan Sesi ID: {session_id}")
        
        db.session.delete(session_to_delete)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Data patroli berhasil dihapus!'})
        
    return jsonify({'status': 'error', 'message': 'Data tidak ditemukan!'}), 404

# Tambahin ini di paling bawah file cam_routes.py
@cam_bp.route('/api/reset_stats', methods=['POST'])
@login_required
def reset_stats():
    # Nge-nol-in memori angka di Python
    cam_state.count_matang = 0
    cam_state.count_mentah = 0
    cam_state.count_bunga = 0
    
    # Bersihin tracker biar kotak ungu (counted) hilang
    reset_tracker() 
    
    return jsonify({'status': 'success', 'message': 'Counter berhasil di-reset!'})