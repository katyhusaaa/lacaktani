import torch
import cv2
import numpy as np
import base64
from PIL import Image
import io
import os
import pathlib

# Fix untuk PosixPath error di Windows (Penting buat load custom model YOLOv5)
pathlib.PosixPath = pathlib.WindowsPath

# --- GLOBAL VARIABLES ---
current_model = None
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# Folder default model
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MODEL_PATH = os.path.join(BASE_DIR, '..', 'business-logic', 'models', 'best.pt')

def load_custom_model(path_to_model):
    """Fungsi untuk meload/mengganti model secara dinamis"""
    global current_model
    try:
        print(f"🔄 Sedang meload model dari: {path_to_model}")
        # Load model dengan torch.hub
        current_model = torch.hub.load('ultralytics/yolov5', 'custom', path=path_to_model, force_reload=True).to(device)
        print("✅ Model berhasil dimuat!")
        return True, "Model berhasil diaktifkan"
    except Exception as e:
        print(f"❌ Gagal load model: {e}")
        return False, str(e)

# --- LOAD MODEL PERTAMA KALI (Saat Server Start) ---
# Cek apakah file ada, jika tidak pakai dummy atau skip
if os.path.exists(DEFAULT_MODEL_PATH):
    load_custom_model(DEFAULT_MODEL_PATH)
else:
    print("⚠️ Warning: File best.pt default tidak ditemukan.")

# --- KONFIGURASI WARNA ---
BOX_COLORS = {'matang': (0, 0, 255), 'mentah': (0, 255, 0), 'berbunga': (0, 255, 255)}

def get_prediction(image_bytes, conf_threshold=0.4):
    global current_model
    
    if current_model is None:
        return None
        
    # Set Confidence dari User
    current_model.conf = conf_threshold

    # Proses Gambar
    nparr = np.frombuffer(image_bytes, np.uint8)
    img_cv2 = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_cv2 is None:
        return None  # Gambar invalid/corrupt
    img_rgb = cv2.cvtColor(img_cv2, cv2.COLOR_BGR2RGB)

    # Deteksi
    results = current_model(img_rgb)
    df = results.pandas().xyxy[0]

    # Visualisasi
    stats = {'matang': 0, 'mentah': 0, 'berbunga': 0}
    for _, row in df.iterrows():
        x1, y1, x2, y2 = int(row['xmin']), int(row['ymin']), int(row['xmax']), int(row['ymax'])
        label_raw = row['name']
        label_key = label_raw.lower()
        conf = float(row['confidence'])

        if label_key in stats: stats[label_key] += 1
        color = BOX_COLORS.get(label_key, (0, 165, 255))

        cv2.rectangle(img_cv2, (x1, y1), (x2, y2), color, 2)
        
        # Labeling
        text_label = f"{label_raw} {conf:.0%}"
        (text_w, text_h), _ = cv2.getTextSize(text_label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        y_bg_top = y1 - 20 if y1 - 20 > 0 else y1
        cv2.rectangle(img_cv2, (x1, y_bg_top), (x1 + text_w, y1), color, -1)
        cv2.putText(img_cv2, text_label, (x1, y1 - 5 if y1 - 20 > 0 else y1 + 15), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)

    # Papan Skor Mini
    overlay = img_cv2.copy()
    cv2.rectangle(overlay, (10, 10), (200, 110), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.6, img_cv2, 0.4, 0, img_cv2)
    cv2.putText(img_cv2, f"CONFIDENCE: {conf_threshold*100:.0f}%", (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    cv2.putText(img_cv2, f"Matang   : {stats['matang']}", (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
    cv2.putText(img_cv2, f"Mentah   : {stats['mentah']}", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
    cv2.putText(img_cv2, f"Berbunga : {stats['berbunga']}", (20, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)

    # Top detection (highest confidence)
    top_det = None
    if not df.empty and 'confidence' in df.columns:
        best = df.loc[df['confidence'].idxmax()]
        top_det = {
            'label': str(best['name']),
            'confidence': float(best['confidence']),
            'matang_siap_panen': stats['matang']
        }

    _, buffer = cv2.imencode('.jpg', img_cv2)
    result_b64 = base64.b64encode(buffer).decode('utf-8')
    return {'image_data': result_b64, 'stats': stats, 'top_detection': top_det}