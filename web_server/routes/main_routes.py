# routes/main_routes.py
from flask import Blueprint, render_template
from flask_login import current_user, login_required 
from db_models import FlightSession

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