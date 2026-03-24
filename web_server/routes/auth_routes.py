import os
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, url_for, current_app, render_template, redirect, flash
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import login_user, login_required, logout_user, current_user
from itsdangerous import URLSafeTimedSerializer
from flask_mail import Message

from extensions import db, mail
from db_models import User
from core.camera_state import cam_state

auth_bp = Blueprint('auth', __name__)

# Konfigurasi Ekstensi Gambar yang diizinkan
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ==========================================
# 1. FUNGSI TOKEN & VERIFIKASI EMAIL
# ==========================================
def generate_verification_token(email):
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    return serializer.dumps(email, salt='email-verify')

@auth_bp.route('/api/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email')
    username = data.get('username')
    
    if User.query.filter_by(username=username).first():
        return jsonify({'status': 'error', 'message': 'Username sudah terpakai!'})
    if User.query.filter_by(email=email).first():
        return jsonify({'status': 'error', 'message': 'Email sudah terdaftar!'})
        
    new_user = User(
        nama_lengkap=data.get('nama_lengkap'),
        email=email,
        username=username, 
        password=generate_password_hash(data.get('password'), method='pbkdf2:sha256'),
        is_verified=False # Akun dikunci dari awal
    )
    db.session.add(new_user)
    db.session.commit()
    
    # Generate Token & Kirim Email
    token = generate_verification_token(email)
    confirm_url = url_for('auth.verify_email', token=token, _external=True)
    
    # Bikin HTML Email yang dikirim
    html_isi = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="background-color: #F8FAFC; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 40px 10px;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #E2E8F0;">
            <div style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); padding: 32px 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">LacakTani<span style="color: #E11D48;">.ai</span></h1>
                <p style="color: #94A3B8; font-size: 13px; margin: 8px 0 0 0; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">Ground Control Station</p>
            </div>
            <div style="padding: 40px 30px; text-align: center;">
                <div style="background-color: #FFF1F2; width: 64px; height: 64px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 24px;"><span style="font-size: 28px;">🔐</span></div>
                <h2 style="margin: 0 0 16px 0; font-size: 22px; color: #0F172A; font-weight: 800;">Verifikasi Akun Anda</h2>
                <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 12px 0;">Halo <strong>{new_user.nama_lengkap}</strong>,</p>
                <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 32px 0;">Terima kasih telah mendaftar sebagai operator di sistem <strong>LacakTani.ai</strong>. Untuk alasan keamanan, silakan verifikasi alamat email Anda agar dapat mengakses Workspace.</p>
                <div style="margin-bottom: 32px;"><a href="{confirm_url}" style="background-color: #E11D48; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 4px 15px rgba(225, 29, 72, 0.3);">Aktifkan Akun Saya</a></div>
                <div style="background-color: #F8FAFC; border-radius: 8px; padding: 16px; border: 1px dashed #CBD5E1;"><p style="font-size: 12px; color: #64748B; margin: 0; line-height: 1.5;">*Tautan ini menggunakan enkripsi aman dan akan otomatis hangus dalam <strong>1 jam</strong> ke depan. Jika Anda tidak merasa mendaftar, abaikan email ini.</p></div>
            </div>
            <div style="background-color: #F1F5F9; padding: 24px; text-align: center; border-top: 1px solid #E2E8F0;">
                <p style="margin: 0; font-size: 12px; color: #64748B; font-weight: 600;">&copy; 2026 LacakTani Project.</p>
                <p style="margin: 4px 0 0 0; font-size: 11px; color: #94A3B8;">Politeknik Negeri Jakarta - D3 Telekomunikasi</p>
                <p style="margin: 16px 0 0 0; font-size: 10px; color: #CBD5E1;">Email ini dikirim secara otomatis oleh sistem bot LacakTani. Jangan membalas email ini.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        msg = Message("Verifikasi Akun LacakTani.ai Anda", recipients=[email], html=html_isi)
        mail.send(msg)
        return jsonify({'status': 'success', 'message': 'Registrasi sukses! Silakan cek Kotak Masuk email Anda untuk verifikasi.'})
    except Exception as e:
        # Jika gagal kirim email, hapus user yang baru dibuat biar gak nyangkut
        db.session.delete(new_user)
        db.session.commit()
        return jsonify({'status': 'error', 'message': f'Gagal mengirim email: {str(e)}'}), 500

@auth_bp.route('/verify/<token>')
def verify_email(token):
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    try:
        email = serializer.loads(token, salt='email-verify', max_age=3600)
    except:
        return render_template('verify.html', status='error', message='Link verifikasi tidak valid atau sudah kedaluwarsa. Silakan daftar ulang.')
        
    user = User.query.filter_by(email=email).first()
    if not user:
        return render_template('verify.html', status='error', message='Pengguna tidak ditemukan di sistem.')
    if user.is_verified:
        return render_template('verify.html', status='info', message='Akun Anda sudah diverifikasi sebelumnya. Tidak perlu klik link ini lagi.')
        
    user.is_verified = True
    db.session.commit()
    return render_template('verify.html', status='success', message='Selamat! Akun Anda telah aktif sepenuhnya. Silakan kembali ke aplikasi untuk mulai memantau lahan.')

