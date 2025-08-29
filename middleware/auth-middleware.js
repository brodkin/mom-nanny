const DatabaseManager = require('../services/database-manager');

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
 * - Graceful redirects for unauthenticated requests
 * - Audit logging for security events
 * - Rate limiting integration
 */

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
      // Redirect to setup if no admin users exist
      return res.redirect('/admin/setup.html');
    }

    // Get session ID from cookies
    const sessionId = req.session?.id;
    if (!sessionId) {
      return redirectToLogin(req, res, 'No session found');
    }

    // Validate session in database
    const sessionData = await dbManager.get(`
      SELECT us.*, u.id as user_id, u.email, u.display_name, u.is_active
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.session_id = ? AND us.expires_at > datetime('now') AND u.is_active = 1
    `, [sessionId]);

    if (!sessionData) {
      // Clean up expired session from client
      req.session.destroy();
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
  
  // For API requests, return JSON error
  if (req.path.startsWith('/api/') || req.accepts('json')) {
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

// Schedule periodic cleanup (every hour)
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

module.exports = {
  authenticateAdmin,
  optionalAuth,
  requireUnauthenticated,
  createUserSession,
  destroyUserSession,
  cleanupExpiredSessions,
  getUserSessions
};