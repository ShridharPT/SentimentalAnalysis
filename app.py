from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import pickle
import os
import json
from collections import defaultdict
from sqlalchemy import func

app = Flask(__name__, static_folder='static', static_url_path='')

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///moodmate.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'moodmate-secret-key-2025'

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
class DiaryEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Sentiment Analysis
    primary_emotion = db.Column(db.String(50))
    emotion_confidence = db.Column(db.Float)
    sentiment_score = db.Column(db.Float)  # -1 to 1 (negative to positive)
    
    # All emotion probabilities (stored as JSON)
    emotion_probabilities = db.Column(db.Text)
    
    # Mood category
    mood_category = db.Column(db.String(20))  # positive, neutral, negative
    
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
def analyze_sentiment(text):
    """Analyze sentiment of text using trained model."""
    if not MODEL_LOADED:
        return None, None, None, None
    
    text = text.lower().strip()
    if not text:
        return None, None, None, None
    
    # Vectorize
    text_tfidf = vectorizer.transform([text])
    
    # Predict
    prediction = model.predict(text_tfidf)[0]
    probabilities = model.predict_proba(text_tfidf)[0]
    
    emotion = label_mapping[prediction]
    confidence = probabilities[prediction]
    
    # Calculate sentiment score (-1 to 1)
    # Positive emotions: joy, love, surprise
    # Negative emotions: sadness, anger, fear
    positive_emotions = {'joy': 1, 'love': 1, 'surprise': 0.5}
    negative_emotions = {'sadness': -1, 'anger': -1, 'fear': -0.8}
    
    if emotion in positive_emotions:
        sentiment_score = positive_emotions[emotion] * confidence
    elif emotion in negative_emotions:
        sentiment_score = negative_emotions[emotion] * confidence
    else:
        sentiment_score = 0
    
    # Determine mood category
    if sentiment_score > 0.3:
        mood_category = 'positive'
    elif sentiment_score < -0.3:
        mood_category = 'negative'
    else:
        mood_category = 'neutral'
    
    all_probs = {label_mapping[i]: float(probabilities[i]) for i in range(len(label_mapping))}
    
    return emotion, confidence, sentiment_score, all_probs, mood_category

