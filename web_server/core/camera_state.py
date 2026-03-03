# core/camera_state.py

class CameraState:
    def __init__(self):
        self.ACTIVE_CAMERA_URL = None
        self.current_fps = 0
        self.count_matang = 0
        self.count_mentah = 0
        self.count_bunga = 0
        self.AI_CONFIDENCE = 0.50
        self.CURRENT_MODEL = 'best.pt'
        self.AI_ACTIVE = False
        self.current_session_id = None # Buat nginget ID penerbangan yang lagi jalan

# Bikin satu "gudang" state yang bisa di-import dari mana aja
cam_state = CameraState()