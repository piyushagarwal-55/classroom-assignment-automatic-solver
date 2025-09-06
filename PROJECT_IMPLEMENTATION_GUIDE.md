# Assignment Solver Web App - Implementation Guide

## Project Overview
A full-stack web application that integrates with Google Classroom to automatically generate and submit assignment solutions using AI models.

**Tech Stack:**
- Frontend: React.js + TailwindCSS
- Backend: Flask/FastAPI + Python
- Authentication: Google OAuth 2.0
- APIs: Google Classroom API, OpenAI/Hugging Face API
- Database: SQLite/PostgreSQL
- PDF Generation: ReportLab
- File Storage: Google Drive API

## Project Architecture

```
Frontend (React - Port 3000)
    ↓
Backend API (Flask - Port 5000)
    ↓
External APIs:
- Google Classroom API
- Google Drive API  
- OpenAI/Hugging Face API
```

---

## Phase 1: Project Setup & Environment Configuration

### Step 1.1: Initialize Project Structure
```
assignment-solver/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── utils/
│   │   └── App.js
│   ├── package.json
│   └── tailwind.config.js
├── backend/                  # Flask application
│   ├── app.py
│   ├── routes/
│   ├── utils/
│   ├── models/
│   ├── requirements.txt
│   └── credentials.json
├── docs/
└── README.md
```

### Step 1.2: Environment Setup
1. **Create virtual environment:**
   ```bash
   python -m venv assignment-solver-env
   assignment-solver-env\Scripts\activate  # Windows
   ```

2. **Install Backend Dependencies:**
   ```bash
   pip install flask flask-cors google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client openai reportlab sqlalchemy python-dotenv
   ```

3. **Initialize React Frontend:**
   ```bash
   npx create-react-app frontend
   cd frontend
   npm install axios react-router-dom @tailwindcss/forms
   ```

### Step 1.3: Environment Variables Setup
Create `.env` file in backend directory:
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
OPENAI_API_KEY=your_openai_api_key
SECRET_KEY=your_flask_secret_key
DATABASE_URL=sqlite:///assignments.db
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
```

---

## Phase 2: Google Cloud Console & API Setup

### Step 2.1: Google Cloud Project Setup
1. **Create Google Cloud Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create new project: "assignment-solver-app"
   - Enable billing (required for API access)

2. **Enable Required APIs:**
   ```
   - Google Classroom API
   - Google Drive API
   - Google OAuth2 API
   ```

3. **Create OAuth 2.0 Credentials:**
   - Go to APIs & Services > Credentials
   - Create OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:5000/oauth2callback`

4. **Download credentials.json:**
   - Place in `backend/credentials.json`

### Step 2.2: OAuth Scopes Configuration
Required scopes for the application:
```python
SCOPES = [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
    'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
    'https://www.googleapis.com/auth/drive.file'
]
```

---
