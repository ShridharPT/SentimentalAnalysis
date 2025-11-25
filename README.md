# MoodMate - Sentimental Analysis

A personal diary web application with AI-powered emotional analysis to track and understand your feelings.

## Features

- 📝 **Write Diary Entries** - Express your thoughts and feelings freely
- 🎤 **Voice Input** - Speak your entries using voice recognition
- 🤖 **AI Sentiment Analysis** - Automatic emotion detection (Joy, Sadness, Anger, Fear, Love, Surprise)
- 📊 **Dashboard Analytics** - View mood distribution and emotion trends
- 📅 **Calendar Filter** - Filter entries and analytics by date
- 🌙 **Dark/Light Mode** - Toggle between themes
- 🗑️ **Entry Management** - View, filter, and delete entries

## Tech Stack

- **Backend**: Flask, SQLAlchemy, scikit-learn
- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **ML Model**: Pre-trained sentiment analysis model

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+

### Setup

1. Clone the repository:
```bash
git clone https://github.com/ShridharPT/SentimentalAnalysis.git
cd SentimentalAnalysis
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Run the application:
```bash
python app.py
```

4. Open http://localhost:5000 in your browser

### Frontend Development (Optional)

If you want to modify the frontend:

```bash
cd frontend_new
npm install
npm run dev
```

Build for production:
```bash
npm run build
```

## Deployment on Render

1. Push to GitHub
2. Create a new Web Service on Render
3. Connect your GitHub repository
4. Render will auto-detect the configuration from `render.yaml`

## API Endpoints

- `GET /api/entries` - Get all entries
- `POST /api/entries` - Create new entry
- `DELETE /api/entries/<id>` - Delete entry
- `DELETE /api/entries/all` - Delete all entries
- `GET /api/analytics/dashboard` - Get dashboard analytics

## License

MIT
