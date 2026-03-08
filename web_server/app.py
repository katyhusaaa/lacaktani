import os
from dotenv import load_dotenv
load_dotenv() # Load env paling pertama!

from flask import Flask
from extensions import db, login_manager
from db_models import User

# Import semua Blueprint yang udah kita bikin
from routes.main_routes import main_bp
from routes.auth_routes import auth_bp
from routes.cam_routes import cam_bp

from datetime import timedelta # Tambahin import ini di atas

app = Flask(__name__)

# Konfigurasi Setup
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'fallback-rahasia')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URI', 'sqlite:///lacaktani.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'business-logic/models' 
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 

# --- SECURITY FIX: Batas Umur Sesi (Rule 01) ---
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=1) # Sesi otomatis mati dalam 24 jam
# -----------------------------------------------

db.init_app(app)
login_manager.init_app(app)
login_manager.login_view = 'main.index' # Biar kalo blm login dilempar ke landing page
login_manager.login_message = "Silakan login terlebih dahulu." # Pesan default

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Create database if not exists
with app.app_context():
    db.create_all()

# Daftarkan semua rute (Registry)
app.register_blueprint(main_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(cam_bp)

# ==========================================
# SECURITY PATCH: HTTP HEADERS (Berdasarkan Hasil Pentest ZAP)
# ==========================================
@app.after_request
def add_security_headers(response):
    # 1. Fix: Missing Anti-clickjacking Header
    # Mencegah web lu ditempel di dalam <iframe> oleh web penipu
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    
    # 2. Fix: X-Content-Type-Options Header Missing
    # Mencegah browser menebak-nebak tipe file yang bisa memicu eksekusi script jahat
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # 3. Fix: Content Security Policy (CSP) Header Not Set
    # Membatasi dari mana saja web boleh memuat gambar, script, atau font
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; "
        "style-src 'self' 'unsafe-inline' https://api.fontshare.com; "
        "font-src 'self' https://api.fontshare.com https://cdn.fontshare.com; "
        "img-src 'self' data: blob: *; "
        "connect-src 'self' http://*; "
    )
    response.headers['Content-Security-Policy'] = csp
    
    # 4. Fix: Server Leaks Version Information
    # Menyembunyikan fakta bahwa lu pakai Werkzeug/Python biar hacker nggak tau
    response.headers['Server'] = 'LacakTani-Core'
    
    return response

if __name__ == '__main__':
    # Hapus threaded=True kalau nanti pakai Waitress/Gunicorn, tapi untuk dev biarkan saja
    app.run(debug=True, port=5000, threaded=True)