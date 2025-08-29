/**
 * Unit Tests for Authentication Middleware
 * 
 * Tests the authentication system including:
 * - Development auto-login functionality
 * - Production security enforcement
 * - Session validation
 * - Bootstrap detection
 */

const { developmentAutoLogin, authenticateAdmin } = require('../middleware/auth-middleware');
const DatabaseManager = require('../services/database-manager');

// Mock request/response objects
const createMockReq = (sessionData = null, path = '/admin/dashboard') => ({
  session: sessionData || {},
  path,
  get: jest.fn(() => 'test-user-agent'),
  ip: '127.0.0.1'
});

const createMockRes = () => {
  const res = {
    redirect: jest.fn(),
    status: jest.fn(() => res),
    json: jest.fn(() => res),
    sendFile: jest.fn()
  };
  return res;
};

describe('Authentication Middleware', () => {
  let dbManager;
  let originalGetInstance;

  beforeEach(async () => {
    // Reset singleton to ensure clean state
    DatabaseManager.resetInstance();
    
    // Create fresh in-memory database
    dbManager = new DatabaseManager(':memory:');
    await dbManager.waitForInitialization();
    
    // Mock getInstance to return our test database
    originalGetInstance = DatabaseManager.getInstance;
    DatabaseManager.getInstance = jest.fn(() => dbManager);
    
    // Reset environment variables
    delete process.env.NODE_ENV;
    
    // Clear console mocks
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(async () => {
    // Restore original getInstance
    if (originalGetInstance) {
      DatabaseManager.getInstance = originalGetInstance;
    }
    
    // Explicitly close database connection
    if (dbManager) {
      try {
        await dbManager.close();
      } catch (err) {
        // Ignore close errors in tests
      }
      dbManager = null;
    }
    
    // Reset singleton after test
    DatabaseManager.resetInstance();
  });

  describe('Development Auto-Login', () => {
    beforeEach(() => {
      // Set development mode
      process.env.NODE_ENV = 'development';
    });

    test('should auto-login in development mode when user exists', async () => {
      // Create test user
      const userResult = await dbManager.run(`
        INSERT INTO users (email, display_name, is_active) 
        VALUES (?, ?, ?)
      `, ['test@example.com', 'Test User', 1]);

      const req = createMockReq();
      const result = await developmentAutoLogin(req);

      expect(result).toBeTruthy();
      expect(result.email).toBe('test@example.com');
      expect(result.displayName).toBe('Test User');
      expect(req.session.id).toBeDefined();
      expect(req.session.userId).toBe(userResult.lastInsertRowid);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[DEV AUTO-LOGIN] 🔓 Automatically authenticated as: test@example.com')
      );
    });

    test('should NOT auto-login in production mode', async () => {
      process.env.NODE_ENV = 'production';
      
      // Create test user
      await dbManager.run(`
        INSERT INTO users (email, display_name, is_active) 
        VALUES (?, ?, ?)
      `, ['test@example.com', 'Test User', 1]);

      const req = createMockReq();
      const result = await developmentAutoLogin(req);

      expect(result).toBe(false);
      expect(req.session.id).toBeUndefined();
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('[DEV AUTO-LOGIN]')
      );
    });

    test('should not override existing session', async () => {
      // Create test user
      await dbManager.run(`
        INSERT INTO users (email, display_name, is_active) 
        VALUES (?, ?, ?)
      `, ['test@example.com', 'Test User', 1]);

      const existingSessionId = 'existing-session-123';
      const req = createMockReq({ id: existingSessionId, userId: 99 });
      const result = await developmentAutoLogin(req);

      expect(result).toBe(false);
      expect(req.session.id).toBe(existingSessionId);
    });

    test('should return false when no users exist', async () => {
      const req = createMockReq();
      const result = await developmentAutoLogin(req);

      expect(result).toBe(false);
      expect(req.session.id).toBeUndefined();
    });

    test('should return false when only inactive users exist', async () => {
      // Create inactive test user
      await dbManager.run(`
        INSERT INTO users (email, display_name, is_active) 
        VALUES (?, ?, ?)
      `, ['inactive@example.com', 'Inactive User', 0]);

      const req = createMockReq();
      const result = await developmentAutoLogin(req);

      expect(result).toBe(false);
      expect(req.session.id).toBeUndefined();
    });

    test('should handle database errors gracefully', async () => {
      // Mock database error by temporarily breaking getInstance
      const originalGetInstance = DatabaseManager.getInstance;
      DatabaseManager.getInstance = jest.fn(() => {
        throw new Error('Database connection failed');
      });
      
      const req = createMockReq();
      const result = await developmentAutoLogin(req);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        '[DEV AUTO-LOGIN] Error during development auto-login:',
        expect.any(Error)
      );
      
      // Restore original function
      DatabaseManager.getInstance = originalGetInstance;
    });

    test('should select oldest user when multiple users exist', async () => {
      // Create multiple users (oldest first)
      await dbManager.run(`
        INSERT INTO users (email, display_name, is_active, created_at) 
        VALUES (?, ?, ?, datetime('now', '-2 hours'))
      `, ['oldest@example.com', 'Oldest User', 1]);
      
      await dbManager.run(`
        INSERT INTO users (email, display_name, is_active, created_at) 
        VALUES (?, ?, ?, datetime('now', '-1 hour'))
      `, ['newer@example.com', 'Newer User', 1]);

      const req = createMockReq();
      const result = await developmentAutoLogin(req);

      expect(result).toBeTruthy();
      expect(result.email).toBe('oldest@example.com');
    });
  });

  describe('Integration with authenticateAdmin', () => {
    test('should use auto-login in development mode', async () => {
      process.env.NODE_ENV = 'development';
      
      // Create test user
      await dbManager.run(`
        INSERT INTO users (email, display_name, is_active) 
        VALUES (?, ?, ?)
      `, ['auto@example.com', 'Auto User', 1]);

      const req = createMockReq();
      const res = createMockRes();
      const next = jest.fn();

      await authenticateAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.email).toBe('auto@example.com');
      expect(res.redirect).not.toHaveBeenCalled();
    });

    test('should redirect to login in production mode without session', async () => {
      process.env.NODE_ENV = 'production';
      
      // Create test user
      await dbManager.run(`
        INSERT INTO users (email, display_name, is_active) 
        VALUES (?, ?, ?)
      `, ['test@example.com', 'Test User', 1]);

      const req = createMockReq();
      const res = createMockRes();
      const next = jest.fn();

      await authenticateAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/admin/login');
    });

    test('should redirect to login when no users exist', async () => {
      process.env.NODE_ENV = 'development';
      
      const req = createMockReq();
      const res = createMockRes();
      const next = jest.fn();

      await authenticateAdmin(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/admin/login');
    });
  });

  describe('Environment Variable Detection', () => {
    test('should NOT auto-login when NODE_ENV is undefined (security)', async () => {
      delete process.env.NODE_ENV;
      
      // Create test user
      await dbManager.run(`
        INSERT INTO users (email, display_name, is_active) 
        VALUES (?, ?, ?)
      `, ['test@example.com', 'Test User', 1]);

      const req = createMockReq();
      const result = await developmentAutoLogin(req);

      expect(result).toBe(false);
      expect(req.session.id).toBeUndefined();
    });

    test('should NOT auto-login when NODE_ENV is empty (security)', async () => {
      process.env.NODE_ENV = '';
      
      // Create test user
      await dbManager.run(`
        INSERT INTO users (email, display_name, is_active) 
        VALUES (?, ?, ?)
      `, ['test@example.com', 'Test User', 1]);

      const req = createMockReq();
      const result = await developmentAutoLogin(req);

      expect(result).toBe(false);
      expect(req.session.id).toBeUndefined();
    });

    test('should only enable auto-login in development mode', async () => {
      const secureTestModes = ['production', 'test', 'staging', '', undefined, null];
      
      for (const mode of secureTestModes) {
        if (mode === undefined) {
          delete process.env.NODE_ENV;
        } else {
          process.env.NODE_ENV = mode;
        }
        
        await dbManager.run(`
          INSERT OR REPLACE INTO users (id, email, display_name, is_active) 
          VALUES (1, ?, ?, ?)
        `, ['test@example.com', 'Test User', 1]);

        const req = createMockReq();
        const result = await developmentAutoLogin(req);

        expect(result).toBe(false);
      }
      
      // Only 'development' should enable auto-login
      process.env.NODE_ENV = 'development';
      const req = createMockReq();
      const result = await developmentAutoLogin(req);
      expect(result).toBeTruthy();
    });
  });
});