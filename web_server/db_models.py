from flask_login import UserMixin
from extensions import db

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

    # --- TAMBAHAN UNTUK AI VISION ---
    cam_vflip = db.Column(db.Integer, default=0)
    cam_hmirror = db.Column(db.Integer, default=0)
    cam_awb = db.Column(db.Integer, default=1) # 1 = Aktif
    cam_aec = db.Column(db.Integer, default=1) # 1 = Aktif
    cam_lenc = db.Column(db.Integer, default=1) # 1 = Aktif