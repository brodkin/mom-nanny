const express = require('express');
const path = require('path');
const { authenticateAdmin, requireUnauthenticated } = require('../middleware/auth-middleware');
const router = express.Router();


/**
 * Admin Interface Router
 * 
 * Handles routing for the admin web interface including:
 * - Serving static admin files
 * - Admin page routing
 * - WebAuthn passkey authentication
 */

// Serve admin static files from admin directory
const adminStaticPath = path.join(__dirname, '..', 'admin');
router.use('/css', express.static(path.join(adminStaticPath, 'css')));
router.use('/js', express.static(path.join(adminStaticPath, 'js')));
router.use('/assets', express.static(path.join(adminStaticPath, 'assets')));
router.use('/static', express.static(adminStaticPath));

// Admin dashboard route - redirect to /admin/dashboard (protected)
router.get('/', authenticateAdmin, (req, res) => {
  try {
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error redirecting to admin dashboard:', error);
    res.status(500).json({ error: 'Failed to redirect to admin dashboard' });
  }
});

// Dashboard page route - protected
router.get('/dashboard', authenticateAdmin, (req, res) => {
  try {
    const dashboardPath = path.join(__dirname, '..', 'admin', 'dashboard.html');
    res.sendFile(dashboardPath);
  } catch (error) {
    console.error('Error serving dashboard page:', error);
    res.status(500).json({ error: 'Failed to load dashboard page' });
  }
});

// Conversations page route - protected
router.get('/conversations', authenticateAdmin, (req, res) => {
  try {
    const conversationsPath = path.join(__dirname, '..', 'admin', 'conversations.html');
    res.sendFile(conversationsPath);
  } catch (error) {
    console.error('Error serving conversations page:', error);
    res.status(500).json({ error: 'Failed to load conversations page' });
  }
});

// Memory Management page route - protected
router.get('/memories', authenticateAdmin, (req, res) => {
  try {
    const memoriesPath = path.join(__dirname, '..', 'admin', 'memories.html');
    res.sendFile(memoriesPath);
  } catch (error) {
    console.error('Error serving memories page:', error);
    res.status(500).json({ error: 'Failed to load memories page' });
  }
});

// Admin login route - public (unauthenticated users only)
router.get('/login', requireUnauthenticated, (req, res) => {
  try {
    const loginPath = path.join(__dirname, '..', 'admin', 'login.html');
    res.sendFile(loginPath);
  } catch (error) {
    console.error('Error serving admin login:', error);
    res.status(500).json({ error: 'Failed to load login page' });
  }
});

// Admin registration route - for token-based registration
router.get('/register', requireUnauthenticated, (req, res) => {
  try {
    const registerPath = path.join(__dirname, '..', 'admin', 'register.html');
    res.sendFile(registerPath);
  } catch (error) {
    console.error('Error serving admin registration:', error);
    res.status(500).json({ error: 'Failed to load registration page' });
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