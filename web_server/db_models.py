# db_models.py
from flask_login import UserMixin
from extensions import db
from datetime import datetime

class User(UserMixin, db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    
    # Pengaturan Kamera
    cam_res = db.Column(db.String(10), default="6")
    cam_bright = db.Column(db.Integer, default=0)
    cam_contrast = db.Column(db.Integer, default=0)
    cam_sat = db.Column(db.Integer, default=0)
    cam_exp = db.Column(db.Integer, default=0)
    
    # Pengaturan AI 
    ai_conf = db.Column(db.Float, default=0.50)
    cam_vflip = db.Column(db.Integer, default=0)
    cam_hmirror = db.Column(db.Integer, default=0)
    cam_awb = db.Column(db.Integer, default=1) 
    cam_aec = db.Column(db.Integer, default=1) 
    cam_lenc = db.Column(db.Integer, default=1) 

# ==========================================
# TABEL BARU UNTUK SESI PATROLI & BYTETRACK
# ==========================================

class FlightSession(db.Model):
    """Menyimpan data per 'Klik Mulai Patroli' sampai 'Akhiri'"""
    __tablename__ = 'flight_session'
    
    id = db.Column(db.Integer, primary_key=True)
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)
    
    # Akumulasi Panen (Diupdate saat sesi diakhiri)
    total_matang = db.Column(db.Integer, default=0)
    total_mentah = db.Column(db.Integer, default=0)
    total_bunga = db.Column(db.Integer, default=0)
    
    # Status: 'active' (lagi terbang) atau 'completed' (sudah mendarat)
    status = db.Column(db.String(20), default='active')
    
    # Relasi ke tabel DetectionLog (1 Sesi punya banyak record deteksi)
    # cascade="all, delete-orphan" -> Kalau sesi dihapus, detail deteksinya ikut kehapus biar bersih
    detections = db.relationship('DetectionLog', backref='session', lazy=True, cascade="all, delete-orphan")

class DetectionLog(db.Model):
    """Menyimpan setiap stroberi unik yang ditangkap ByteTrack"""
    __tablename__ = 'detection_log'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('flight_session.id'), nullable=False)
    
    # ID Unik dari ByteTrack (KTP Stroberi)
    track_id = db.Column(db.Integer, nullable=False)
    
    # Hasil Klasifikasi AI
    label = db.Column(db.String(50), nullable=False)
    confidence = db.Column(db.Float, nullable=True)
    
    # ==========================================
    # PERSIAPAN GEO-HEATMAP (FUTURE-PROOF)
    # Boleh dibiarkan kosong (NULL) untuk sekarang
    # ==========================================
    lat = db.Column(db.Float, nullable=True)
    lng = db.Column(db.Float, nullable=True)
    
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)