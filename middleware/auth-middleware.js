const DatabaseManager = require('../services/database-manager');
const { v4: uuidv4 } = require('uuid');

/**
 * Authentication Middleware for Admin Interface
 * 
 * Provides session-based authentication for the compassionate AI companion
 * admin interface. Protects sensitive healthcare data with proper session
 * validation and bootstrap detection.
 * 
 * Features:
 * - Session validation from database
 * - Bootstrap detection (redirect to setup if no users exist)
 * - Development mode auto-login (SECURITY: only when NODE_ENV === 'development')
 * - Graceful redirects for unauthenticated requests
 * - Audit logging for security events
 * - Rate limiting integration
 */

/**
 * Development mode auto-login helper
 * SECURITY CRITICAL: Only works when NODE_ENV === 'development'
 * 
 * Automatically creates a session for the first available user in development mode
 * to eliminate repetitive login steps during development.
 * 
 * @param {Object} req - Express request object
 * @returns {Object|false} User object if auto-login successful, false otherwise
 */
async function developmentAutoLogin(req) {
  // SECURITY: Only allow in development mode - explicit opt-in required
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }

  // Don't override existing authenticated session - but Express creates session IDs automatically
  // We only care if there's a valid authenticated session, not just a session ID
  // Note: We don't return false here just because req.session.id exists, 
  // because Express creates session IDs automatically. We only care if it's authenticated.

  try {
    const dbManager = DatabaseManager.getInstance();
    await dbManager.waitForInitialization();

    // Get first available active user
    const user = await dbManager.get(`
      SELECT id, email, display_name 
      FROM users 
      WHERE is_active = 1 
      ORDER BY created_at ASC 
      LIMIT 1
    `);

    if (user) {
      // Generate session ID and create session
      const sessionId = uuidv4();
      
      // Ensure session object exists
      if (!req.session) {
        req.session = {};
      }
      
      req.session.id = sessionId;
      req.session.userId = user.id;
      req.session.email = user.email;

      // Create session in database
      const sessionCreated = await createUserSession(user.id, sessionId, req);
      
      if (sessionCreated) {
        console.log(`[DEV AUTO-LOGIN] 🔓 Automatically authenticated as: ${user.email} (ID: ${user.id})`);
        console.log('[DEV AUTO-LOGIN] ⚠️  This feature is DISABLED in production mode');
        
        return {
          id: user.id,
          email: user.email,
          displayName: user.display_name
        };
      }
    }

    return false;
  } catch (error) {
    console.error('[DEV AUTO-LOGIN] Error during development auto-login:', error);
    return false;
  }
}

/**
 * Main authentication middleware
 * Validates user session and redirects unauthenticated users
 */
