# routes/auth_routes.py
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import login_user, login_required, logout_user

# Import database dan brankas state kamera
from extensions import db
from db_models import User
from core.camera_state import cam_state

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if User.query.filter_by(username=username).first():
        return jsonify({'status': 'error', 'message': 'Username sudah terpakai!'})
        
    new_user = User(username=username, password=generate_password_hash(password, method='pbkdf2:sha256'))
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Akun berhasil dibuat! Silakan login.'})

@auth_bp.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data.get('username')).first()
    if user and check_password_hash(user.password, data.get('password')):
        login_user(user)
        return jsonify({'status': 'success'})
    return jsonify({'status': 'error', 'message': 'Username atau password salah!'})

@auth_bp.route('/api/logout', methods=['POST'])
@login_required
def logout():
    # Matikan koneksi kamera dan AI saat user logout biar ga makan memori
    cam_state.ACTIVE_CAMERA_URL = None 
    cam_state.AI_ACTIVE = False
    logout_user()
    return jsonify({'status': 'success'})