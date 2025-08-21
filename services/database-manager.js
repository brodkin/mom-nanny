const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

/**
 * DatabaseManager implements a singleton pattern to ensure consistent database access
 * across all services in the compassionate AI companion system.
 * 
 * The singleton pattern ensures:
 * 1. SQLITE_DB_PATH environment variable is honored consistently
 * 2. Single database connection prevents conflicts
 * 3. Shared memory cache for better performance
 * 4. Consistent migration state across all services
 * 
 * Usage:
 *   const dbManager = DatabaseManager.getInstance();
 *   await dbManager.waitForInitialization();
 * 
 * For testing (allows custom path):
 *   const testDb = new DatabaseManager('./test.db');
 */
class DatabaseManager {
  // Singleton instance storage
  static _instance = null;
  static _instancePath = null;

  /**
   * Get the singleton instance of DatabaseManager
   * @param {string} dbPath - Optional database path (only used if no instance exists)
   * @returns {DatabaseManager} The singleton instance
   */
  static getInstance(dbPath = null) {
    // Use environment variable or provided path, defaulting to './conversation-summaries.db'
    const relativePath = dbPath || process.env.SQLITE_DB_PATH || './conversation-summaries.db';
    
    // Resolve to absolute path relative to project root (one level up from services/)
    const projectRoot = path.resolve(__dirname, '..');
    const targetPath = path.resolve(projectRoot, relativePath);
    
    // If no instance exists, create one
    if (!DatabaseManager._instance) {
      DatabaseManager._instance = new DatabaseManager(targetPath);
      DatabaseManager._instancePath = targetPath;
      console.log(`[DatabaseManager] Creating singleton instance with path: ${targetPath}`);
    } 
    // If instance exists but path differs, warn (this shouldn't happen in production)
    else if (dbPath && dbPath !== DatabaseManager._instancePath) {
      console.warn(`[DatabaseManager] Warning: Attempted to get instance with different path. Using existing instance with path: ${DatabaseManager._instancePath}`);
    }
    
    return DatabaseManager._instance;
  }

  /**
   * Reset the singleton instance (mainly for testing)
   * CRITICAL: Only use in test environments to allow different test databases
   */
  static resetInstance() {
    if (DatabaseManager._instance) {
      // Close existing connection if open
      if (DatabaseManager._instance.db) {
        try {
          DatabaseManager._instance.db.close();
        } catch (err) {
          console.error('[DatabaseManager] Error closing database during reset:', err);
        }
      }
      DatabaseManager._instance = null;
      DatabaseManager._instancePath = null;
      console.log('[DatabaseManager] Singleton instance reset');
    }
  }

  /**
   * Constructor is still public to support testing with custom paths
   * Production code should use getInstance() instead
   */
  constructor(dbPath = './conversation-summaries.db') {
    // Allow direct instantiation for testing, but log if not singleton
    if (DatabaseManager._instance && this !== DatabaseManager._instance) {
      console.log(`[DatabaseManager] Direct instantiation detected (likely for testing) with path: ${dbPath}`);
    }
    
    // Resolve path to absolute path if it's relative
    // For constructor calls, resolve relative to project root (one level up from services/)
    if (!path.isAbsolute(dbPath)) {
      const projectRoot = path.resolve(__dirname, '..');
      this.dbPath = path.resolve(projectRoot, dbPath);
    } else {
      this.dbPath = dbPath;
    }
    this.db = null;
    this.isInitialized = false;
    this.isClosed = false;
    this._initPromise = null;
    
    // Start initialization but don't wait for it in constructor
    this._initPromise = this.initializeDatabase();
  }

