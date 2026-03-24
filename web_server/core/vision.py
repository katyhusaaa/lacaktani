# File: core/vision.py
import cv2
import time
from detection import process_frame
from core.camera_state import cam_state

def generate_frames():
    if getattr(cam_state, 'ACTIVE_CAMERA_URL', None) is None:
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

        # ==========================================
        # ROTASI & FLIP SEBELUM MASUK AI
        # ==========================================
        # Ambil nilai rotasi langsung dari RAM (cam_state)
        rotate_val = getattr(cam_state, 'cam_rotate', '0') 
        flip_h_val = getattr(cam_state, 'cam_hflip', '0')  

        # Eksekusi Rotasi
        if rotate_val == '90':
            frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
        elif rotate_val == '180':
            frame = cv2.rotate(frame, cv2.ROTATE_180)
        elif rotate_val == '270':
            frame = cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)

        # Eksekusi Flip (Kaca Spion)
        if flip_h_val == '1':
            frame = cv2.flip(frame, 1)
        # ==========================================

        # Kalau AI nyala, lempar framenya yang UDAH LURUS ke detection.py
        if getattr(cam_state, 'AI_ACTIVE', False):
            try:
                conf_val = getattr(cam_state, 'AI_CONFIDENCE', 0.5)
                frame_ai, new_counts = process_frame(frame, conf_threshold=conf_val) 
                frame = frame_ai
                
                # Tambah ke counter global
                cam_state.count_matang = getattr(cam_state, 'count_matang', 0) + new_counts.get('matang', 0)
                cam_state.count_mentah = getattr(cam_state, 'count_mentah', 0) + new_counts.get('mentah', 0)
                cam_state.count_bunga = getattr(cam_state, 'count_bunga', 0) + new_counts.get('bunga', 0)
                
            except Exception as e:
                print(f"❌ [CRASH DETEKSI AI]: {e}")
                cv2.putText(frame, "ERROR AI: CEK TERMINAL", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

        # Kirim frame ke HTML
        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')