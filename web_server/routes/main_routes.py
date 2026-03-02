# routes/main_routes.py
from flask import Blueprint, render_template
from flask_login import current_user

# Bikin blueprint 'main'
main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    if current_user.is_authenticated:
        return render_template('dashboard.html')
    else:
        return render_template('landing.html')