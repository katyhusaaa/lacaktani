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

app = Flask(__name__)

# Konfigurasi Setup
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'fallback-rahasia')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URI', 'sqlite:///lacaktani.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'business-logic/models' 
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024 

# Inisialisasi Database & Login
db.init_app(app)
login_manager.init_app(app)

# Arahkan ke rute 'main.index' (karena fungsi index ada di main_routes.py)
login_manager.login_view = 'main.index'

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

if __name__ == '__main__':
    # Hapus threaded=True kalau nanti pakai Waitress/Gunicorn, tapi untuk dev biarkan saja
    app.run(debug=True, port=5000, threaded=True)