# ==========================================
# 2. SISTEM LOGIN & LOGOUT
# ==========================================
@auth_bp.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data.get('username')).first()
    
    if user and check_password_hash(user.password, data.get('password')):
        if not user.is_verified:
            return jsonify({'status': 'error', 'message': 'Akun belum aktif! Silakan cek email Anda untuk verifikasi.'})
            
        login_user(user)
        
        # --- TAMBAHAN BARU: Tarik data rotasi dari DB ke Memori Global pas login ---
        try:
            cam_state.cam_rotate = str(getattr(user, 'cam_rotate', '0'))
            cam_state.cam_hflip = str(getattr(user, 'cam_hflip', '0'))
            cam_state.AI_CONFIDENCE = float(getattr(user, 'ai_conf', 0.5))
        except:
            pass
        # ---------------------------------------------------------------------
        
        return jsonify({'status': 'success'})
        
    return jsonify({'status': 'error', 'message': 'Username atau password salah!'})

@auth_bp.route('/logout')
@login_required
def logout():
    """Mengeluarkan user dan kembali ke rute '/' (landing.html)"""
    logout_user()
    return redirect(url_for('main.index'))

# ==========================================
# 3. MANAJEMEN AKUN (PROFIL, SANDI, EMAIL, FOTO, HAPUS)
# ==========================================

# --- GANTI NAMA SAJA ---
@auth_bp.route('/api/update_profile', methods=['POST'])
@login_required
def update_profile():
    data = request.json
    new_name = data.get('nama_lengkap')
    
    if not new_name or len(new_name.strip()) < 3:
        return jsonify({'status': 'error', 'message': 'Nama minimal 3 karakter!'}), 400
        
    current_user.nama_lengkap = new_name
    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Nama berhasil diperbarui!'})

# --- GANTI FOTO PROFIL ---
@auth_bp.route('/api/upload_avatar', methods=['POST'])
@login_required
def upload_avatar():
    if 'foto' not in request.files:
        return jsonify({'status': 'error', 'message': 'Tidak ada file yang terdeteksi.'}), 400
    
    file = request.files['foto']
    
    if file.filename == '':
        return jsonify({'status': 'error', 'message': 'File kosong.'}), 400

    if file and allowed_file(file.filename):
        # 1. Bikin ekstensi jadi lowercase dan bikin nama file yang unik & aman
        ext = file.filename.rsplit('.', 1)[1].lower()
        import uuid # Pastikan udah import uuid di atas file
        filename = secure_filename(f"avatar_{current_user.id}_{uuid.uuid4().hex[:8]}.{ext}")
        
        # 2. Pastikan Folder Upload beneran ada!
        upload_folder = os.path.join(current_app.root_path, 'static', 'uploads')
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
            
        filepath = os.path.join(upload_folder, filename)
        
        try:
            # 3. Simpan file fisik ke folder
            file.save(filepath)
            
            # 4. Hapus foto lama biar server nggak penuh (Opsional tapi bagus)
            if current_user.avatar:
                old_filepath = os.path.join(upload_folder, current_user.avatar)
                if os.path.exists(old_filepath):
                    os.remove(old_filepath)
            
            # 5. Simpan nama file baru ke Database
            current_user.avatar = filename
            db.session.commit()
            
            return jsonify({'status': 'success', 'message': 'Foto profil diperbarui!'})
            
        except Exception as e:
            print(f"Error saving upload: {str(e)}") # Ini bakal muncul di terminal Python lu
            return jsonify({'status': 'error', 'message': 'Gagal menyimpan file ke server.'}), 500
            
    else:
        return jsonify({'status': 'error', 'message': 'Format tidak didukung. Gunakan .png atau .jpg!'}), 400

