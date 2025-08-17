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
router.use('/css', express.static(path.join(adminStaticPath, 'css')));
router.use('/js', express.static(path.join(adminStaticPath, 'js')));
router.use('/assets', express.static(path.join(adminStaticPath, 'assets')));
router.use('/static', express.static(adminStaticPath));

// Admin dashboard route - serve the main admin interface
router.get('/', (req, res) => {
  try {
    const adminIndexPath = path.join(__dirname, '..', 'admin', 'index.html');
    res.sendFile(adminIndexPath);
  } catch (error) {
    console.error('Error serving admin interface:', error);
    res.status(500).json({ error: 'Failed to load admin interface' });
  }
});

// Compassionate Care Dashboard route
router.get('/dashboard', (req, res) => {
  try {
    const dashboardPath = path.join(__dirname, '..', 'admin', 'dashboard.html');
    res.sendFile(dashboardPath);
  } catch (error) {
    console.error('Error serving care dashboard:', error);
    res.status(500).json({ error: 'Failed to load care dashboard' });
  }
});

// Conversations page route
router.get('/conversations', (req, res) => {
  try {
    const conversationsPath = path.join(__dirname, '..', 'admin', 'conversations.html');
    res.sendFile(conversationsPath);
  } catch (error) {
    console.error('Error serving conversations page:', error);
    res.status(500).json({ error: 'Failed to load conversations page' });
  }
});

// Memory Management page route
router.get('/memories', (req, res) => {
  try {
    const memoriesPath = path.join(__dirname, '..', 'admin', 'memories.html');
    res.sendFile(memoriesPath);
  } catch (error) {
    console.error('Error serving memories page:', error);
    res.status(500).json({ error: 'Failed to load memories page' });
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

// Catch-all route for .html files in admin directory
router.get('/*.html', (req, res) => {
  try {
    const fileName = req.params[0] + '.html';
    const filePath = path.join(__dirname, '..', 'admin', fileName);
    res.sendFile(filePath);
  } catch (error) {
    console.error(`Error serving admin file ${req.params[0]}.html:`, error);
    res.status(404).json({ 
      success: false,
      error: 'Admin page not found',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;