import torch
import cv2
import numpy as np
import base64
import os
import pathlib
import supervision as sv  # <-- Pahlawan kita!

# Fix untuk error PosixPath di Windows
pathlib.PosixPath = pathlib.WindowsPath

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Pastikan path ini mengarah ke model lu yang bener
MODEL_PATH = os.path.join(BASE_DIR, '..', 'business-logic', 'models', 'best.pt')

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
current_model = None

# ==========================================
# INISIALISASI BYTETRACK & MEMORI ID
# ==========================================
# Ganti konfigurasi ByteTrack pakai parameter terbaru supervision
tracker = sv.ByteTrack(
    track_activation_threshold=0.25, 
    lost_track_buffer=30, 
    minimum_matching_threshold=0.8, 
    frame_rate=30
)
tracked_ids = set()

def reset_tracker():
    """Bilas ingatan ByteTrack pas klik Mulai Sesi Patroli"""
    global tracked_ids, tracker
    tracked_ids.clear()
    # Panggil ulang dengan settingan yang stabil
    tracker = sv.ByteTrack(
        track_activation_threshold=0.25, 
        lost_track_buffer=30, 
        minimum_matching_threshold=0.8, 
        frame_rate=30
    ) 
    print("🔄 [TRACKER] Memori KTP ByteTrack berhasil di-reset bersih!")

def load_model():
    global current_model
    try:
        print(f"🔄 Loading model YOLOv5 (Original) + Supervision ByteTrack...")
        path_to_load = MODEL_PATH if os.path.exists(MODEL_PATH) else 'yolov5s'
        current_model = torch.hub.load('ultralytics/yolov5', 'custom', path=path_to_load).to(device)
        print("✅ Model & Tracker siap mengudara!")
    except Exception as e:
        print(f"❌ Error load model: {e}")

load_model()

def change_model(new_model_name):
    """Fungsi ajaib buat ganti otak AI secara real-time"""
    global current_model, MODEL_PATH
    try:
        print(f"🔄 Perintah diterima: Mengganti model ke {new_model_name}...")
        
        new_path = os.path.join(BASE_DIR, '..', 'business-logic', 'models', new_model_name)
        
        if os.path.exists(new_path):
            MODEL_PATH = new_path
            load_model() 
            reset_tracker() 
            return True
        else:
            print(f"❌ File {new_model_name} nggak ketemu di folder!")
            return False
            
    except Exception as e:
        print(f"❌ Error pas ganti model: {e}")
        return False

def get_prediction(image_bytes, conf_threshold=0.2):
    """Fungsi statis, nggak butuh tracker"""
    global current_model
    if current_model is None: 
        return None
    
    current_model.conf = conf_threshold
    
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None: return None
    
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    results = current_model(img_rgb)
    df = results.pandas().xyxy[0]
    
    stats = {'matang': 0, 'mentah': 0, 'berbunga': 0}
    
    for _, row in df.iterrows():
        x1, y1, x2, y2 = int(row['xmin']), int(row['ymin']), int(row['xmax']), int(row['ymax'])
        label = row['name'].lower()
        conf = row['confidence']
        
        if label in stats: stats[label] += 1
        elif label == 'bunga': stats['berbunga'] += 1
            
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(img, f"{label} {conf:.2f}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    _, buffer = cv2.imencode('.jpg', img)
    img_b64 = base64.b64encode(buffer).decode('utf-8')
    
    return {'image_data': img_b64, 'stats': stats}

# ==============================================================
# FUNGSI UNTUK VIDEO STREAM (DENGAN BYTETRACK SUPERVISION)
# ==============================================================
def process_frame(frame, conf_threshold=0.2):
    global current_model, tracker, tracked_ids
    
    new_counts = {'matang': 0, 'mentah': 0, 'bunga': 0} 
    
    if current_model is None: 
        return frame, new_counts
    
    current_model.conf = conf_threshold
    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    results = current_model(img_rgb)
    df = results.pandas().xyxy[0]
    
    if len(df) > 0:
        xyxy = df[['xmin', 'ymin', 'xmax', 'ymax']].to_numpy()
        confidence = df['confidence'].to_numpy()
        class_id = df['class'].to_numpy()
        
        detections = sv.Detections(
            xyxy=xyxy,
            confidence=confidence,
            class_id=class_id
        )
        
        tracked_detections = tracker.update_with_detections(detections)
        
        for i in range(len(tracked_detections)):
            box = tracked_detections.xyxy[i].astype(int)
            t_id = tracked_detections.tracker_id[i]
            c_id = tracked_detections.class_id[i]
            conf = tracked_detections.confidence[i]
            
            x1, y1, x2, y2 = box
            label = current_model.names[c_id].lower()
            
            # --- LAPISAN KEAMANAN DOUBLE COUNTING ---
            # Jangan biarkan label ngawur masuk hitungan
            mapped_label = label
            if label in ['bunga', 'berbunga']:
                mapped_label = 'bunga'
            
            # Pastikan hanya class yang valid yang dicatat
            if mapped_label in new_counts:
                # Cek KTP
                if t_id not in tracked_ids:
                    tracked_ids.add(t_id) 
                    new_counts[mapped_label] += 1 # Baru ditambah!
            
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            text = f"ID:{t_id} {mapped_label} {conf:.2f}"
            cv2.putText(frame, text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
            
    return frame, new_counts