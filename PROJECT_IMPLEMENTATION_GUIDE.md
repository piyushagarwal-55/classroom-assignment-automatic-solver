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

## Phase 3: Backend Development (Flask)

### Step 3.1: Flask App Structure
```python
# backend/app.py
from flask import Flask, request, jsonify, session, redirect, url_for
from flask_cors import CORS
import os
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import openai
from utils.pdf_generator import generate_solution_pdf
from models.database import init_db, User, Assignment

app = Flask(__name__)
CORS(app, supports_credentials=True)
app.secret_key = os.getenv('SECRET_KEY')

# Initialize database
init_db()
```

### Step 3.2: Authentication Routes
```python
# backend/routes/auth.py
@app.route('/login')
def login():
    flow = Flow.from_client_secrets_file(
        'credentials.json',
        scopes=SCOPES,
        redirect_uri=url_for('oauth2callback', _external=True)
    )
    
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true'
    )
    
    session['state'] = state
    return jsonify({'auth_url': authorization_url})

@app.route('/oauth2callback')
def oauth2callback():
    state = session['state']
    flow = Flow.from_client_secrets_file(
        'credentials.json',
        scopes=SCOPES,
        state=state,
        redirect_uri=url_for('oauth2callback', _external=True)
    )
    
    flow.fetch_token(authorization_response=request.url)
    credentials = flow.credentials
    
    # Store credentials in database
    user_info = get_user_info(credentials)
    store_user_credentials(user_info, credentials)
    
    return redirect(f"{os.getenv('FRONTEND_URL')}/dashboard")
```

### Step 3.3: Core API Endpoints
```python
# backend/routes/assignments.py
@app.route('/assignments')
def get_assignments():
    user_id = session.get('user_id')
    credentials = get_user_credentials(user_id)
    
    service = build('classroom', 'v1', credentials=credentials)
    
    # Get courses
    courses = service.courses().list().execute()
    assignments = []
    
    for course in courses.get('courses', []):
        coursework = service.courses().courseWork().list(
            courseId=course['id']
        ).execute()
        
        for work in coursework.get('courseWork', []):
            assignments.append({
                'id': work['id'],
                'title': work['title'],
                'description': work.get('description', ''),
                'course_name': course['name'],
                'due_date': work.get('dueDate'),
                'course_id': course['id']
            })
    
    return jsonify(assignments)

@app.route('/solve', methods=['POST'])
def solve_assignment():
    data = request.json
    assignment_text = data.get('assignment_text')
    
    # AI Solution Generation
    openai.api_key = os.getenv('OPENAI_API_KEY')
    
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are an expert assignment solver. Provide detailed, accurate solutions."},
            {"role": "user", "content": f"Solve this assignment:\n{assignment_text}"}
        ],
        max_tokens=1000
    )
    
    solution = response['choices'][0]['message']['content']
    
    # Generate PDF
    pdf_path = generate_solution_pdf(solution, data.get('assignment_title'))
    
    return jsonify({
        'solution': solution,
        'pdf_path': pdf_path
    })

@app.route('/submit', methods=['POST'])
def submit_assignment():
    data = request.json
    user_id = session.get('user_id')
    credentials = get_user_credentials(user_id)
    
    # Upload PDF to Google Drive
    drive_service = build('drive', 'v3', credentials=credentials)
    file_metadata = {'name': f"{data['assignment_title']}_solution.pdf"}
    
    media = MediaFileUpload(data['pdf_path'], mimetype='application/pdf')
    file = drive_service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id'
    ).execute()
    
    # Submit to Classroom
    classroom_service = build('classroom', 'v1', credentials=credentials)
    
    attachment = {
        'driveFile': {
            'id': file.get('id'),
            'title': f"{data['assignment_title']}_solution.pdf"
        }
    }
    
    submission = classroom_service.courses().courseWork().studentSubmissions().modifyAttachments(
        courseId=data['course_id'],
        courseWorkId=data['assignment_id'],
        id=data['submission_id'],
        body={'addAttachments': [attachment]}
    ).execute()
    
    # Turn in the assignment
    classroom_service.courses().courseWork().studentSubmissions().turnIn(
        courseId=data['course_id'],
        courseWorkId=data['assignment_id'],
        id=data['submission_id']
    ).execute()
    
    return jsonify({'status': 'submitted'})
```

