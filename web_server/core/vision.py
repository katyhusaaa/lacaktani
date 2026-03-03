# File: core/vision.py
import cv2
import time
from detection import process_frame # <-- IMPORT DARI FILE AI LU!
from core.camera_state import cam_state # <-- IMPORT GUDANG DATA KITA

def generate_frames():
    if not cam_state.ACTIVE_CAMERA_URL:
        return
        
    cap = cv2.VideoCapture(cam_state.ACTIVE_CAMERA_URL)
    prev_time = time.time()
    
    while True:
        success, frame = cap.read()
        if not success:
            break
            
        # Hitung FPS
        curr_time = time.time()
        time_diff = curr_time - prev_time
        if time_diff > 0:
            cam_state.current_fps = round(1.0 / time_diff, 1)
        prev_time = curr_time

        # Kalau AI nyala, lempar framenya ke detection.py lu
        if cam_state.AI_ACTIVE:
            try:
                frame_ai, new_counts = process_frame(frame, conf_threshold=cam_state.AI_CONFIDENCE) 
                frame = frame_ai
                
                # ==========================================
                # LOGIKA AKUMULASI (PENTING!)
                # Pake += biar angkanya nambah terus, bukan ditimpa!
                # ==========================================
                cam_state.count_matang += new_counts.get('matang', 0)
                cam_state.count_mentah += new_counts.get('mentah', 0)
                cam_state.count_bunga += new_counts.get('bunga', 0)
                
            except Exception as e:
                print(f"❌ [CRASH DETEKSI AI]: {e}")
                cv2.putText(frame, "ERROR AI: CEK TERMINAL", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        else:
            pass # Kalau AI mati, angkanya beku (freeze) nunggu disave

        # Kirim frame ke HTML
        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')