import torch
import cv2
import numpy as np
import base64
import os
import pathlib
import math
import supervision as sv

# Fix untuk error PosixPath di Windows
pathlib.PosixPath = pathlib.WindowsPath

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, '..', 'business-logic', 'models', 'best.pt')

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
current_model = None

# ==========================================
# 1. TRACKER & SPATIAL MEMORY CONFIG
# ==========================================
tracker = sv.ByteTrack(
    track_activation_threshold=0.1,  # <--- UBAH INI JADI 0.1 (sebelumnya 0.25)
    lost_track_buffer=30, 
    minimum_matching_threshold=0.4, 
    frame_rate=30
)

spatial_memory = [] # Memori jarak anti-getar
DISTANCE_THRESHOLD = 90 
MAX_AGE = 30 
global_counts = {'matang': 0, 'mentah': 0, 'bunga': 0}
TARGET_CLASSES = ['matang', 'mentah', 'bunga', 'berbunga']

# Palette Warna SaaS
COLORS = {
    'matang': (45, 29, 225),   # Ruby Red
    'mentah': (129, 185, 16),  # Emerald Green
    'bunga': (11, 158, 245),   # Neon Yellow
    'neutral': (148, 163, 184),# Slate Blue
    'counted': (255, 0, 255),  # Fuchsia
}

# ==========================================
# 2. CORE FUNCTIONS (Load, Change, Reset)
# ==========================================
def reset_tracker():
    global spatial_memory, global_counts, tracker, recent_detection_history
    spatial_memory = []
    recent_detection_history = [] # <--- TAMBAHAN BARU BIAR HUD BERSIH
    global_counts = {'matang': 0, 'mentah': 0, 'bunga': 0}
    tracker = sv.ByteTrack(track_activation_threshold=0.1, lost_track_buffer=30, minimum_matching_threshold=0.4, frame_rate=30)
    print("🔄 [SYSTEM] Tracker & Spatial Memory Reset!")
    
def load_model():
    global current_model
    try:
        path_to_load = MODEL_PATH if os.path.exists(MODEL_PATH) else 'yolov5s'
        current_model = torch.hub.load('ultralytics/yolov5', 'custom', path=path_to_load).to(device)
        print("✅ [AI] Model Loaded Successfully")
    except Exception as e: print(f"❌ Load Error: {e}")

load_model()

def change_model(new_model_name):
    global current_model, MODEL_PATH
    new_path = os.path.join(BASE_DIR, '..', 'business-logic', 'models', new_model_name)
    if os.path.exists(new_path):
        MODEL_PATH = new_path
        load_model()
        reset_tracker()
        return True
    return False

