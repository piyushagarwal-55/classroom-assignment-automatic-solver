const { google } = require('googleapis');
const path = require('path');

// Google OAuth2 Configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback'
);

// Scopes required for Google Classroom API and Google Drive
const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];

/**
 * Generate Google OAuth2 authorization URL
 */
const getAuthUrl = () => {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
};

/**
 * Exchange authorization code for access token
 */
const getTokens = async (code) => {
  try {
    const { tokens } = await oauth2Client.getAccessToken(code);
    oauth2Client.setCredentials(tokens);
    return tokens;
  } catch (error) {
    throw new Error('Failed to exchange authorization code for tokens');
  }
};

/**
 * Set credentials for OAuth2 client
 */
const setCredentials = (tokens) => {
  oauth2Client.setCredentials(tokens);
};

/**
 * Refresh access token
 */
const refreshAccessToken = async (refreshToken) => {
  try {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials;
  } catch (error) {
    throw new Error('Failed to refresh access token');
  }
};

module.exports = {
  oauth2Client,
  getAuthUrl,
  getTokens,
  setCredentials,
  refreshAccessToken,
  SCOPES
};