### Step 3.4: PDF Generation Utility
```python
# backend/utils/pdf_generator.py
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import os

def generate_solution_pdf(solution_text, assignment_title):
    filename = f"solutions/{assignment_title.replace(' ', '_')}_solution.pdf"
    os.makedirs('solutions', exist_ok=True)
    
    doc = SimpleDocTemplate(filename, pagesize=letter)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=30,
    )
    
    content_style = ParagraphStyle(
        'CustomContent',
        parent=styles['Normal'],
        fontSize=12,
        leading=14,
        spaceAfter=12,
    )
    
    # Build PDF content
    story = []
    story.append(Paragraph(f"Assignment Solution: {assignment_title}", title_style))
    story.append(Spacer(1, 12))
    
    # Split solution into paragraphs
    paragraphs = solution_text.split('\n\n')
    for para in paragraphs:
        if para.strip():
            story.append(Paragraph(para.strip(), content_style))
            story.append(Spacer(1, 6))
    
    doc.build(story)
    return filename
```

### Step 3.5: Database Models
```python
# backend/models/database.py
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    google_id = Column(String(100), unique=True)
    email = Column(String(100))
    name = Column(String(100))
    access_token = Column(Text)
    refresh_token = Column(Text)
    created_at = Column(DateTime)

class Assignment(Base):
    __tablename__ = 'assignments'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    assignment_id = Column(String(100))
    title = Column(String(200))
    solution = Column(Text)
    pdf_path = Column(String(200))
    status = Column(String(50))
    created_at = Column(DateTime)

def init_db():
    engine = create_engine(os.getenv('DATABASE_URL'))
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)
```

---

## Phase 4: Frontend Development (React)

### Step 4.1: Project Structure
```
frontend/src/
├── components/
│   ├── AssignmentCard.js
│   ├── LoginButton.js
│   ├── Navigation.js
│   └── SolutionViewer.js
├── pages/
│   ├── LoginPage.js
│   ├── DashboardPage.js
│   └── AssignmentDetail.js
├── utils/
│   ├── api.js
│   └── auth.js
├── App.js
└── index.js
```

### Step 4.2: API Utility
```javascript
// frontend/src/utils/api.js
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authAPI = {
  login: () => api.get('/login'),
  getAssignments: () => api.get('/assignments'),
  solveAssignment: (assignmentData) => api.post('/solve', assignmentData),
  submitAssignment: (submissionData) => api.post('/submit', submissionData),
};

export default api;
```

### Step 4.3: Main Components
```javascript
// frontend/src/pages/LoginPage.js
import React from 'react';
import { authAPI } from '../utils/api';

const LoginPage = () => {
  const handleLogin = async () => {
    try {
      const response = await authAPI.login();
      window.location.href = response.data.auth_url;
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-8">Assignment Solver</h1>
        <p className="text-gray-600 text-center mb-8">
          Automatically solve and submit your Google Classroom assignments using AI
        </p>
        <button
          onClick={handleLogin}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300"
        >
          Login with Google
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
```

```javascript
// frontend/src/pages/DashboardPage.js
import React, { useState, useEffect } from 'react';
import { authAPI } from '../utils/api';
import AssignmentCard from '../components/AssignmentCard';

const DashboardPage = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const response = await authAPI.getAssignments();
      setAssignments(response.data);
    } catch (error) {
      console.error('Failed to fetch assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading assignments...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm p-4">
        <h1 className="text-2xl font-bold">Assignment Dashboard</h1>
      </nav>
      
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assignments.map((assignment) => (
            <AssignmentCard key={assignment.id} assignment={assignment} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
```

