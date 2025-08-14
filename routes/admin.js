const express = require('express');
const path = require('path');
const router = express.Router();

/**
 * Admin Interface Router
 * 
 * Handles routing for the admin web interface including:
 * - Serving static admin files
 * - Admin page routing
 * - Future authentication middleware
 */

// Middleware for future authentication
// TODO: Implement proper authentication when needed
const authenticateAdmin = (req, res, next) => {
  // For now, allow all requests
  // In production, implement proper auth check here
  next();
};

// Apply auth middleware to all admin routes (when implemented)
// router.use(authenticateAdmin);

// Serve admin static files from admin directory
const adminStaticPath = path.join(__dirname, '..', 'admin');
router.use('/static', express.static(adminStaticPath));

// Admin dashboard route
router.get('/', (req, res) => {
  try {
    // For now, send a basic HTML response
    // TODO: Serve actual admin interface file when available
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>AI Companion Admin Interface</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
          .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
          .status { display: inline-block; padding: 4px 8px; border-radius: 4px; color: white; font-size: 12px; }
          .status.online { background: #28a745; }
          .placeholder { background: #f8f9fa; border: 2px dashed #dee2e6; padding: 40px; text-align: center; color: #6c757d; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>AI Companion Admin Interface</h1>
            <p>Compassionate AI support system for elderly individuals</p>
            <span class="status online">System Online</span>
          </div>
          <div class="placeholder">
            <h3>Admin Interface Coming Soon</h3>
            <p>This is a placeholder for the admin interface.</p>
            <p>API endpoints are available at:</p>
            <ul style="text-align: left; display: inline-block;">
              <li><code>/api/admin/stats</code> - System statistics</li>
              <li><code>/api/admin/calls</code> - Recent calls data</li>
              <li><code>/api/admin/activity</code> - Activity feed</li>
              <li><code>/api/admin/config</code> - System configuration</li>
              <li><code>/api/admin/health</code> - Health check</li>
            </ul>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error serving admin interface:', error);
    res.status(500).json({ error: 'Failed to load admin interface' });
  }
});

// Admin login route (placeholder)
router.get('/login', (req, res) => {
  try {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Login - AI Companion</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          .login-form { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); max-width: 400px; width: 100%; }
          .form-group { margin-bottom: 20px; }
          label { display: block; margin-bottom: 5px; font-weight: bold; }
          input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
          .btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; width: 100%; }
          .btn:hover { background: #0056b3; }
        </style>
      </head>
      <body>
        <div class="login-form">
          <h2>Admin Login</h2>
          <p>Authentication will be implemented in a future update.</p>
          <form>
            <div class="form-group">
              <label>Username</label>
              <input type="text" name="username" placeholder="Enter username" disabled>
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" name="password" placeholder="Enter password" disabled>
            </div>
            <button type="button" class="btn" onclick="window.location.href='/admin'">Continue to Admin (No Auth)</button>
          </form>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error serving admin login:', error);
    res.status(500).json({ error: 'Failed to load login page' });
  }
});

// Health check for admin interface
router.get('/health', (req, res) => {
  try {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'admin-interface'
    });
  } catch (error) {
    console.error('Error in admin health check:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

module.exports = router;