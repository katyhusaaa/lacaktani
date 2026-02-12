import torch
import cv2
import numpy as np
import base64
from PIL import Image
import io
import os

# --- KONFIGURASI PATH ---
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'business-logic', 'models', 'best.pt')

# --- LOAD MODEL (Hanya Sekali) ---
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
# Force reload untuk memastikan cache bersih
model = torch.hub.load('ultralytics/yolov5', 'custom', path=MODEL_PATH, force_reload=True).to(device)
model.conf = 0.4  # Batas confidence (40%)

# --- KONFIGURASI WARNA (BGR Format: Blue, Green, Red) ---
# Kita buat dictionary ini pintar, bisa baca huruf besar/kecil nanti di logic
COLORS_MAP = {
    'matang': (0, 0, 255),    # Merah (Matang)
    'mentah': (0, 255, 0),    # Hijau (Mentah)
    'berbunga': (0, 255, 255) # Kuning (Berbunga)
}

def get_prediction(image_bytes):
    # 1. Baca gambar
    nparr = np.frombuffer(image_bytes, np.uint8)
    img_cv2 = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # 2. Prediksi
    img_rgb = cv2.cvtColor(img_cv2, cv2.COLOR_BGR2RGB)
    results = model(img_rgb)
    df = results.pandas().xyxy[0]

    # 3. GAMBAR HASIL
    for _, row in df.iterrows():
        x1, y1, x2, y2 = int(row['xmin']), int(row['ymin']), int(row['xmax']), int(row['ymax'])
        label_raw = row['name']      # Ambil nama asli (misal: "Matang")
        label_key = label_raw.lower() # Ubah jadi huruf kecil (misal: "matang")
        conf = float(row['confidence'])

        # Ambil warna (Default ke ORANGE jika label tidak dikenal, bukan Putih lagi)
        # Format BGR: (0, 165, 255) adalah Orange
        color = COLORS_MAP.get(label_key, (0, 165, 255))

        # --- A. GAMBAR KOTAK (Bounding Box) ---
        # Thickness 2 px
        cv2.rectangle(img_cv2, (x1, y1), (x2, y2), color, 2)

        # --- B. GAMBAR LABEL ---
        text_label = f"{label_raw} {conf:.0%}"
        
        # Hitung ukuran teks biar background pas
        (text_w, text_h), baseline = cv2.getTextSize(text_label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
        
        # Koordinat background teks (di atas kotak)
        # Jika kotak terlalu mepet atas, taruh label di dalam kotak
        if y1 - 25 > 0:
            y_bg_top = y1 - 25
            y_bg_bottom = y1
            y_text = y1 - 5
        else:
            y_bg_top = y1
            y_bg_bottom = y1 + 25
            y_text = y1 + 18

        # Gambar Background Teks (Filled = -1)
        cv2.rectangle(img_cv2, (x1, y_bg_top), (x1 + text_w, y_bg_bottom), color, -1)

        # Tulis Teks (Warna HITAM (0,0,0) biar terbaca jelas di warna terang)
        cv2.putText(img_cv2, text_label, (x1, y_text), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1, cv2.LINE_AA)

    # 4. Encode ke Base64 untuk dikirim ke Web
    _, buffer = cv2.imencode('.jpg', img_cv2)
    jpg_as_text = base64.b64encode(buffer).decode('utf-8')
    
    return jpg_as_text