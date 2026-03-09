from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_mail import Mail

# Inisialisasi kosong (tanpa app) biar aman dari circular import
db = SQLAlchemy()
login_manager = LoginManager()
mail = Mail()