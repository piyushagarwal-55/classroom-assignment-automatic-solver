const express = require('express');
const router = express.Router();
const { oauth2Client } = require('../config/googleAuth');
const { getCourses, getAllAssignments } = require('../services/classroomService');
const { auth } = require('../middleware/auth');

// Add CORS headers to all responses in this router
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  next();
});

// @route   GET /api/assignments
// @desc    Get all assignments from Google Classroom
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    console.log('📝 ASSIGNMENTS ROUTE - Starting assignment fetch');
    console.log('📝 User from auth middleware:', req.user ? req.user.email : 'No user');
    
    const user = req.user;
    console.log('📝 User Google tokens:', user?.googleTokens ? 'Present' : 'Missing');
    console.log('📝 Google tokens details:', JSON.stringify({
      hasTokens: !!user?.googleTokens,
      hasAccessToken: !!user?.googleTokens?.accessToken,
      hasRefreshToken: !!user?.googleTokens?.refreshToken,
      accessTokenLength: user?.googleTokens?.accessToken?.length || 0,
      refreshTokenLength: user?.googleTokens?.refreshToken?.length || 0
    }, null, 2));
    
    // Check if user has Google tokens
    if (!user || !user.googleTokens || !user.googleTokens.accessToken) {
      console.log('❌ ASSIGNMENTS ROUTE - Google authentication required');
      console.log('❌ Debug - User exists:', !!user);
      console.log('❌ Debug - GoogleTokens exists:', !!user?.googleTokens);
      console.log('❌ Debug - AccessToken exists:', !!user?.googleTokens?.accessToken);
      return res.status(401).json({ 
        error: 'Google authentication required',
        code: 'GOOGLE_AUTH_REQUIRED'
      });
    }

    console.log('📝 Setting Google credentials...');
    // Set credentials for Google API
    oauth2Client.setCredentials({
      access_token: user.googleTokens.accessToken,
      refresh_token: user.googleTokens.refreshToken,
    });

    console.log('📝 Fetching assignments from Google Classroom...');
    // Get assignments
    const assignments = await getAllAssignments(user.googleTokens.accessToken);
    console.log('📝 Assignments fetched:', assignments ? assignments.length : 0);
    
    res.json({
      success: true,
      data: {
        assignments: assignments || [],
        totalCount: assignments ? assignments.length : 0
      }
    });

  } catch (error) {
    console.error('❌ Error fetching assignments:', error);
    
    res.status(500).json({ 
      error: 'Internal server error while fetching assignments',
      message: error.message 
    });
  }
});

// @route   GET /api/courses
// @desc    Get all courses from Google Classroom
// @access  Private
router.get('/courses', auth, async (req, res) => {
  try {
    console.log('📝 COURSES ROUTE - Starting courses fetch');
    console.log('📝 User from auth middleware:', req.user ? req.user.email : 'No user');
    
    const user = req.user;
    console.log('📝 User Google tokens:', user?.googleTokens ? 'Present' : 'Missing');
    
    // Check if user has Google tokens
    if (!user || !user.googleTokens || !user.googleTokens.accessToken) {
      console.log('❌ COURSES ROUTE - Google authentication required');
      return res.status(401).json({ 
        error: 'Google authentication required',
        code: 'GOOGLE_AUTH_REQUIRED'
      });
    }

    console.log('📝 Setting Google credentials...');
    // Set credentials for Google API
    oauth2Client.setCredentials({
      access_token: user.googleTokens.accessToken,
      refresh_token: user.googleTokens.refreshToken,
    });

    console.log('📝 Fetching courses from Google Classroom...');
    // Get courses
    const courses = await getCourses(user.googleTokens.accessToken);
    console.log('📝 Courses fetched:', courses ? courses.length : 0);
    
    res.json({
      success: true,
      data: {
        courses: courses || [],
        totalCount: courses ? courses.length : 0
      }
    });

  } catch (error) {
    console.error('❌ Error fetching courses:', error);
    
    res.status(500).json({ 
      error: 'Internal server error while fetching courses',
      message: error.message 
    });
  }
});

module.exports = router;
