import torch
import cv2
import numpy as np
import base64
import os
import pathlib

# Fix untuk error PosixPath di Windows
pathlib.PosixPath = pathlib.WindowsPath

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Pastikan path ini mengarah ke model lu yang bener
MODEL_PATH = os.path.join(BASE_DIR, '..', 'business-logic', 'models', 'best.pt')

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
current_model = None

def load_model():
    global current_model
    try:
        print(f"🔄 Loading model...")
        path_to_load = MODEL_PATH if os.path.exists(MODEL_PATH) else 'yolov5s'
        current_model = torch.hub.load('ultralytics/yolov5', 'custom', path=path_to_load).to(device)
        print("✅ Model siap!")
    except Exception as e:
        print(f"❌ Error load model: {e}")

load_model()

def get_prediction(image_bytes, conf_threshold=0.2):
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
        
        if label in stats: 
            stats[label] += 1
            
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(img, f"{label} {conf:.2f}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    _, buffer = cv2.imencode('.jpg', img)
    img_b64 = base64.b64encode(buffer).decode('utf-8')
    
    return {
        'image_data': img_b64, 
        'stats': stats
    }


# ==============================================================
# FUNGSI UNTUK VIDEO STREAM (INI YANG BIKIN ERROR TADI KALAU GA DIUPDATE)
# ==============================================================
def process_frame(frame, conf_threshold=0.2):
    global current_model
    
    # 1. Siapin wadah untuk nyimpen jumlah deteksi
    counts = {'matang': 0, 'mentah': 0, 'bunga': 0} 
    
    if current_model is None: 
        # PENTING: Harus return 2 nilai
        return frame, counts
    
    current_model.conf = conf_threshold
    
    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    results = current_model(img_rgb)
    df = results.pandas().xyxy[0]
    
    # 2. Gambar kotak di setiap objek dan HITUNG jumlahnya
    for _, row in df.iterrows():
        x1, y1, x2, y2 = int(row['xmin']), int(row['ymin']), int(row['xmax']), int(row['ymax'])
        label = row['name'].lower()
        conf = row['confidence']
        
        # Ngitung
        if label == 'matang':
            counts['matang'] += 1
        elif label == 'mentah':
            counts['mentah'] += 1
        elif label == 'bunga' or label == 'berbunga': 
            counts['bunga'] += 1
            
        # Nggambar
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(frame, f"{label} {conf:.2f}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        
    # 3. PENTING: Harus return 2 nilai ini sejajar paling luar
    return frame, counts