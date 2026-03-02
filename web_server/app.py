import os
import cv2  # Tambahan untuk baca stream video
from flask import Flask, render_template, request, jsonify, Response
from detection import get_prediction, process_frame
import requests # Tambahin ini di bagian atas
from urllib.parse import urlparse # Buat misahin IP dari URL stream
import time
from werkzeug.utils import secure_filename

app = Flask(__name__)

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

# --- ROUTE UTAMA ---

@app.route('/')
def index():
    return render_template('index.html')

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
    
# --- ROUTE KONTROL VISUAL ESP32 (Brightness, Contrast, dll) ---
@app.route('/api/cam_control', methods=['POST'])
def cam_control():
    global ACTIVE_CAMERA_URL
    if not ACTIVE_CAMERA_URL:
        return jsonify({'status': 'error', 'message': 'Kamera belum terhubung'}), 400

    data = request.json
    var_name = data.get('var') 
    val = data.get('val')      
    
    parsed_url = urlparse(ACTIVE_CAMERA_URL)
    ip_address = parsed_url.hostname 

    control_url = f"http://{ip_address}/control?var={var_name}&val={val}"

    try:
        requests.get(control_url, timeout=2)
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': 'Gagal mengirim kontrol ke ESP32'}), 500
    
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

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