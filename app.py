from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import pickle
import os
import json
import jwt
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from functools import wraps

app = Flask(__name__, static_folder='static', static_url_path='')

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'moodmate-secret-key-2025')

# Email Configuration
SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_EMAIL = os.environ.get('SMTP_EMAIL', '')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')

# Database
database_url = os.environ.get('DATABASE_URL', 'sqlite:///moodmate.db')
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
# Add SSL mode for PostgreSQL on Render
if 'postgresql://' in database_url and 'sslmode' not in database_url:
    database_url += '?sslmode=require'
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Load ML Model
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models')

try:
    with open(os.path.join(MODEL_PATH, 'sentiment_model.pkl'), 'rb') as f:
        model = pickle.load(f)
    with open(os.path.join(MODEL_PATH, 'vectorizer.pkl'), 'rb') as f:
        vectorizer = pickle.load(f)
    with open(os.path.join(MODEL_PATH, 'label_mapping.pkl'), 'rb') as f:
        label_mapping = pickle.load(f)
    MODEL_LOADED = True
    print("[OK] Sentiment model loaded successfully!")
except Exception as e:
    print(f"[ERROR] Error loading model: {e}")
    MODEL_LOADED = False


# Database Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(256), nullable=False)
    name = db.Column(db.String(100))
    is_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    entries = db.relationship('DiaryEntry', backref='user', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name or self.email.split('@')[0]
        }


class OTP(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False)
    otp = db.Column(db.String(6), nullable=False)
    purpose = db.Column(db.String(20), nullable=False)  # 'signup' or 'reset'
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class DiaryEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    primary_emotion = db.Column(db.String(50))
    emotion_confidence = db.Column(db.Float)
    sentiment_score = db.Column(db.Float)
    emotion_probabilities = db.Column(db.Text)
    mood_category = db.Column(db.String(20))

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'primary_emotion': self.primary_emotion,
            'emotion_confidence': self.emotion_confidence,
            'sentiment_score': self.sentiment_score,
            'emotion_probabilities': json.loads(self.emotion_probabilities) if self.emotion_probabilities else {},
            'mood_category': self.mood_category
        }


