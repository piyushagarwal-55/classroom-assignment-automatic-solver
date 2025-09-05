const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    console.log('🔐 AUTH MIDDLEWARE - Starting authentication check');
    console.log('🔐 Request URL:', req.url);
    console.log('🔐 Request method:', req.method);
    console.log('🔐 Request headers:', req.headers);
    
    // Get token from header or cookie
    let token = req.header('Authorization');
    console.log('🔐 Raw Authorization header:', token);
    
    if (token && token.startsWith('Bearer ')) {
      token = token.slice(7);
      console.log('🔐 Extracted Bearer token:', token ? 'Token present' : 'No token');
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
      console.log('🔐 Using cookie token:', token ? 'Token present' : 'No token');
    }

    if (!token) {
      console.log('❌ AUTH MIDDLEWARE - No token found');
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied'
      });
    }

    console.log('🔐 Token found, verifying...');

    try {
      // Verify token
      console.log('🔐 Verifying JWT token with secret:', process.env.JWT_SECRET ? 'Secret present' : 'No secret');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('🔐 Token decoded successfully:', decoded);
      
      // Get user from database
      console.log('🔐 Looking for user with ID:', decoded.userId);
      const user = await User.findById(decoded.userId).select('-password +googleTokens.accessToken +googleTokens.refreshToken +googleTokens.tokenExpiry');
      console.log('🔐 User found:', user ? user.email : 'No user found');
      
      if (!user) {
        console.log('❌ AUTH MIDDLEWARE - User not found for token');
        return res.status(401).json({
          success: false,
          message: 'Token is valid but user not found'
        });
      }

      if (!user.isActive) {
        console.log('❌ AUTH MIDDLEWARE - User account deactivated');
        return res.status(401).json({
          success: false,
          message: 'Account has been deactivated'
        });
      }

      // Add user to request object
      req.user = user;
      console.log('✅ AUTH MIDDLEWARE - Authentication successful for user:', user.email);
      next();
    } catch (tokenError) {
      console.error('❌ AUTH MIDDLEWARE - Token verification error:', tokenError);
      return res.status(401).json({
        success: false,
        message: 'Token is not valid'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    let token = req.header('Authorization');
    
    if (token && token.startsWith('Bearer ')) {
      token = token.slice(7);
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (user && user.isActive) {
          req.user = user;
        }
      } catch (tokenError) {
        // Ignore token errors in optional auth
      }
    }
    
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue even if there's an error
  }
};

// Admin role check middleware
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  next();
};

// Premium subscription check
const requirePremium = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!['premium', 'enterprise'].includes(req.user.subscription)) {
    return res.status(403).json({
      success: false,
      message: 'Premium subscription required'
    });
  }

  next();
};

module.exports = {
  auth,
  optionalAuth,
  requireAdmin,
  requirePremium
};
