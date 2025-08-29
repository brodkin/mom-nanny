const express = require('express');
const rateLimit = require('express-rate-limit');
const WebAuthnService = require('../../services/webauthn-service');
const { 
  createUserSession, 
  destroyUserSession, 
  requireUnauthenticated,
  authenticateAdmin 
} = require('../../middleware/auth-middleware');
const router = express.Router();

// Initialize WebAuthn service
const webauthnService = new WebAuthnService();

// Rate limiting for authentication endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 50 : 20, // Reasonable limit for production
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const registrationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'development' ? 100 : 10, // Reasonable limit for production
  message: {
    success: false,
    error: 'Too many registration attempts, please try again later',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// CSRF protection - will be added to app.js session configuration

/**
 * Registration Flow Endpoints (Token-based CLI registration)
 */

// Begin passkey registration with token
router.post('/register/begin', registrationRateLimit, requireUnauthenticated, async (req, res) => {
  try {
    const { token, email, displayName } = req.body;

    // Validate required fields
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Registration token is required',
        timestamp: new Date().toISOString()
      });
    }

    if (!email || email.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required',
        timestamp: new Date().toISOString()
      });
    }

    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Display name is required',
        timestamp: new Date().toISOString()
      });
    }

    const options = await webauthnService.generateRegistrationOptions(token, email);

    res.json({
      success: true,
      options,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Auth API] Registration begin error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Complete passkey registration
router.post('/register/complete', registrationRateLimit, requireUnauthenticated, async (req, res) => {
  try {
    const { challengeKey, credential, displayName } = req.body;

    if (!challengeKey || !credential || !displayName) {
      return res.status(400).json({
        success: false,
        error: 'Challenge key, credential, and display name are required',
        timestamp: new Date().toISOString()
      });
    }

    const result = await webauthnService.verifyRegistrationResponse(challengeKey, credential, displayName.trim());

    if (result.verified) {
      console.log(`[Auth API] User registered successfully: ${result.email} (ID: ${result.userId})`);
      
      res.json({
        success: true,
        message: 'Registration successful! You can now log in.',
        userId: result.userId,
        email: result.email,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error('Registration verification failed');
    }

  } catch (error) {
    console.error('[Auth API] Registration complete error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Authentication Flow Endpoints
 */

// Begin passkey authentication
router.post('/login/begin', authRateLimit, requireUnauthenticated, async (req, res) => {
  try {
    const { email } = req.body;
    
    // Email is optional for discoverable credentials
    const options = await webauthnService.generateAuthenticationOptions(
      email ? email.toLowerCase().trim() : null
    );

    res.json({
      success: true,
      options,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Auth API] Login begin error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Complete passkey authentication
router.post('/login/complete', authRateLimit, requireUnauthenticated, async (req, res) => {
  try {
    const { challengeKey, credential } = req.body;

    if (!challengeKey || !credential) {
      return res.status(400).json({
        success: false,
        error: 'Challenge key and credential are required',
        timestamp: new Date().toISOString()
      });
    }

    const result = await webauthnService.verifyAuthenticationResponse(challengeKey, credential);

    if (result.verified) {
      // Create session
      const sessionId = req.sessionID;
      const sessionCreated = await createUserSession(result.user.id, sessionId, req);

      if (sessionCreated) {
        req.session.id = sessionId; // Critical: Set session.id for middleware validation
        req.session.userId = result.user.id;
        req.session.email = result.user.email;
        
        console.log(`[Auth API] User authenticated successfully: ${result.user.email} (ID: ${result.user.id})`);
        
        res.json({
          success: true,
          message: 'Login successful!',
          user: result.user,
          redirectUrl: '/admin/dashboard',
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error('Failed to create session');
      }
    } else {
      throw new Error('Authentication verification failed');
    }

  } catch (error) {
    console.error('[Auth API] Login complete error:', error);
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Session Management Endpoints
 */

// Logout
router.post('/logout', async (req, res) => {
  try {
    const sessionId = req.sessionID;
    
    if (sessionId) {
      await destroyUserSession(sessionId);
    }
    
    req.session.destroy((err) => {
      if (err) {
        console.error('[Auth API] Session destruction error:', err);
      }
      
      res.clearCookie('connect.sid'); // Default express-session cookie name
      
      res.json({
        success: true,
        message: 'Logged out successfully',
        redirectUrl: '/admin/login',
        timestamp: new Date().toISOString()
      });
    });

  } catch (error) {
    console.error('[Auth API] Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Check authentication status
router.get('/status', async (req, res) => {
  try {
    const sessionId = req.session?.id;
    
    if (!sessionId) {
      return res.json({
        authenticated: false,
        setupRequired: !(await webauthnService.hasUsers()),
        timestamp: new Date().toISOString()
      });
    }

    // Check if session is valid (this will be caught by auth middleware if used)
    const user = req.user;
    
    res.json({
      authenticated: !!user,
      user: user || null,
      setupRequired: !(await webauthnService.hasUsers()),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Auth API] Status check error:', error);
    res.json({
      authenticated: false,
      setupRequired: true,
      error: 'Status check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * System Status Endpoints
 */

// Check if users exist (for conditional authentication flow)
router.get('/setup/status', async (req, res) => {
  try {
    const hasUsers = await webauthnService.hasUsers();
    
    res.json({
      setupComplete: hasUsers,
      setupRequired: !hasUsers,
      message: hasUsers ? 'System has admin users' : 'No admin users found - use CLI to generate registration tokens',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Auth API] Setup status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check setup status',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Protected Admin Endpoints (require authentication)
 */

// Get user profile
router.get('/profile', authenticateAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Auth API] Profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
      timestamp: new Date().toISOString()
    });
  }
});

// Get current user info
router.get('/me', authenticateAdmin, async (req, res) => {
  try {
    const user = req.user;
    
    // Generate initials from display name or email
    const generateInitials = (name, email) => {
      if (name && name.trim()) {
        return name.trim().split(' ')
          .map(word => word.charAt(0).toUpperCase())
          .slice(0, 2)
          .join('');
      }
      // Fallback to email initials
      if (email) {
        const emailParts = email.split('@')[0].split(/[._]/);
        return emailParts
          .map(part => part.charAt(0).toUpperCase())
          .slice(0, 2)
          .join('');
      }
      return 'U';
    };
    
    const initials = generateInitials(user.display_name, user.email);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name || user.email,
        initials: initials
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Auth API] User info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user information',
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/credentials', authenticateAdmin, async (req, res) => {
  try {
    const credentials = await webauthnService.getUserCredentials(req.user.id);
    
    res.json({
      success: true,
      credentials,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Auth API] Credentials error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch credentials',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;