# Helper Functions
def send_email(to_email, subject, body):
    """Send email using SMTP."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"[EMAIL] Would send to {to_email}: {subject}")
        return True  # Skip in dev mode
    
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
        return False


def generate_otp():
    """Generate 6-digit OTP."""
    return str(random.randint(100000, 999999))


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]

        if not token:
            return jsonify({'error': 'Token is missing'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = User.query.get(data['user_id'])
            if not current_user:
                return jsonify({'error': 'User not found'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

        return f(current_user, *args, **kwargs)
    return decorated


def analyze_sentiment(text):
    if not MODEL_LOADED:
        return None, None, None, None, None

    text = text.lower().strip()
    if not text:
        return None, None, None, None, None

    text_tfidf = vectorizer.transform([text])
    prediction = model.predict(text_tfidf)[0]
    probabilities = model.predict_proba(text_tfidf)[0]

    emotion = label_mapping[prediction]
    confidence = float(probabilities[prediction])

    positive_emotions = {'joy': 1, 'love': 1, 'surprise': 0.5}
    negative_emotions = {'sadness': -1, 'anger': -1, 'fear': -0.8}

    if emotion in positive_emotions:
        sentiment_score = positive_emotions[emotion] * confidence
    elif emotion in negative_emotions:
        sentiment_score = negative_emotions[emotion] * confidence
    else:
        sentiment_score = 0

    if sentiment_score > 0.3:
        mood_category = 'positive'
    elif sentiment_score < -0.3:
        mood_category = 'negative'
    else:
        mood_category = 'neutral'

    all_probs = {label_mapping[i]: float(probabilities[i]) for i in range(len(label_mapping))}
    return emotion, confidence, sentiment_score, all_probs, mood_category


# Auth Routes
@app.route('/api/auth/send-otp', methods=['POST'])
def send_otp():
    """Send OTP for signup or password reset."""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        purpose = data.get('purpose', 'signup')  # 'signup' or 'reset'

        if not email:
            return jsonify({'error': 'Email is required'}), 400

        # For signup, check if email already exists
        if purpose == 'signup':
            if User.query.filter_by(email=email).first():
                return jsonify({'error': 'Email already registered'}), 400
        # For reset, check if email exists
        elif purpose == 'reset':
            if not User.query.filter_by(email=email).first():
                return jsonify({'error': 'Email not found'}), 404

        # Delete old OTPs for this email
        OTP.query.filter_by(email=email, purpose=purpose).delete()
        
        # Generate and save new OTP
        otp_code = generate_otp()
        otp = OTP(
            email=email,
            otp=otp_code,
            purpose=purpose,
            expires_at=datetime.utcnow() + timedelta(minutes=10)
        )
        db.session.add(otp)
        db.session.commit()

        # Send email
        subject = "MoodMate - Verify Your Email" if purpose == 'signup' else "MoodMate - Reset Password"
        body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #2dd4bf;">MoodMate</h2>
            <p>Your verification code is:</p>
            <h1 style="color: #2dd4bf; font-size: 32px; letter-spacing: 5px;">{otp_code}</h1>
            <p>This code expires in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
        </body>
        </html>
        """
        
        if send_email(email, subject, body):
            return jsonify({'success': True, 'message': 'OTP sent to your email'})
        else:
            return jsonify({'error': 'Failed to send email. Please try again.'}), 500

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/verify-otp', methods=['POST'])
def verify_otp():
    """Verify OTP."""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        otp_code = data.get('otp', '').strip()
        purpose = data.get('purpose', 'signup')

        if not email or not otp_code:
            return jsonify({'error': 'Email and OTP are required'}), 400

        otp = OTP.query.filter_by(email=email, otp=otp_code, purpose=purpose).first()
        
        if not otp:
            return jsonify({'error': 'Invalid OTP'}), 400
        
        if otp.expires_at < datetime.utcnow():
            OTP.query.filter_by(email=email, purpose=purpose).delete()
            db.session.commit()
            return jsonify({'error': 'OTP has expired'}), 400

        return jsonify({'success': True, 'message': 'OTP verified'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/signup', methods=['POST'])
def signup():
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        name = data.get('name', '').strip()
        otp_code = data.get('otp', '').strip()

        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400

        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already registered'}), 400

        # Verify OTP
        otp = OTP.query.filter_by(email=email, otp=otp_code, purpose='signup').first()
        if not otp or otp.expires_at < datetime.utcnow():
            return jsonify({'error': 'Invalid or expired OTP'}), 400

        # Create user
        user = User(
            email=email,
            password=generate_password_hash(password),
            name=name or email.split('@')[0],
            is_verified=True
        )
        db.session.add(user)
        
        # Delete used OTP
        OTP.query.filter_by(email=email, purpose='signup').delete()
        db.session.commit()

        token = jwt.encode({
            'user_id': user.id,
            'exp': datetime.utcnow() + timedelta(days=30)
        }, app.config['SECRET_KEY'], algorithm='HS256')

        return jsonify({
            'success': True,
            'token': token,
            'user': user.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400

        user = User.query.filter_by(email=email).first()
        if not user or not check_password_hash(user.password, password):
            return jsonify({'error': 'Invalid email or password'}), 401

        token = jwt.encode({
            'user_id': user.id,
            'exp': datetime.utcnow() + timedelta(days=30)
        }, app.config['SECRET_KEY'], algorithm='HS256')

        return jsonify({
            'success': True,
            'token': token,
            'user': user.to_dict()
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    """Reset password with OTP verification."""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        otp_code = data.get('otp', '').strip()
        new_password = data.get('new_password', '')

        if not email or not otp_code or not new_password:
            return jsonify({'error': 'Email, OTP, and new password are required'}), 400

        if len(new_password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400

        # Verify OTP
        otp = OTP.query.filter_by(email=email, otp=otp_code, purpose='reset').first()
        if not otp or otp.expires_at < datetime.utcnow():
            return jsonify({'error': 'Invalid or expired OTP'}), 400

        # Update password
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404

        user.password = generate_password_hash(new_password)
        
        # Delete used OTP
        OTP.query.filter_by(email=email, purpose='reset').delete()
        db.session.commit()

        return jsonify({'success': True, 'message': 'Password reset successfully'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    return jsonify(current_user.to_dict())


# Static Routes - SPA support for React Router
@app.route('/')
@app.route('/login')
@app.route('/signup')
@app.route('/forgot-password')
@app.route('/entries')
@app.route('/dashboard')
def serve_spa():
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    # Check if it's an API route (shouldn't reach here, but just in case)
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    
    # Try to serve static file
    static_file = os.path.join(app.static_folder, path)
    if os.path.exists(static_file) and os.path.isfile(static_file):
        return send_from_directory(app.static_folder, path)
    
    # For all other routes, serve index.html (React Router handles it)
    return send_from_directory(app.static_folder, 'index.html')


# 404 handler - serve SPA for non-API routes, JSON for API routes
@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Not found'}), 404
    return send_from_directory(app.static_folder, 'index.html')


# Entry Routes (Protected)
@app.route('/api/entries', methods=['GET'])
@token_required
def get_entries(current_user):
    try:
        entries = DiaryEntry.query.filter_by(user_id=current_user.id).order_by(DiaryEntry.created_at.desc()).all()
        return jsonify([e.to_dict() for e in entries])
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/entries/<int:entry_id>', methods=['GET'])
@token_required
def get_entry(current_user, entry_id):
    try:
        entry = DiaryEntry.query.filter_by(id=entry_id, user_id=current_user.id).first()
        if not entry:
            return jsonify({'error': 'Entry not found'}), 404
        return jsonify(entry.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/entries', methods=['POST'])
@token_required
def create_entry(current_user):
    try:
        data = request.get_json()
        title = data.get('title', 'Untitled').strip()
        content = data.get('content', '').strip()

        if not content:
            return jsonify({'error': 'Content is required'}), 400

        emotion, confidence, sentiment_score, all_probs, mood_category = analyze_sentiment(content)

        entry = DiaryEntry(
            user_id=current_user.id,
            title=title or 'Untitled',
            content=content,
            primary_emotion=emotion,
            emotion_confidence=confidence,
            sentiment_score=sentiment_score,
            emotion_probabilities=json.dumps(all_probs) if all_probs else '{}',
            mood_category=mood_category
        )

        db.session.add(entry)
        db.session.commit()

        return jsonify({
            'success': True,
            'entry': entry.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/entries/<int:entry_id>', methods=['PUT'])
@token_required
def update_entry(current_user, entry_id):
    try:
        entry = DiaryEntry.query.filter_by(id=entry_id, user_id=current_user.id).first()
        if not entry:
            return jsonify({'error': 'Entry not found'}), 404

        data = request.get_json()

        if 'title' in data:
            entry.title = data['title'].strip()

        if 'content' in data:
            content = data['content'].strip()
            if not content:
                return jsonify({'error': 'Content cannot be empty'}), 400

            entry.content = content
            emotion, confidence, sentiment_score, all_probs, mood_category = analyze_sentiment(content)
            entry.primary_emotion = emotion
            entry.emotion_confidence = confidence
            entry.sentiment_score = sentiment_score
            entry.emotion_probabilities = json.dumps(all_probs) if all_probs else '{}'
            entry.mood_category = mood_category

        entry.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'success': True,
            'entry': entry.to_dict()
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/entries/<int:entry_id>', methods=['DELETE'])
@token_required
def delete_entry(current_user, entry_id):
    try:
        entry = DiaryEntry.query.filter_by(id=entry_id, user_id=current_user.id).first()
        if not entry:
            return jsonify({'error': 'Entry not found'}), 404

        db.session.delete(entry)
        db.session.commit()
        return jsonify({'success': True})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/entries/all', methods=['DELETE'])
@token_required
def delete_all_entries(current_user):
    try:
        DiaryEntry.query.filter_by(user_id=current_user.id).delete()
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# Analytics Routes
@app.route('/api/analytics/dashboard', methods=['GET'])
@token_required
def get_dashboard_analytics(current_user):
    try:
        period = request.args.get('period', 'week')
        specific_date = request.args.get('date')

        query = DiaryEntry.query.filter_by(user_id=current_user.id)

        if specific_date:
            try:
                filter_date = datetime.strptime(specific_date, '%Y-%m-%d')
                start_date = filter_date
                end_date = filter_date + timedelta(days=1)
                query = query.filter(DiaryEntry.created_at >= start_date, DiaryEntry.created_at < end_date)
            except ValueError:
                return jsonify({'error': 'Invalid date format'}), 400
        else:
            if period == 'week':
                start_date = datetime.utcnow() - timedelta(days=7)
            elif period == 'month':
                start_date = datetime.utcnow() - timedelta(days=30)
            else:
                start_date = datetime.utcnow() - timedelta(days=365)
            query = query.filter(DiaryEntry.created_at >= start_date)

        entries = query.all()

        total_entries = len(entries)
        positive_count = sum(1 for e in entries if e.mood_category == 'positive')
        neutral_count = sum(1 for e in entries if e.mood_category == 'neutral')
        negative_count = sum(1 for e in entries if e.mood_category == 'negative')

        emotion_counts = {}
        for entry in entries:
            if entry.primary_emotion:
                emotion_counts[entry.primary_emotion] = emotion_counts.get(entry.primary_emotion, 0) + 1

        sentiment_scores = [e.sentiment_score for e in entries if e.sentiment_score is not None]
        avg_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0

        return jsonify({
            'total_entries': total_entries,
            'mood_distribution': {
                'positive': positive_count,
                'neutral': neutral_count,
                'negative': negative_count
            },
            'emotion_distribution': emotion_counts,
            'average_sentiment': float(avg_sentiment),
            'period': period
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_loaded': MODEL_LOADED
    })


# Create tables and handle migrations
with app.app_context():
    db.create_all()
    
    # Add missing columns if they don't exist (for existing databases)
    from sqlalchemy import inspect, text
    inspector = inspect(db.engine)
    
    # Check if is_verified column exists in user table
    if 'user' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('user')]
        if 'is_verified' not in columns:
            try:
                db.session.execute(text('ALTER TABLE "user" ADD COLUMN is_verified BOOLEAN DEFAULT TRUE'))
                db.session.commit()
                print("[OK] Added is_verified column to user table")
            except Exception as e:
                db.session.rollback()
                print(f"[INFO] is_verified column might already exist: {e}")


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
