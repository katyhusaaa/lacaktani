from app import app, db
from db_models import User
from werkzeug.security import generate_password_hash

with app.app_context():
    db.create_all()
    # Bikin akun default
    if not User.query.filter_by(username='agung').first():
        akun_1 = User(username='agung', password=generate_password_hash('admin123'))
        db.session.add(akun_1)
    if not User.query.filter_by(username='mary').first():
        akun_2 = User(username='mary', password=generate_password_hash('rahasia'))
        db.session.add(akun_2)
    db.session.commit()
    print("Database siap!")