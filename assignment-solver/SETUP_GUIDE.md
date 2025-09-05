# Assignment Solver - Setup & Start Guide

## Prerequisites
- Node.js (v16 or higher)
- MongoDB (local installation or MongoDB Atlas)
- Git

## Initial Setup

### 1. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend  
npm install
```

### 2. Environment Configuration

**Backend (.env file):**
```bash
cd backend
# Copy .env.example to .env and update values
cp .env.example .env
```

**Update the following in backend/.env:**
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/assignment-solver
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
```

**Frontend (.env file):**
```bash
cd frontend
# Create .env file
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env
```

### 3. Database Setup

**Option A: Local MongoDB**
1. Install MongoDB locally
2. Start MongoDB service
3. The app will create the database automatically

**Option B: MongoDB Atlas (Cloud)**
1. Create account at mongodb.com
2. Create a cluster
3. Get connection string
4. Update MONGODB_URI in backend/.env

### 4. Start the Applications

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health

---

## Current Features ✅

### Authentication System
- ✅ User Registration
- ✅ User Login/Logout
- ✅ JWT Token Authentication
- ✅ Password Hashing (bcrypt)
- ✅ Protected Routes
- ✅ Auth Context/State Management

### Frontend Pages
- ✅ Landing Page
- ✅ Sign Up Page
- ✅ Sign In Page
- ✅ Dashboard (Coming Soon placeholder)

### Backend API Endpoints
- ✅ `POST /api/auth/register` - User registration
- ✅ `POST /api/auth/login` - User login
- ✅ `POST /api/auth/logout` - User logout
- ✅ `GET /api/auth/me` - Get current user
- ✅ `PUT /api/auth/profile` - Update profile
- ✅ `PUT /api/auth/change-password` - Change password
- ✅ `GET /api/user/profile` - Get user profile
- ✅ `GET /api/user/stats` - Get user statistics

---

## Testing the Authentication Flow

### 1. Register a New User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe", 
    "email": "john@example.com",
    "password": "Password123"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "Password123"
  }'
```

### 3. Access Protected Route
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Next Steps 🚀

### Immediate (Phase 1)
- [ ] Complete Dashboard UI
- [ ] User Profile Management
- [ ] Email Verification
- [ ] Password Reset

### Short Term (Phase 2)
- [ ] Google OAuth Integration
- [ ] Google Classroom API Setup
- [ ] Assignment Fetching
- [ ] Basic AI Integration (OpenAI)

### Medium Term (Phase 3)
- [ ] PDF Generation
- [ ] Assignment Submission
- [ ] File Upload/Management
- [ ] Subscription System

---

## Troubleshooting

### Common Issues

**1. MongoDB Connection Error**
```
❌ MongoDB connection error: MongoNetworkError
```
- Ensure MongoDB is running
- Check MONGODB_URI in .env
- For Atlas: Check network access and credentials

**2. CORS Errors**
```
Access to fetch at 'http://localhost:5000' from origin 'http://localhost:3000' has been blocked by CORS
```
- Ensure backend CORS is configured for http://localhost:3000
- Check FRONTEND_URL in backend .env

**3. Authentication Errors**
```
Token is not valid
```
- Check JWT_SECRET in backend .env
- Ensure token is being sent correctly
- Check token expiration

**4. Frontend Build Errors**
```
Module not found
```
- Run `npm install` in frontend directory
- Check import statements
- Restart development server

### Port Conflicts
If ports 3000 or 5000 are in use:

**Backend (change from 5000):**
```env
PORT=5001
```

**Frontend (change from 3000):**
```bash
npm start
# When prompted, choose a different port (e.g., 3001)
```

---

## Development Tips

### Backend Development
- Use `npm run dev` for auto-restart with nodemon
- Check logs in terminal for debugging
- Test API endpoints with Postman or curl
- Monitor MongoDB with MongoDB Compass

### Frontend Development
- Use React Developer Tools browser extension
- Check browser console for errors
- Use Network tab to debug API calls
- Hot reload is enabled by default

### Database Management
- Use MongoDB Compass for visual database management
- Clear database: Drop `assignment-solver` database to reset
- View user data: Check `users` collection

---

## Security Notes ⚠️

1. **JWT Secret**: Use a strong, random JWT_SECRET in production
2. **Password Requirements**: Currently requires 6+ chars with uppercase, lowercase, and number
3. **Rate Limiting**: API has rate limiting (100 requests per 15 minutes)
4. **Helmet**: Security headers are configured
5. **Input Validation**: All inputs are validated and sanitized

---

## Project Structure

```
assignment-solver/
├── backend/
│   ├── controllers/         # Business logic
│   ├── middleware/          # Auth, validation, etc.
│   ├── models/             # Database schemas
│   ├── routes/             # API routes
│   ├── config/             # Configuration files
│   ├── .env                # Environment variables
│   ├── server.js           # Main server file
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── context/        # React context
│   │   ├── utils/          # Utilities (API, etc.)
│   │   └── App.tsx         # Main app component
│   ├── public/
│   └── package.json
└── README.md
```