async function authenticateAdmin(req, res, next) {
  try {
    const dbManager = DatabaseManager.getInstance();
    await dbManager.waitForInitialization();

    // Check if this is a setup request and if setup is needed
    if (req.path.startsWith('/auth/setup')) {
      const hasUsers = await checkHasUsers(dbManager);
      if (!hasUsers) {
        // Allow setup routes when no users exist
        return next();
      } else if (req.path === '/auth/setup/status') {
        // Always allow status check
        return next();
      } else {
        // Redirect to login if users exist but trying to access setup
        return res.redirect('/admin/login');
      }
    }

    // Check for bootstrap condition (no users exist)
    const hasUsers = await checkHasUsers(dbManager);
    if (!hasUsers && !req.path.startsWith('/auth/')) {
      // Redirect to login if no admin users exist (CLI registration only)
      return res.redirect('/admin/login');
    }

    // Get session ID from cookies
    const sessionId = req.session?.id;
    
    let sessionData = null;
    if (sessionId) {
      // Validate session in database
      sessionData = await dbManager.get(`
        SELECT us.*, u.id as user_id, u.email, u.display_name, u.is_active
        FROM user_sessions us
        JOIN users u ON us.user_id = u.id
        WHERE us.session_id = ? AND us.expires_at > datetime('now') AND u.is_active = 1
      `, [sessionId]);
    }

    // Try development auto-login if no session or invalid session in development
    if (!sessionData && process.env.NODE_ENV === 'development') {
      const autoUser = await developmentAutoLogin(req);
      if (autoUser) {
        req.user = {
          id: autoUser.id,
          email: autoUser.email,
          displayName: autoUser.displayName
        };
        return next();
      }
    }

    if (!sessionId) {
      return redirectToLogin(req, res, 'No session found');
    }

    if (!sessionData) {
      // Clean up expired session from client
      if (req.session && req.session.destroy) {
        req.session.destroy();
      }
      return redirectToLogin(req, res, 'Invalid or expired session');
    }

    // Update last accessed timestamp
    await dbManager.run(`
      UPDATE user_sessions 
      SET last_accessed_at = datetime('now')
      WHERE id = ?
    `, [sessionData.id]);

    // Add user information to request
    req.user = {
      id: sessionData.user_id,
      username: sessionData.username,
      email: sessionData.email,
      displayName: sessionData.display_name
    };

    // Log successful authentication check
    console.log(`[Auth] Authenticated user: ${req.user.username} (${req.user.id})`);

    next();
  } catch (error) {
    console.error('[Auth] Authentication middleware error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Authentication system error',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Optional authentication middleware - sets user if authenticated but doesn't block
 */
async function optionalAuth(req, res, next) {
  try {
    const sessionId = req.session?.id;
    if (!sessionId) {
      return next();
    }

    const dbManager = DatabaseManager.getInstance();
    await dbManager.waitForInitialization();

    const sessionData = await dbManager.get(`
      SELECT us.*, u.id as user_id, u.email, u.display_name, u.is_active
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.session_id = ? AND us.expires_at > datetime('now') AND u.is_active = 1
    `, [sessionId]);

    if (sessionData) {
      req.user = {
        id: sessionData.user_id,
        username: sessionData.username,
        email: sessionData.email,
        displayName: sessionData.display_name
      };
    }

    next();
  } catch (error) {
    console.error('[Auth] Optional auth middleware error:', error);
    next(); // Continue even if optional auth fails
  }
}

/**
 * Middleware to ensure user is NOT authenticated (for login/register pages)
 */
async function requireUnauthenticated(req, res, next) {
  try {
    const sessionId = req.session?.id;
    if (!sessionId) {
      return next();
    }

    const dbManager = DatabaseManager.getInstance();
    await dbManager.waitForInitialization();

    const sessionData = await dbManager.get(`
      SELECT us.id
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.session_id = ? AND us.expires_at > datetime('now') AND u.is_active = 1
    `, [sessionId]);

    if (sessionData) {
      // User is already authenticated, redirect to admin
      return res.redirect('/admin/dashboard');
    }

    next();
  } catch (error) {
    console.error('[Auth] Unauthenticated check error:', error);
    next(); // Continue on error for login pages
  }
}

/**
 * Create a new user session
 * @param {number} userId - User ID
 * @param {string} sessionId - Session identifier
 * @param {Object} req - Request object for metadata
 * @param {number} expirationHours - Hours until session expires (default 24)
 */
async function createUserSession(userId, sessionId, req, expirationHours = 24) {
  try {
    const dbManager = DatabaseManager.getInstance();
    await dbManager.waitForInitialization();

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expirationHours);

    await dbManager.run(`
      INSERT INTO user_sessions (
        user_id, session_id, expires_at, user_agent, ip_address, created_at, last_accessed_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      userId,
      sessionId,
      expiresAt.toISOString(),
      req.get('User-Agent') || '',
      req.ip || req.connection.remoteAddress || ''
    ]);

    console.log(`[Auth] Created session for user ${userId}, expires: ${expiresAt.toISOString()}`);
    return true;
  } catch (error) {
    console.error('[Auth] Error creating user session:', error);
    return false;
  }
}

/**
 * Destroy user session
 * @param {string} sessionId - Session identifier to destroy
 */
async function destroyUserSession(sessionId) {
  try {
    if (!sessionId) return false;

    const dbManager = DatabaseManager.getInstance();
    await dbManager.waitForInitialization();

    const result = await dbManager.run(`
      DELETE FROM user_sessions WHERE session_id = ?
    `, [sessionId]);

    console.log(`[Auth] Destroyed session: ${sessionId}`);
    return result.changes > 0;
  } catch (error) {
    console.error('[Auth] Error destroying session:', error);
    return false;
  }
}

/**
 * Clean up expired sessions
 */
async function cleanupExpiredSessions() {
  try {
    const dbManager = DatabaseManager.getInstance();
    await dbManager.waitForInitialization();

    const result = await dbManager.run(`
      DELETE FROM user_sessions WHERE expires_at < datetime('now')
    `);

    if (result.changes > 0) {
      console.log(`[Auth] Cleaned up ${result.changes} expired sessions`);
    }

    return result.changes;
  } catch (error) {
    console.error('[Auth] Error cleaning up expired sessions:', error);
    return 0;
  }
}

/**
 * Get all active sessions for a user
 * @param {number} userId - User ID
 */
async function getUserSessions(userId) {
  try {
    const dbManager = DatabaseManager.getInstance();
    await dbManager.waitForInitialization();

    return await dbManager.all(`
      SELECT id, session_id, created_at, last_accessed_at, expires_at, user_agent, ip_address
      FROM user_sessions
      WHERE user_id = ? AND expires_at > datetime('now')
      ORDER BY last_accessed_at DESC
    `, [userId]);
  } catch (error) {
    console.error('[Auth] Error fetching user sessions:', error);
    return [];
  }
}

/**
 * Check if any admin users exist
 * @private
 */
async function checkHasUsers(dbManager) {
  try {
    const result = await dbManager.get('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
    return result.count > 0;
  } catch (error) {
    console.error('[Auth] Error checking for users:', error);
    return false;
  }
}

/**
 * Redirect to login with proper error handling
 * @private
 */
function redirectToLogin(req, res, reason) {
  console.log(`[Auth] Redirecting to login: ${reason} (Path: ${req.path})`);
  
  // For actual API requests or AJAX requests, return JSON error
  // Check for explicit API paths, XMLHttpRequest, or Fetch API headers
  const isApiRequest = req.path.startsWith('/api/') || 
                      req.get('X-Requested-With') === 'XMLHttpRequest' ||
                      req.get('Content-Type') === 'application/json' ||
                      (req.get('Accept') && req.get('Accept').includes('application/json') && !req.get('Accept').includes('text/html'));
  
  if (isApiRequest) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      redirect: '/admin/login',
      timestamp: new Date().toISOString()
    });
  }
  
  // For web requests, redirect to login
  res.redirect('/admin/login');
}

// Schedule periodic cleanup (every hour) - only in non-test environments
if (process.env.NODE_ENV !== 'test') {
  setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
}

module.exports = {
  authenticateAdmin,
  optionalAuth,
  requireUnauthenticated,
  createUserSession,
  destroyUserSession,
  cleanupExpiredSessions,
  getUserSessions,
  developmentAutoLogin
};