  async initializeDatabase() {
    if (this.isInitialized) {
      return Promise.resolve();
    }

    try {
      // Ensure directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Create database connection with better-sqlite3
      this.db = new Database(this.dbPath, { 
        verbose: process.env.DEBUG_SQL === 'true' ? console.log : null 
      });

      // Enable WAL mode for better performance with concurrent reads
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');
      this.db.pragma('temp_store = memory');

      // Apply migrations
      await this.applyMigrations();
      this.isInitialized = true;
      
      return Promise.resolve();

    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async applyMigrations() {
    // Create migrations table if it doesn't exist
    this._execSync(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const currentVersion = this.getCurrentMigrationVersion();
    
    // Apply initial schema migration if needed
    if (currentVersion < 1) {
      this.applyInitialSchema();
      this.runSync('INSERT INTO migrations (version) VALUES (?)', [1]);
    }
    
    // Apply memories table migration if needed
    if (currentVersion < 2) {
      this.applyMemoriesMigration();
      this.runSync('INSERT INTO migrations (version) VALUES (?)', [2]);
    }
    
    // Apply settings table migration if needed
    if (currentVersion < 3) {
      this.applySettingsMigration();
      this.runSync('INSERT INTO migrations (version) VALUES (?)', [3]);
    }
    
    // Apply performance indexes migration if needed
    if (currentVersion < 4) {
      this.applyPerformanceIndexesMigration();
      this.runSync('INSERT INTO migrations (version) VALUES (?)', [4]);
    }
  }

  applyInitialSchema() {
    const migration = `
      -- Conversations table: Core call metadata
      CREATE TABLE conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        call_sid TEXT UNIQUE NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration INTEGER,
        caller_info TEXT, -- JSON string
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Summaries table: Generated conversation summaries
      CREATE TABLE summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        summary_text TEXT NOT NULL, -- JSON string of full summary
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      -- Messages table: Individual conversation messages
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      -- Analytics table: Sentiment, keywords, patterns
      CREATE TABLE analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        sentiment_scores TEXT, -- JSON string
        keywords TEXT, -- JSON string
        patterns TEXT, -- JSON string
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      -- Indexes for performance
      CREATE INDEX idx_conversations_call_sid ON conversations(call_sid);
      CREATE INDEX idx_conversations_start_time ON conversations(start_time);
      CREATE INDEX idx_summaries_conversation_id ON summaries(conversation_id);
      CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
      CREATE INDEX idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX idx_analytics_conversation_id ON analytics(conversation_id);
    `;

    this._execSync(migration);
  }

  applyMemoriesMigration() {
    const migration = `
      -- Memories table: Store important information about the caller
      CREATE TABLE memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_key TEXT UNIQUE NOT NULL,
        memory_content TEXT NOT NULL,
        category TEXT, -- 'family', 'health', 'preferences', 'topics_to_avoid', 'general'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_accessed DATETIME
      );

      -- Indexes for performance
      CREATE INDEX idx_memories_key ON memories(memory_key);
      CREATE INDEX idx_memories_category ON memories(category);
      CREATE INDEX idx_memories_updated ON memories(updated_at);
    `;

    this._execSync(migration);
  }

  applySettingsMigration() {
    const migration = `
      -- Settings table: Store application configuration settings
      CREATE TABLE settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Insert default timezone setting
      INSERT INTO settings (key, value) VALUES ('timezone', 'America/New_York');

      -- Indexes for performance
      CREATE INDEX idx_settings_key ON settings(key);
      CREATE INDEX idx_settings_updated ON settings(updated_at);
    `;

    this._execSync(migration);
  }

  /**
   * Migration 4: Add performance indexes for common query patterns
   * 
   * This migration adds missing indexes that improve performance for:
   * - Admin dashboard queries (conversations by created_at)
   * - Recent summaries and pagination (summaries by created_at) 
   * - Analytics reporting (analytics by created_at)
   * - Conversation analysis (messages by role and timestamp)
   * - Memory retrieval and management (memories by category and updated_at)
   * 
   * Uses IF NOT EXISTS to safely apply to existing databases.
   */
  applyPerformanceIndexesMigration() {
    const migration = `
      -- Migration 4: Add missing performance indexes
      -- These indexes improve query performance for common access patterns
      
      -- Index for conversations by created_at (admin dashboard, recent conversations)
      CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
      
      -- Index for summaries by created_at (recent summaries, pagination)
      CREATE INDEX IF NOT EXISTS idx_summaries_created_at ON summaries(created_at);
      
      -- Index for analytics by created_at (analytics queries, reporting)
      CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at);
      
      -- Composite index for messages by role and timestamp (conversation analysis)
      CREATE INDEX IF NOT EXISTS idx_messages_role_timestamp ON messages(role, timestamp);
      
      -- Composite index for memories by category and updated_at (memory retrieval and management)
      CREATE INDEX IF NOT EXISTS idx_memories_category_updated ON memories(category, updated_at);
    `;

    this._execSync(migration);
  }

  getCurrentMigrationVersion() {
    try {
      const result = this._getSync('SELECT MAX(version) as version FROM migrations');
      return result?.version || 0;
    } catch (error) {
      // Table doesn't exist yet
      return 0;
    }
  }

  async waitForInitialization() {
    if (this._initPromise) {
      await this._initPromise;
    }
    return this.isInitialized;
  }

  getConnection() {
    if (!this.isInitialized || !this.db) {
      throw new Error('Database not initialized - call waitForInitialization() first');
    }
    return this.db;
  }

  _ensureConnection() {
    if (this.isClosed) {
      throw new Error('Database connection is closed');
    }
    if (!this.db) {
      throw new Error('Database connection is closed');
    }
    if (!this.isInitialized) {
      throw new Error('Database not initialized - call waitForInitialization() first');
    }
  }

  // Synchronous query methods with better-sqlite3
  async query(sql, params = []) {
    await this.waitForInitialization();
    this._ensureConnection();
    
    if (sql.trim().toLowerCase().startsWith('select')) {
      return this.all(sql, params);
    } else {
      return this.run(sql, params);
    }
  }

  async all(sql, params = []) {
    await this.waitForInitialization();
    this._ensureConnection();
    
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (err) {
      console.error('Database query error:', err);
      console.error('SQL:', sql);
      console.error('Params:', params);
      throw err;
    }
  }

  async get(sql, params = []) {
    await this.waitForInitialization();
    this._ensureConnection();
    
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params);
    } catch (err) {
      console.error('Database query error:', err);
      console.error('SQL:', sql);
      console.error('Params:', params);
      throw err;
    }
  }

  // PRIVATE: Sync get for internal use during initialization only
  _getSync(sql, params = []) {
    if (!this.db) {
      throw new Error('Database connection is closed');
    }
    
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params);
    } catch (err) {
      console.error('Database query error:', err);
      console.error('SQL:', sql);
      console.error('Params:', params);
      throw err;
    }
  }

  async run(sql, params = []) {
    // Check for closed state first (before waiting for init)
    if (this.isClosed) {
      throw new Error('Database connection is closed');
    }
    
    await this.waitForInitialization();
    
    if (!this.db) {
      throw new Error('Database connection is closed');
    }
    
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return {
        lastID: result.lastInsertRowid,
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      };
    } catch (err) {
      console.error('Database query error:', err);
      console.error('SQL:', sql);
      console.error('Params:', params);
      throw err;
    }
  }

  runSync(sql, params = []) {
    if (this.isClosed) {
      throw new Error('Database connection is closed');
    }
    if (!this.db) {
      throw new Error('Database connection is closed');
    }
    
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return {
        lastID: result.lastInsertRowid,
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      };
    } catch (err) {
      console.error('Database query error:', err);
      console.error('SQL:', sql);
      console.error('Params:', params);
      throw err;
    }
  }

  async exec(sql) {
    await this.waitForInitialization();
    this._ensureConnection();
    
    try {
      this.db.exec(sql);
    } catch (err) {
      console.error('Database exec error:', err);
      console.error('SQL:', sql);
      throw err;
    }
  }

  // PRIVATE: Sync exec for internal use during initialization only
  _execSync(sql) {
    // Don't check _ensureConnection for sync exec - used during initialization
    try {
      this.db.exec(sql);
    } catch (err) {
      console.error('Database exec error:', err);
      console.error('SQL:', sql);
      throw err;
    }
  }

  async getTables() {
    const result = await this.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'
      ORDER BY name
    `);
    return result.map(row => row.name);
  }

  async getTableSchema(tableName) {
    return this.all(`PRAGMA table_info(${tableName})`);
  }

  /**
   * Verify that all expected tables and indexes exist in the database
   * @returns {Promise<{isValid: boolean, missingTables: string[], missingIndexes: string[]}>}
   */
  async verifySchema() {
    await this.waitForInitialization();
    this._ensureConnection();

    const expectedTables = [
      'conversations',
      'summaries',
      'messages',
      'analytics',
      'memories',
      'settings'
    ];

    const expectedIndexes = [
      // Initial schema indexes
      'idx_conversations_call_sid',
      'idx_conversations_start_time',
      'idx_summaries_conversation_id',
      'idx_messages_conversation_id',
      'idx_messages_timestamp',
      'idx_analytics_conversation_id',
      // Memories migration indexes
      'idx_memories_key',
      'idx_memories_category',
      'idx_memories_updated',
      // Settings migration indexes
      'idx_settings_key',
      'idx_settings_updated',
      // Performance migration indexes (Migration 4)
      'idx_conversations_created_at',
      'idx_summaries_created_at',
      'idx_analytics_created_at',
      'idx_messages_role_timestamp',
      'idx_memories_category_updated'
    ];

    try {
      // Check for existing tables
      const existingTables = await this.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'
        ORDER BY name
      `);
      const existingTableNames = existingTables.map(row => row.name);

      // Check for existing indexes
      const existingIndexes = await this.all(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND sql NOT NULL
        ORDER BY name
      `);
      const existingIndexNames = existingIndexes.map(row => row.name);

      // Find missing tables
      const missingTables = expectedTables.filter(table => 
        !existingTableNames.includes(table)
      );

      // Find missing indexes
      const missingIndexes = expectedIndexes.filter(index => 
        !existingIndexNames.includes(index)
      );

      const isValid = missingTables.length === 0 && missingIndexes.length === 0;

      return {
        isValid,
        missingTables,
        missingIndexes
      };

    } catch (error) {
      console.error('Error verifying schema:', error);
      return {
        isValid: false,
        missingTables: expectedTables,
        missingIndexes: expectedIndexes
      };
    }
  }

  /**
   * Execute a transaction with synchronous callback
   * CRITICAL: Callback MUST be synchronous - async callbacks will cause data corruption!
   * 
   * better-sqlite3 transactions do not work with async functions. Async functions
   * always return after the first await, which means the transaction will already
   * be committed before any async code executes.
   * 
   * @param {Function} callback - SYNCHRONOUS callback function
   * @returns {Promise<any>} Result of the transaction
   * @example
   * await db.transaction(() => {
   *   db.runSync('INSERT INTO table VALUES (?, ?)', [val1, val2]);
   *   return result;
   * });
   */
  async transaction(callback) {
    await this.waitForInitialization();
    this._ensureConnection();
    
    try {
      // Validate callback is not async to prevent data corruption
      if (callback.constructor.name === 'AsyncFunction') {
        throw new Error('Transaction callback cannot be async. Use synchronous callbacks only to prevent data corruption.');
      }
      
      // For better-sqlite3, transactions must be synchronous
      const transactionFn = this.db.transaction(() => {
        // Call the callback synchronously
        return callback();
      });
      return transactionFn();
    } catch (error) {
      throw error;
    }
  }

  close() {
    if (this.db) {
      try {
        this.db.close();
        this.db = null;
        this.isInitialized = false;
        this.isClosed = true;
        this._initPromise = null;
        return Promise.resolve();
      } catch (err) {
        console.error('Error closing database:', err);
        return Promise.reject(err);
      }
    }
    this.isClosed = true;
    return Promise.resolve();
  }

  // Health check
  async isHealthy() {
    try {
      await this.waitForInitialization();
      await this.get('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = DatabaseManager;