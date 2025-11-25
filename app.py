from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import pickle
import os
import json
import jwt
from functools import wraps

app = Flask(__name__, static_folder='static', static_url_path='')

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'moodmate-secret-key-2025')

# Database - Use PostgreSQL on Render, SQLite locally
database_url = os.environ.get('DATABASE_URL', 'sqlite:///moodmate.db')
# Fix for Render PostgreSQL URL
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    entries = db.relationship('DiaryEntry', backref='user', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name or self.email.split('@')[0]
        }


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


# JWT Token decorator
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


# Helper Functions
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
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        name = data.get('name', '').strip()

        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400

        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already registered'}), 400

        user = User(
            email=email,
            password=generate_password_hash(password),
            name=name or email.split('@')[0]
        )
        db.session.add(user)
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


@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    return jsonify(current_user.to_dict())


# Static Routes
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join('static', path)):
        return send_from_directory('static', path)
    return send_from_directory('static', 'index.html')


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


# Analytics Routes (Protected)
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


# Create tables
with app.app_context():
    db.create_all()


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