# ==========================================
# 3. VISUALIZATION UTILITIES (The "SaaS" Look)
# ==========================================
def draw_saas_box(frame, box, label, conf, color, track_id=None):
    x1, y1, x2, y2 = box
    # 1. Kotak Utama Tipis
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 1, cv2.LINE_AA)
    
    # 2. Tab Label Rounded-look (Sekarang pakai ID)
    if track_id is not None:
        label_txt = f"ID:{track_id} {label.upper()} {conf:.2f}"
    else:
        label_txt = f"{label.upper()} {conf:.2f}"
        
    (text_w, text_h), _ = cv2.getTextSize(label_txt, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
    
    overlay = frame.copy()
    cv2.rectangle(overlay, (x1, y1 - text_h - 8), (x1 + text_w + 10, y1), color, -1)
    cv2.addWeighted(overlay, 0.8, frame, 0.2, 0, frame)
    cv2.putText(frame, label_txt, (x1 + 5, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1, cv2.LINE_AA)


def draw_recent_hud(frame, recent_history):
    """Fungsi untuk gambar HUD riwayat deteksi di kiri bawah (Versi Compact)"""
    if not recent_history: return

    height, width = frame.shape[:2]
    
    # Pengaturan ukuran baru (Lebih kecil, slim, & compact)
    line_spacing = 16       # Spasi antar baris dirapetin (awalnya 20)
    font_scale = 0.35       # Ukuran font list dikecilin (awalnya 0.4)
    header_font_scale = 0.3 # Ukuran font judul dikecilin
    box_width = 135         # Lebar kotak dilangsingin (awalnya 170)
    
    # Hitung tinggi kotak secara dinamis berdasarkan jumlah list
    hud_h = (len(recent_history) * line_spacing) + 25
    
    # Koordinat background box (Digeser ke atas 15px biar aman dari tombol)
    box_y2 = height - 15
    box_y1 = box_y2 - hud_h
    box_x1 = 10
    box_x2 = box_x1 + box_width

    # Bikin background transparan
    overlay = frame.copy()
    cv2.rectangle(overlay, (box_x1, box_y1), (box_x2, box_y2), (15, 23, 42), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

    # Header Text
    cv2.putText(frame, "RECENT DETECTS:", (box_x1 + 10, box_y1 + 15), cv2.FONT_HERSHEY_SIMPLEX, header_font_scale, (148, 163, 184), 1, cv2.LINE_AA)

    # Print riwayat (dari bawah ke atas di dalam kotak)
    start_y_text = box_y2 - 10
    start_x_text = box_x1 + 10

    # Maksimal tampilin 5 data terakhir
    for i, item in enumerate(reversed(recent_history[-5:])): 
        color = COLORS.get(item['class'], COLORS['neutral'])
        
        # Teks dibikin lebih singkat (Kata "Conf:" dibuang biar muat)
        # Contoh output: ID:22 | MAT | 0.86
        txt = f"ID:{item['id']} | {item['class'][:3].upper()} | {item['conf']:.2f}"
        
        y_pos = start_y_text - (i * line_spacing)
        
        # Titik warna (lebih kecil)
        cv2.circle(frame, (start_x_text + 3, y_pos - 3), 3, color, -1)
        # Teks list
        cv2.putText(frame, txt, (start_x_text + 12, y_pos), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255), 1, cv2.LINE_AA)


# ==========================================
# 4. MAIN PROCESSING ENGINE
# ==========================================
# Tambahin variabel global baru buat nyimpen riwayat
recent_detection_history = [] 

def process_frame(frame, conf_threshold=0.5):
    global current_model, tracker, spatial_memory, global_counts, recent_detection_history
    
    if current_model is None: return frame, {'matang':0, 'mentah':0, 'bunga':0}
    
    current_model.conf = float(conf_threshold)
    new_counts_this_frame = {'matang': 0, 'mentah': 0, 'bunga': 0}
    
    # Update Memory Age
    for mem in spatial_memory: mem['age'] += 1
    spatial_memory = [m for m in spatial_memory if m['age'] < MAX_AGE]

    height, width = frame.shape[:2]
    zone_top, zone_bottom = int(height * 0.4), int(height * 0.6)

    # UI: Area Sensor
    cv2.line(frame, (0, zone_top), (width, zone_top), (233, 165, 14), 1)
    cv2.line(frame, (0, zone_bottom), (width, zone_bottom), (233, 165, 14), 1)

    results = current_model(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    df = results.pandas().xyxy[0]
    df = df[df['name'].str.lower().isin(TARGET_CLASSES)]

    if not df.empty:
        detections = sv.Detections(
            xyxy=df[['xmin', 'ymin', 'xmax', 'ymax']].to_numpy(),
            confidence=df['confidence'].to_numpy(),
            class_id=df['class'].to_numpy()
        )
        tracked = tracker.update_with_detections(detections)

        for i in range(len(tracked)):
            box = tracked.xyxy[i].astype(int)
            cx, cy = (box[0] + box[2]) // 2, (box[1] + box[3]) // 2
            label = current_model.names[tracked.class_id[i]].lower()
            mapped = 'bunga' if label in ['bunga', 'berbunga'] else label
            
            # Ambil Tracker ID (PENTING!)
            track_id = tracked.tracker_id[i] if hasattr(tracked, 'tracker_id') and tracked.tracker_id is not None else "???"
            
            bbox_color = COLORS['neutral']
            
            if zone_top <= cy <= zone_bottom:
                is_new = True
                for mem in spatial_memory:
                    if mem['class'] == mapped and math.hypot(cx - mem['pos'][0], cy - mem['pos'][1]) < DISTANCE_THRESHOLD:
                        mem['pos'], mem['age'], is_new = (cx, cy), 0, False
                        break
                
                if is_new:
                    spatial_memory.append({'pos': (cx, cy), 'class': mapped, 'age': 0})
                    global_counts[mapped] += 1
                    new_counts_this_frame[mapped] += 1
                    bbox_color = COLORS['counted']
                    
                    # Cuma masukin ke riwayat kalau dia beneran baru kehitung (di area sensor)
                    recent_detection_history.append({
                        'id': track_id, 
                        'class': mapped, 
                        'conf': tracked.confidence[i]
                    })
                    # Biar listnya gak kepanjangan, batesin 10 aja memori HUD-nya
                    if len(recent_detection_history) > 10:
                        recent_detection_history.pop(0) 

                else:
                    bbox_color = COLORS[mapped]
            
            # Panggil fungsi gambar box yang udah di-update (nampilin ID)
            draw_saas_box(frame, box, mapped, tracked.confidence[i], bbox_color, track_id=track_id)

    # Panggil fungsi HUD baru kita sebelum frame dikirim ke web
    draw_recent_hud(frame, recent_detection_history)

    return frame, new_counts_this_frame

def get_prediction(image_bytes, conf_threshold=0.5):
    # (Fungsi upload gambar statis tetap sama seperti sebelumnya)
    # Gunakan draw_saas_box untuk konsistensi visual
    pass