```javascript
// frontend/src/components/AssignmentCard.js
import React, { useState } from 'react';
import { authAPI } from '../utils/api';

const AssignmentCard = ({ assignment }) => {
  const [solving, setSolving] = useState(false);
  const [solution, setSolution] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSolve = async () => {
    setSolving(true);
    try {
      const response = await authAPI.solveAssignment({
        assignment_text: assignment.description,
        assignment_title: assignment.title
      });
      setSolution(response.data);
    } catch (error) {
      console.error('Failed to solve assignment:', error);
    } finally {
      setSolving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await authAPI.submitAssignment({
        assignment_id: assignment.id,
        course_id: assignment.course_id,
        assignment_title: assignment.title,
        pdf_path: solution.pdf_path
      });
      alert('Assignment submitted successfully!');
    } catch (error) {
      console.error('Failed to submit assignment:', error);
      alert('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold mb-2">{assignment.title}</h3>
      <p className="text-gray-600 mb-2">{assignment.course_name}</p>
      <p className="text-gray-500 text-sm mb-4">
        Due: {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date'}
      </p>
      <p className="text-gray-700 mb-4 line-clamp-3">{assignment.description}</p>
      
      <div className="space-y-2">
        <button
          onClick={handleSolve}
          disabled={solving}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {solving ? 'Solving...' : 'Solve with AI'}
        </button>
        
        {solution && (
          <>
            <button
              onClick={() => window.open(solution.pdf_path, '_blank')}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              View Solution PDF
            </button>
            
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit to Classroom'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AssignmentCard;
```

### Step 4.4: App Router Setup
```javascript
// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
```

---

## Phase 5: Testing & Development

### Step 5.1: Local Development Setup
```bash
# Terminal 1 - Backend
cd backend
python app.py

# Terminal 2 - Frontend  
cd frontend
npm start
```

### Step 5.2: Testing Checklist
- [ ] Google OAuth login flow
- [ ] Assignment fetching from Classroom
- [ ] AI solution generation
- [ ] PDF generation and download
- [ ] Assignment submission to Classroom
- [ ] Error handling and user feedback

### Step 5.3: Security Considerations
1. **Token Storage**: Store refresh tokens securely in database
2. **API Key Protection**: Use environment variables
3. **CORS Configuration**: Restrict to allowed origins
4. **Input Validation**: Sanitize all user inputs
5. **Rate Limiting**: Implement API call limits

---

## Phase 6: Deployment & Production

### Step 6.1: Production Environment Setup
1. **Backend Deployment** (Heroku/Railway/DigitalOcean):
   - Configure environment variables
   - Set up PostgreSQL database
   - Update Google OAuth redirect URIs

2. **Frontend Deployment** (Vercel/Netlify):
   - Update API endpoints to production URLs
   - Configure build settings

3. **Domain Configuration**:
   - Update Google Cloud Console with production URLs
   - Configure HTTPS certificates

### Step 6.2: Monitoring & Maintenance
- Set up logging and error tracking
- Monitor API usage and costs
- Regular security updates
- User feedback collection

---

## Important Notes & Limitations

### Legal & Ethical Considerations
⚠️ **Academic Integrity Warning**: This application automates assignment completion, which may violate academic integrity policies. Consider:
- Adding disclaimers about proper usage
- Implementing assignment type restrictions
- Adding human review requirements
- Consulting educational institutions' policies

### Technical Limitations
- Google Classroom API rate limits
- OpenAI API costs and rate limits
- File size restrictions for PDF submissions
- Browser compatibility for OAuth flow

### Recommended Enhancements
1. **Assignment Type Detection**: Different solving strategies for different subjects
2. **Solution Review System**: Human verification before submission
3. **Plagiarism Detection**: Integration with plagiarism checkers
4. **Multi-language Support**: Support for various programming languages
5. **Collaboration Features**: Team assignment handling
6. **Analytics Dashboard**: Track solving accuracy and submission success

---

## Estimated Development Timeline
- **Phase 1-2**: 2-3 days (Setup & API configuration)
- **Phase 3**: 4-5 days (Backend development)
- **Phase 4**: 3-4 days (Frontend development)
- **Phase 5**: 2-3 days (Testing & debugging)
- **Phase 6**: 1-2 days (Deployment)

**Total**: 12-17 days for a complete implementation

This guide provides a comprehensive roadmap for building your Assignment Solver Web App. Start with Phase 1 and progress sequentially, testing each component as you build it.