# Routes
@app.route('/')
def index():
    """Home page - serve React app."""
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files and fallback to index.html for React routing."""
    if os.path.exists(os.path.join('static', path)):
        return send_from_directory('static', path)
    return send_from_directory('static', 'index.html')

@app.route('/api/entries', methods=['GET'])
def get_entries():
    """Get all diary entries."""
    try:
        entries = DiaryEntry.query.order_by(DiaryEntry.created_at.desc()).all()
        return jsonify([entry.to_dict() for entry in entries])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/entries/<int:entry_id>', methods=['GET'])
def get_entry(entry_id):
    """Get a specific diary entry."""
    try:
        entry = DiaryEntry.query.get(entry_id)
        if not entry:
            return jsonify({'error': 'Entry not found'}), 404
        return jsonify(entry.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/entries', methods=['POST'])
def create_entry():
    """Create a new diary entry with sentiment analysis."""
    try:
        data = request.get_json()
        title = data.get('title', 'Untitled').strip()
        content = data.get('content', '').strip()
        
        if not content:
            return jsonify({'error': 'Entry content cannot be empty'}), 400
        
        # Analyze sentiment
        emotion, confidence, sentiment_score, all_probs, mood_category = analyze_sentiment(content)
        
        # Create entry
        entry = DiaryEntry(
            title=title if title else 'Untitled',
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
def update_entry(entry_id):
    """Update a diary entry."""
    try:
        entry = DiaryEntry.query.get(entry_id)
        if not entry:
            return jsonify({'error': 'Entry not found'}), 404
        
        data = request.get_json()
        
        if 'title' in data:
            entry.title = data['title'].strip()
        
        if 'content' in data:
            content = data['content'].strip()
            if not content:
                return jsonify({'error': 'Entry content cannot be empty'}), 400
            
            entry.content = content
            
            # Re-analyze sentiment
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
def delete_entry(entry_id):
    """Delete a diary entry."""
    try:
        entry = DiaryEntry.query.get(entry_id)
        if not entry:
            return jsonify({'error': 'Entry not found'}), 404
        
        db.session.delete(entry)
        db.session.commit()
        
        return jsonify({'success': True})
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/entries/all', methods=['DELETE'])
def delete_all_entries():
    """Delete all diary entries."""
    try:
        DiaryEntry.query.delete()
        db.session.commit()
        
        return jsonify({'success': True})
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/analytics/dashboard', methods=['GET'])
def get_dashboard_analytics():
    """Get dashboard analytics."""
    try:
        period = request.args.get('period', 'week')  # week, month, all
        specific_date = request.args.get('date')  # Optional: specific date filter (YYYY-MM-DD)
        
        # If specific date is provided, filter for that date only
        if specific_date:
            try:
                filter_date = datetime.strptime(specific_date, '%Y-%m-%d')
                start_date = filter_date
                end_date = filter_date + timedelta(days=1)
                entries = DiaryEntry.query.filter(
                    DiaryEntry.created_at >= start_date,
                    DiaryEntry.created_at < end_date
                ).all()
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        else:
            # Calculate date range based on period
            if period == 'week':
                start_date = datetime.utcnow() - timedelta(days=7)
            elif period == 'month':
                start_date = datetime.utcnow() - timedelta(days=30)
            else:
                start_date = datetime.utcnow() - timedelta(days=365)
            
            # Get entries in range
            entries = DiaryEntry.query.filter(
                DiaryEntry.created_at >= start_date
            ).all()
        
        # Calculate statistics
        total_entries = len(entries)
        positive_count = sum(1 for e in entries if e.mood_category == 'positive')
        neutral_count = sum(1 for e in entries if e.mood_category == 'neutral')
        negative_count = sum(1 for e in entries if e.mood_category == 'negative')
        
        # Emotion distribution
        emotion_counts = defaultdict(int)
        for entry in entries:
            if entry.primary_emotion:
                emotion_counts[entry.primary_emotion] += 1
        
        # Average sentiment score
        avg_sentiment = sum(e.sentiment_score for e in entries if e.sentiment_score) / len(entries) if entries else 0
        
        # Daily breakdown
        daily_data = defaultdict(lambda: {'count': 0, 'positive': 0, 'neutral': 0, 'negative': 0})
        for entry in entries:
            date_key = entry.created_at.strftime('%Y-%m-%d')
            daily_data[date_key]['count'] += 1
            daily_data[date_key][entry.mood_category] += 1
        
        return jsonify({
            'total_entries': total_entries,
            'mood_distribution': {
                'positive': positive_count,
                'neutral': neutral_count,
                'negative': negative_count
            },
            'emotion_distribution': dict(emotion_counts),
            'average_sentiment': float(avg_sentiment),
            'daily_breakdown': dict(daily_data),
            'period': period
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/analytics/trends', methods=['GET'])
def get_trends():
    """Get sentiment trends over time."""
    try:
        period = request.args.get('period', 'week')  # week, month
        
        if period == 'week':
            start_date = datetime.utcnow() - timedelta(days=7)
            group_format = '%Y-%m-%d'
        else:
            start_date = datetime.utcnow() - timedelta(days=30)
            group_format = '%Y-%m-%d'
        
        entries = DiaryEntry.query.filter(
            DiaryEntry.created_at >= start_date
        ).order_by(DiaryEntry.created_at).all()
        
        # Group by date
        trends = defaultdict(lambda: {'avg_sentiment': 0, 'count': 0, 'entries': []})
        
        for entry in entries:
            date_key = entry.created_at.strftime(group_format)
            trends[date_key]['entries'].append(entry.sentiment_score)
            trends[date_key]['count'] += 1
        
        # Calculate averages
        for date_key in trends:
            scores = trends[date_key]['entries']
            trends[date_key]['avg_sentiment'] = sum(scores) / len(scores) if scores else 0
            del trends[date_key]['entries']
        
        return jsonify(dict(trends))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check."""
    return jsonify({
        'status': 'ok',
        'model_loaded': MODEL_LOADED
    })

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000)