# --- REQUEST GANTI EMAIL ---
@auth_bp.route('/api/request_email_change', methods=['POST'])
@login_required
def request_email_change():
    data = request.json
    new_email = data.get('new_email')
    password_confirm = data.get('password')

    if not check_password_hash(current_user.password, password_confirm):
        return jsonify({'status': 'error', 'message': 'Otorisasi Gagal: Kata sandi Anda salah!'}), 401

    if new_email == current_user.email:
        return jsonify({'status': 'error', 'message': 'Email baru tidak boleh sama dengan email saat ini!'}), 400

    if User.query.filter_by(email=new_email).first():
        return jsonify({'status': 'error', 'message': 'Email tersebut sudah digunakan oleh akun lain!'}), 400

    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    token_data = {'user_id': current_user.id, 'new_email': new_email}
    token = serializer.dumps(token_data, salt='email-change') 

    confirm_url = url_for('auth.verify_email_change', token=token, _external=True)

    html_isi = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="background-color: #F8FAFC; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 40px 10px;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #E2E8F0;">
            <div style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); padding: 32px 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">LacakTani<span style="color: #0EA5E9;">.ai</span></h1>
                <p style="color: #94A3B8; font-size: 13px; margin: 8px 0 0 0; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">Keamanan Sistem</p>
            </div>
            <div style="padding: 40px 30px; text-align: center;">
                <div style="background-color: #F0F9FF; color: #0EA5E9; width: 64px; height: 64px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 24px; font-size: 28px;">🔄</div>
                <h2 style="margin: 0 0 16px 0; font-size: 22px; color: #0F172A; font-weight: 800;">Konfirmasi Email Baru</h2>
                <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 12px 0;">Halo <strong>{current_user.nama_lengkap}</strong>,</p>
                <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 32px 0;">Kami menerima permintaan untuk mengubah alamat email akun LacakTani.ai Anda menjadi <strong>{new_email}</strong>. Silakan konfirmasi perubahan ini.</p>
                <div style="margin-bottom: 32px;"><a href="{confirm_url}" style="background-color: #0F172A; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 4px 15px rgba(15, 23, 42, 0.3);">Konfirmasi & Ubah Email</a></div>
                <div style="background-color: #FFF1F2; border-radius: 8px; padding: 16px; border: 1px dashed #FDA4AF; text-align: left;">
                    <p style="font-size: 12px; color: #BE123C; margin: 0; line-height: 1.5;"><strong>⚠️ Peringatan Keamanan:</strong> Jika Anda tidak pernah meminta perubahan ini, abaikan email ini. Tautan otomatis hangus dalam 1 jam.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        msg = Message("Konfirmasi Perubahan Email LacakTani.ai", recipients=[new_email], html=html_isi)
        mail.send(msg)
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Gagal mengirim email: {str(e)}'}), 500

# --- VERIFIKASI KLIK GANTI EMAIL ---
@auth_bp.route('/verify_email_change/<token>')
def verify_email_change(token):
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    try:
        data = serializer.loads(token, salt='email-change', max_age=3600)
        user_id = data.get('user_id')
        new_email = data.get('new_email')
    except:
        return render_template('verify.html', status='error', message='Link verifikasi tidak valid atau sudah kedaluwarsa. Silakan minta ulang dari Workspace.')
        
    user = User.query.get(user_id)
    if not user:
        return render_template('verify.html', status='error', message='Sistem mendeteksi anomali. Pengguna tidak ditemukan.')

    if User.query.filter_by(email=new_email).first():
        return render_template('verify.html', status='error', message='Gagal merubah! Alamat email tersebut sudah tidak tersedia.')

    user.email = new_email
    db.session.commit()
    
    # Keluarin user biar dia login ulang
    if current_user.is_authenticated:
        logout_user()
    
    return render_template('verify.html', status='success', message=f'Identitas berhasil di-update! Email Anda telah diubah menjadi {new_email}. Silakan login kembali.')

# --- GANTI PASSWORD ---
@auth_bp.route('/api/update_password', methods=['POST'])
@login_required
def update_password():
    data = request.json
    old_pass = data.get('old_password')
    new_pass = data.get('new_password')
    
    if not check_password_hash(current_user.password, old_pass):
        return jsonify({'status': 'error', 'message': 'Kata sandi lama salah!'}), 400
        
    current_user.password = generate_password_hash(new_pass, method='pbkdf2:sha256')
    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Kata sandi berhasil diubah!'})

# --- HAPUS AKUN ---
@auth_bp.route('/api/delete_account', methods=['POST'])
@login_required
def delete_account():
    user = User.query.get(current_user.id)
    if user:
        logout_user() 
        db.session.delete(user)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Akun berhasil dihapus.'})
    
    return jsonify({'status': 'error', 'message': 'User tidak ditemukan.'}), 404

# ==========================================
# 4. FUNGSI RECOVERY & RESET PASSWORD
# ==========================================

def get_reset_token(email, expires_sec=1800):
    """Bikin token unik yang expired dalam 30 menit (1800 detik)"""
    s = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    return s.dumps(email, salt='reset-password-salt')

def verify_reset_token(token, expires_sec=1800):
    """Ngecek tokennya asli dan belum expired atau nggak"""
    s = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    try:
        email = s.loads(token, salt='reset-password-salt', max_age=expires_sec)
    except:
        return None
    return email

