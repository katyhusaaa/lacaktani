import os
import cv2  # Tambahan untuk baca stream video
from flask import Flask, render_template, request, jsonify, Response
from detection import get_prediction, process_frame
import requests # Tambahin ini di bagian atas
from urllib.parse import urlparse # Buat misahin IP dari URL stream
import time
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user


app = Flask(__name__)

# Setup Database & Login
app.config['SECRET_KEY'] = 'rahasia-lacaktani' 
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///lacaktani.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
login_manager = LoginManager(app)

# ----- Variable Global -----
ACTIVE_CAMERA_URL = None

# Variabel global untuk nyimpen data live
current_fps = 0
count_matang = 0
count_mentah = 0
count_bunga = 0

# --- VARIABEL GLOBAL UNTUK AI ---
AI_CONFIDENCE = 0.50
CURRENT_MODEL = 'best.pt'
AI_ACTIVE = False # Default mati

# --- KONFIGURASI KEAMANAN UPLOAD MODEL ---
# Sesuaikan ini dengan letak folder model YOLO lu
UPLOAD_FOLDER = 'business-logic/models' 
ALLOWED_EXTENSIONS = {'pt'} # Harga mati, cuma boleh format PyTorch/YOLO

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 # Batas maksimal 50MB biar server gak jebol

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    
    # Pengaturan Tersimpan (Default Value)
    cam_res = db.Column(db.String(10), default="6")
    cam_bright = db.Column(db.Integer, default=0)
    cam_contrast = db.Column(db.Integer, default=0)
    cam_sat = db.Column(db.Integer, default=0)
    cam_exp = db.Column(db.Integer, default=0)
    ai_conf = db.Column(db.Float, default=0.50)

    # --- 5 TAMBAHAN BARU UNTUK AI VISION ---
    cam_vflip = db.Column(db.Integer, default=0)
    cam_hmirror = db.Column(db.Integer, default=0)
    cam_awb = db.Column(db.Integer, default=1) # 1 = Aktif
    cam_aec = db.Column(db.Integer, default=1) # 1 = Aktif
    cam_lenc = db.Column(db.Integer, default=1) # 1 = Aktif

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

with app.app_context():
    db.create_all()

# --- ROUTE UTAMA ---

@app.route('/')
def index():
    if current_user.is_authenticated:
        return render_template('dashboard.html')
    else:
        return render_template('landing.html')

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if User.query.filter_by(username=username).first():
        return jsonify({'status': 'error', 'message': 'Username sudah terpakai!'})
        
    new_user = User(username=username, password=generate_password_hash(password, method='pbkdf2:sha256'))
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Akun berhasil dibuat! Silakan login.'})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data.get('username')).first()
    if user and check_password_hash(user.password, data.get('password')):
        login_user(user)
        return jsonify({'status': 'success'})
    return jsonify({'status': 'error', 'message': 'Username atau password salah!'})

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    global ACTIVE_CAMERA_URL, AI_ACTIVE
    ACTIVE_CAMERA_URL = None 
    AI_ACTIVE = False
    logout_user()
    return jsonify({'status': 'success'})

def generate_frames():
    global ACTIVE_CAMERA_URL, current_fps, count_matang, count_mentah, count_bunga, AI_ACTIVE, AI_CONFIDENCE
    
    if not ACTIVE_CAMERA_URL:
        return
        
    cap = cv2.VideoCapture(ACTIVE_CAMERA_URL)
    prev_time = time.time()
    
    while True:
        success, frame = cap.read()
        if not success:
            break
            
        # Hitung FPS
        curr_time = time.time()
        time_diff = curr_time - prev_time
        if time_diff > 0:
            current_fps = round(1.0 / time_diff, 1)
        prev_time = curr_time

        # ======== LOGIKA SAKLAR AI (DENGAN PELINDUNG ERROR) ========
        if AI_ACTIVE:
            try:
                # Coba jalankan AI
                frame_ai, counts = process_frame(frame, conf_threshold=AI_CONFIDENCE) 
                
                # Kalau berhasil, timpa frame asli dengan frame hasil AI
                frame = frame_ai
                
                count_matang = counts.get('matang', 0)
                count_mentah = counts.get('mentah', 0)
                count_bunga = counts.get('bunga', 0)
                
            except Exception as e:
                # KALAU AI ERROR, VIDEO GA BAKAL PUTUS!
                # Dia bakal nge-print errornya di terminal dan ngasih tulisan merah di layar
                print(f"❌ [CRASH DETEKSI AI]: {e}")
                cv2.putText(frame, "ERROR AI: CEK TERMINAL FLASK", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                count_matang, count_mentah, count_bunga = 0, 0, 0
        else:
            # Kalau MATI: Jangan panggil YOLO, reset angka ke 0
            count_matang = 0
            count_mentah = 0
            count_bunga = 0
        # ===========================================================

        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        

# --- ROUTE PENGATURAN KAMERA ---
@app.route('/api/connect_cam', methods=['POST'])
def connect_cam():
    global ACTIVE_CAMERA_URL
    data = request.json
    ip_address = data.get('ip')
    
    if not ip_address:
        return jsonify({'status': 'error', 'message': 'IP Address kosong!'}), 400

    # Bikin format URL stream ESP32
    test_url = f"http://{ip_address}:81/stream"
    
    try:
        # Kita tes "ping" stream-nya pakai requests (timeout 3 detik) biar gak nge-hang
        response = requests.get(test_url, stream=True, timeout=3)
        
        # Kalau ESP32 ngejawab dengan status 200 OK
        if response.status_code == 200:
            ACTIVE_CAMERA_URL = test_url
            return jsonify({'status': 'success', 'message': 'Kamera terhubung!'})
        else:
            return jsonify({'status': 'error', 'message': f'Kamera menolak koneksi (Status: {response.status_code}).'}), 404
            
    except requests.exceptions.RequestException as e:
        # Kalau dalam 3 detik gak ada jawaban (ESP mati/beda jaringan)
        return jsonify({'status': 'error', 'message': f'Kamera di IP {ip_address} mati atau tidak merespon.'}), 404

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'Tidak ada file yang diupload'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'File kosong'}), 400

    # Baca file jadi bytes
    raw_bytes = file.read()
    
    # Lempar ke fungsi deteksi YOLO
    result = get_prediction(raw_bytes)
    
    if result is None:
        return jsonify({'error': 'Gagal memproses gambar'}), 500
        
    return jsonify(result)

