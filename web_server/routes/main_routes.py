# routes/main_routes.py
from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import current_user, login_required, login_user
from db_models import FlightSession
# Pastikan Anda meng-import model User Anda. 
# Jika belum ada, sesuaikan dengan cara Anda membuat User di db_models.py
from db_models import User 

# Bikin blueprint 'main'
main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    if current_user.is_authenticated:
        return render_template('dashboard.html')
    else:
        return render_template('landing.html')
    
# --- RUTE BARU BUAT HALAMAN RIWAYAT ---
@main_bp.route('/history')
@login_required
def history():
    # Ambil semua data sesi dari yang paling baru (descending)
    sessions = FlightSession.query.order_by(FlightSession.id.desc()).all()
    return render_template('history.html', sessions=sessions)

# --- RUTE DOKUMENTASI (UDAH DIPERBAIKI) ---
@main_bp.route('/docs')
def docs():
    return render_template('docs.html')

# --- RUTE MANAJEMEN AKUN ---
@main_bp.route('/profile')
@login_required
def profile():
    return render_template('profile.html')