# API Ini dipanggil oleh Javascript di modal Lupa Akun
@auth_bp.route('/api/recovery', methods=['POST'])
def api_recovery():
    data = request.json
    email = data.get('email')
    
    user = User.query.filter_by(email=email).first()
    
    if user:
        # Kirim Email Gabungan (Username + Link Reset Password)
        token = get_reset_token(user.email)
        reset_url = url_for('auth.reset_password', token=token, _external=True)
        
        # Desain HTML untuk Email Recovery
        html_isi = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="background-color: #F8FAFC; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 40px 10px;">
            <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #E2E8F0;">
                <div style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); padding: 32px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">LacakTani<span style="color: #E11D48;">.ai</span></h1>
                    <p style="color: #94A3B8; font-size: 13px; margin: 8px 0 0 0; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">Pemulihan Akun</p>
                </div>
                <div style="padding: 40px 30px; text-align: center;">
                    <div style="background-color: #F0F9FF; width: 64px; height: 64px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 24px;"><span style="font-size: 28px;">🔑</span></div>
                    <h2 style="margin: 0 0 16px 0; font-size: 22px; color: #0F172A; font-weight: 800;">Informasi Akun Anda</h2>
                    <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 16px 0;">Halo <strong>{user.nama_lengkap}</strong>,</p>
                    <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">Sesuai permintaan Anda, berikut adalah detail username yang terdaftar di sistem kami:</p>
                    
                    <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin-bottom: 32px;">
                        <span style="font-size: 12px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 1px;">Username Anda</span>
                        <div style="font-size: 22px; font-weight: 900; color: #0EA5E9; margin-top: 4px; letter-spacing: 1px;">{user.username}</div>
                    </div>

                    <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">Jika Anda juga melupakan kata sandi (password), silakan klik tombol di bawah ini untuk membuat sandi baru:</p>

                    <div style="margin-bottom: 32px;"><a href="{reset_url}" style="background-color: #E11D48; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 800; font-size: 15px; display: inline-block; box-shadow: 0 4px 15px rgba(225, 29, 72, 0.3);">Buat Password Baru</a></div>
                    
                    <div style="background-color: #FFF1F2; border-radius: 8px; padding: 16px; border: 1px dashed #FDA4AF; text-align: left;">
                        <p style="font-size: 12px; color: #BE123C; margin: 0; line-height: 1.5;"><strong>⚠️ Peringatan Keamanan:</strong> Tautan reset password akan otomatis hangus dalam <strong>30 menit</strong>. Jika Anda sudah mengingat password Anda atau tidak meminta email ini, abaikan saja.</p>
                    </div>
                </div>
                <div style="background-color: #F1F5F9; padding: 24px; text-align: center; border-top: 1px solid #E2E8F0;">
                    <p style="margin: 0; font-size: 12px; color: #64748B; font-weight: 600;">&copy; 2026 LacakTani Project.</p>
                    <p style="margin: 4px 0 0 0; font-size: 11px; color: #94A3B8;">Politeknik Negeri Jakarta - D3 Telekomunikasi</p>
                    <p style="margin: 16px 0 0 0; font-size: 10px; color: #CBD5E1;">Email ini dikirim secara otomatis oleh sistem bot LacakTani. Jangan membalas email ini.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        try:
            # PENTING: Perhatikan penambahan parameter html=html_isi di sini
            msg = Message("Pemulihan Akun LacakTani.ai Anda", recipients=[email], html=html_isi)
            mail.send(msg)
            return jsonify({'status': 'success', 'message': 'Username dan instruksi reset password telah dikirim ke email Anda.'})
        except Exception as e:
            return jsonify({'status': 'error', 'message': 'Gagal mengirim email. Pastikan koneksi server stabil.'}), 500
    else:
        return jsonify({'status': 'error', 'message': 'Email tidak ditemukan di sistem kami.'}), 404

# Rute ini diakses saat user ngeklik link dari dalam Email mereka
@auth_bp.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    # Cek token
    email = verify_reset_token(token)
    if not email:
        flash('Token reset password tidak valid atau sudah kadaluarsa (lebih dari 30 menit).', 'danger')
        return redirect(url_for('main.index')) # Kembali ke halaman depan
        
    if request.method == 'POST':
        new_password = request.form.get('password')
        
        # Cari user berdasarkan email dari token
        user = User.query.filter_by(email=email).first()
        if user:
            # Hash password baru dan simpan ke DB (samain methodnya kayak pas register)
            user.password = generate_password_hash(new_password, method='pbkdf2:sha256') 
            db.session.commit()
            
            flash('Password Anda berhasil diubah! Silakan login di menu Workspace.', 'success')
            return redirect(url_for('main.index')) # Kembali ke halaman depan buat login
            
    # Tampilkan halaman ganti password jika token valid
    return render_template('reset_password.html', token=token)