# --- ROUTE STREAMING ---
@app.route('/video_feed')
def video_feed():
    """Rute ini dipanggil sama tag <img> di HTML buat nampilin video"""
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

# --- ROUTE KONTROL RESOLUSI ESP32 ---
@app.route('/api/set_resolution', methods=['POST'])
def set_resolution():
    global ACTIVE_CAMERA_URL
    if not ACTIVE_CAMERA_URL:
        return jsonify({'status': 'error', 'message': 'Kamera belum terhubung'}), 400

    data = request.json
    val = data.get('val') # Angka kode resolusinya
    
    # Ekstrak IP Address doang dari ACTIVE_CAMERA_URL
    parsed_url = urlparse(ACTIVE_CAMERA_URL)
    ip_address = parsed_url.hostname 

    # Bikin URL kontrol
    control_url = f"http://{ip_address}/control?var=framesize&val={val}"

    try:
        # Tembak perintahnya ke ESP32
        response = requests.get(control_url, timeout=3)
        if response.status_code == 200:
            return jsonify({'status': 'success'})
        else:
            return jsonify({'status': 'error', 'message': 'ESP32 menolak perintah'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': 'Gagal menghubungi ESP32'}), 500
    
@app.route('/api/cam_control', methods=['POST'])
@login_required
def cam_control():
    data = request.json
    var_name = data.get('var') 
    val = int(data.get('val'))      
    
    # SIMPAN KE DATABASE USER!
    if var_name == 'brightness': current_user.cam_bright = val
    elif var_name == 'contrast': current_user.cam_contrast = val
    elif var_name == 'saturation': current_user.cam_sat = val
    elif var_name == 'ae_level': current_user.cam_exp = val
    # -- Tambahan simpan ke DB --
    elif var_name == 'vflip': current_user.cam_vflip = val
    elif var_name == 'hmirror': current_user.cam_hmirror = val
    elif var_name == 'awb': current_user.cam_awb = val
    elif var_name == 'aec': current_user.cam_aec = val
    elif var_name == 'lenc': current_user.cam_lenc = val
    
    db.session.commit()

    if ACTIVE_CAMERA_URL:
        ip = urlparse(ACTIVE_CAMERA_URL).hostname 
        try: requests.get(f"http://{ip}/control?var={var_name}&val={val}", timeout=2)
        except: pass
    return jsonify({'status': 'success'})

# --- ROUTE UPLOAD MODEL BARU ---
@app.route('/api/upload_model', methods=['POST'])
def upload_model():
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': 'File tidak ditemukan di request'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': 'Tidak ada file yang dipilih'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        return jsonify({'status': 'success', 'message': 'Model diamankan', 'filename': filename})
    else:
        return jsonify({'status': 'error', 'message': 'Hanya diperbolehkan upload file berformat .pt!'}), 400

# --- ROUTE SETINGAN AI (Confidence & Model) ---
@app.route('/api/set_ai_params', methods=['POST'])
def set_ai_params():
    global AI_CONFIDENCE, CURRENT_MODEL
    data = request.json
    
    if 'confidence' in data:
        AI_CONFIDENCE = float(data['confidence'])
        print(f"[INFO] Confidence diubah ke: {AI_CONFIDENCE}")
        
    if 'model' in data:
        CURRENT_MODEL = data['model']
        print(f"[INFO] Model diubah ke: {CURRENT_MODEL}")

    return jsonify({'status': 'success'})


@app.route('/api/toggle_ai', methods=['POST'])
def toggle_ai():
    global AI_ACTIVE
    data = request.json
    AI_ACTIVE = data.get('active', False)
    status_text = "AKTIF" if AI_ACTIVE else "MATI"
    print(f"[INFO] Engine YOLOv5 sekarang: {status_text}")
    return jsonify({'status': 'success', 'ai_active': AI_ACTIVE})

# --- INI DIA ROUTE YANG DIPANGGIL FRONTEND BUAT UPDATE ANGKA ---
@app.route('/api/stream_stats')
def stream_stats():
    # Pastikan variabel-variabel ini menggunakan nama yang sama persis
    # dengan variabel global yang didefinisikan di atas.
    return jsonify({
        'fps': current_fps,
        'matang': count_matang, 
        'mentah': count_mentah,
        'bunga': count_bunga
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000, threaded=True)