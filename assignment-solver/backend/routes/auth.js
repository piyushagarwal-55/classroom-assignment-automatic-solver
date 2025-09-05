const express = require('express');
const { body } = require('express-validator');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { oauth2Client } = require('../config/googleAuth');
const { getUserProfile } = require('../services/classroomService');
const {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  changePassword
} = require('../controllers/authController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Add CORS headers to all responses in this router
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  next();
});

// Validation middleware
const registerValidation = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const profileUpdateValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number')
];

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', registerValidation, register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginValidation, login);

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', auth, logout);

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, getMe);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, profileUpdateValidation, updateProfile);

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', auth, changePasswordValidation, changePassword);

// OPTIONS handlers for preflight requests
router.options('/google', (req, res) => {
  res.status(204).send();
});

router.options('/callback', (req, res) => {
  res.status(204).send();
});

router.options('/register', (req, res) => {
  res.status(204).send();
});

router.options('/login', (req, res) => {
  res.status(204).send();
});

router.options('/logout', (req, res) => {
  res.status(204).send();
});

router.options('/me', (req, res) => {
  res.status(204).send();
});

// Google auth routes

// @route   GET /api/auth/google
// @desc    Generate Google OAuth URL
// @access  Public
router.get('/google', (req, res) => {
  try {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/classroom.courses.readonly',
        'https://www.googleapis.com/auth/classroom.coursework.me.readonly',  // Changed: For students to access their own coursework
        'https://www.googleapis.com/auth/drive.readonly',  // Added: For accessing Google Drive files
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      prompt: 'consent',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI
    });

    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authentication URL' });
  }
});

// @route   GET /api/auth/google/callback
// @desc    Handle Google OAuth callback (GET request from Google)
// @access  Public
router.get('/google/callback', async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      console.error('OAuth error:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=oauth_error`);
    }

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=no_code`);
    }

    // Set the redirect URI for this request
    const tempOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Exchange code for tokens
    const { tokens } = await tempOAuth2Client.getToken(code);
    tempOAuth2Client.setCredentials(tokens);

    // Get user profile from Google
    const userProfile = await getUserProfile(tokens.access_token);

    // Check if user exists
    let user = await User.findOne({ email: userProfile.email });

    if (user) {
      // Update existing user with new tokens
      user.googleTokens = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date
      };
      user.googleId = userProfile.id;
      await user.save();
    } else {
      // Create new user
      user = new User({
        firstName: userProfile.name.split(' ')[0] || userProfile.name,
        lastName: userProfile.name.split(' ').slice(1).join(' ') || '',
        email: userProfile.email,
        googleId: userProfile.id,
        password: 'google-oauth-user', // Placeholder password for OAuth users
        googleTokens: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiryDate: tokens.expiry_date
        }
      });
      await user.save();
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Store token in URL params for frontend to capture
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?google_auth=success&token=${jwtToken}`);

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=auth_failed`);
  }
});

// @route   POST /api/auth/google/callback
// @desc    Handle Google OAuth callback
// @access  Public
router.post('/google/callback', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Set the redirect URI for this request
    const tempOAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Exchange code for tokens
    const { tokens } = await tempOAuth2Client.getToken(code);
    tempOAuth2Client.setCredentials(tokens);

    // Get user profile from Google
    const userProfile = await getUserProfile(tokens.access_token);

    // Check if user exists
    let user = await User.findOne({ email: userProfile.email });

    if (user) {
      // Update existing user with new tokens
      user.googleTokens = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date
      };
      user.googleId = userProfile.id;
      await user.save();
    } else {
      // Create new user
      user = new User({
        firstName: userProfile.name.split(' ')[0] || userProfile.name,
        lastName: userProfile.name.split(' ').slice(1).join(' ') || '',
        email: userProfile.email,
        googleId: userProfile.id,
        password: 'google-oauth-user', // Placeholder password for OAuth users
        googleTokens: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiryDate: tokens.expiry_date
        }
      });
      await user.save();
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// @route   POST /api/auth/refresh-token
// @desc    Refresh Google access token
// @access  Private
router.post('/refresh-token', auth, async (req, res) => {
  try {
    const { userId } = req.user;

    const user = await User.findById(userId);
    if (!user || !user.googleTokens.refreshToken) {
      return res.status(401).json({ error: 'No refresh token available' });
    }

    // Set up OAuth client with current tokens
    oauth2Client.setCredentials({
      access_token: user.googleTokens.accessToken,
      refresh_token: user.googleTokens.refreshToken
    });

    // Refresh the access token
    const { credentials } = await oauth2Client.refreshAccessToken();

    // Update user tokens
    user.googleTokens.accessToken = credentials.access_token;
    if (credentials.refresh_token) {
      user.googleTokens.refreshToken = credentials.refresh_token;
    }
    user.googleTokens.expiryDate = credentials.expiry_date;
    await user.save();

    res.json({ success: true, message: 'Token refreshed successfully' });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

module.exports = router;
