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
    
    // Special handling for in-memory database
    let targetPath;
    if (relativePath === ':memory:') {
      targetPath = ':memory:';  // Keep as-is for SQLite
    } else {
      // Resolve to absolute path relative to project root (one level up from services/)
      const projectRoot = path.resolve(__dirname, '..');
      targetPath = path.resolve(projectRoot, relativePath);
    }
    
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
    
    // Special handling for SQLite in-memory database
    if (dbPath === ':memory:') {
      this.dbPath = ':memory:';  // Keep as-is for SQLite to create in-memory database
    } else if (!path.isAbsolute(dbPath)) {
      // Resolve relative paths to absolute path relative to project root
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
      // Ensure directory exists (skip for in-memory databases)
      if (this.dbPath !== ':memory:') {
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }
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
      // HIPAA COMPLIANCE: Never log full error object as it may contain database query data with PHI
      console.error('Failed to initialize database:', error.message);
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
    
    // Apply emotional metrics migration if needed
    if (currentVersion < 5) {
      this.applyEmotionalMetricsMigration();
      this.runSync('INSERT INTO migrations (version) VALUES (?)', [5]);
    }
    
    // Apply fact memory migration if needed
    if (currentVersion < 6) {
      this.applyFactMemoryMigration();
      this.runSync('INSERT INTO migrations (version) VALUES (?)', [6]);
    }
    
    // Apply voicemail transcript migration if needed
    if (currentVersion < 7) {
      this.applyVoicemailTranscriptMigration();
      this.runSync('INSERT INTO migrations (version) VALUES (?)', [7]);
    }
    
    // Apply authentication migration if needed
    if (currentVersion < 8) {
      this.applyAuthenticationMigration();
      this.runSync('INSERT INTO migrations (version) VALUES (?)', [8]);
    }
    
    // Apply registration token improvement migration if needed
    if (currentVersion < 9) {
      this.applyRegistrationTokenMigration();
      this.runSync('INSERT INTO migrations (version) VALUES (?)', [9]);
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

  /**
   * Migration 5: Add emotional_metrics table for tracking user emotional states
   * 
   * This migration creates the emotional_metrics table to store:
   * - User emotional indicators (anxiety, agitation, confusion levels)
   * - Care indicators (pain, medication, staff complaints)
   * - Conversation sentiment analysis
   * - Temporal patterns and triggers
   * 
   * This enables:
   * - Mental state tracking over time
   * - Care plan optimization
   * - Early intervention for emotional distress
   * - Family member awareness of emotional patterns
   */
  applyEmotionalMetricsMigration() {
    const migration = `
      -- Migration 5: Create emotional_metrics table
      -- Tracks user emotional states and care indicators during conversations
      
      CREATE TABLE IF NOT EXISTS emotional_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        
        -- Emotional state indicators (0-10 scale)
        anxiety_level INTEGER CHECK (anxiety_level >= 0 AND anxiety_level <= 10),
        agitation_level INTEGER CHECK (agitation_level >= 0 AND agitation_level <= 10),
        confusion_level INTEGER CHECK (confusion_level >= 0 AND confusion_level <= 10),
        comfort_level INTEGER CHECK (comfort_level >= 0 AND comfort_level <= 10),
        
        -- Care indicators (boolean flags)
        mentions_pain BOOLEAN DEFAULT FALSE,
        mentions_medication BOOLEAN DEFAULT FALSE,
        mentions_staff_complaint BOOLEAN DEFAULT FALSE,
        mentions_family BOOLEAN DEFAULT FALSE,
        
        -- Conversation quality metrics
        interruption_count INTEGER DEFAULT 0,
        repetition_count INTEGER DEFAULT 0,
        topic_changes INTEGER DEFAULT 0,
        
        -- Sentiment analysis
        overall_sentiment TEXT CHECK (overall_sentiment IN ('positive', 'neutral', 'negative')),
        sentiment_score REAL CHECK (sentiment_score >= -1.0 AND sentiment_score <= 1.0),
        
        -- Temporal information
        call_duration_seconds INTEGER,
        time_of_day TEXT, -- 'morning', 'afternoon', 'evening', 'night'
        day_of_week TEXT CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
        
        -- Detection flags for specific concerns
        emergency_indicators TEXT, -- JSON array of emergency keywords detected
        memory_triggers TEXT, -- JSON array of memory-related topics mentioned
        
        -- Metadata
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
      
      -- Indexes for efficient querying
      CREATE INDEX IF NOT EXISTS idx_emotional_metrics_conversation_id ON emotional_metrics(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_emotional_metrics_created_at ON emotional_metrics(created_at);
      CREATE INDEX IF NOT EXISTS idx_emotional_metrics_anxiety_level ON emotional_metrics(anxiety_level);
      CREATE INDEX IF NOT EXISTS idx_emotional_metrics_overall_sentiment ON emotional_metrics(overall_sentiment);
      CREATE INDEX IF NOT EXISTS idx_emotional_metrics_time_patterns ON emotional_metrics(time_of_day, day_of_week);
      
      -- Composite index for trend analysis
      CREATE INDEX IF NOT EXISTS idx_emotional_metrics_trends ON emotional_metrics(created_at, anxiety_level, agitation_level, comfort_level);
    `;

    this._execSync(migration);
  }

  /**
   * Migration 6: Add is_fact column to memories table for distinguishing caller vs fact memories
   * 
   * This migration adds:
   * - is_fact column (BOOLEAN DEFAULT FALSE) to track memory source
   * - Performance index on is_fact for filtering queries
   * 
   * Existing memories default to FALSE (caller-collected) to maintain current behavior.
   * New fact-based memories can be marked TRUE for LLM-generated/verified information.
   */
  applyFactMemoryMigration() {
    const migration = `
      -- Migration 6: Add is_fact column and index to memories table
      -- Distinguishes between caller-collected memories (FALSE) and fact-based memories (TRUE)
      
      -- Add is_fact column with default FALSE for existing memories
      ALTER TABLE memories ADD COLUMN is_fact BOOLEAN DEFAULT FALSE;
      
      -- Create index on is_fact for performance (filtering queries)
      CREATE INDEX IF NOT EXISTS idx_memories_is_fact ON memories(is_fact);
    `;

    this._execSync(migration);
  }

  applyVoicemailTranscriptMigration() {
    const migration = `
      -- Migration 7: Add voicemail_transcript column to conversations table
      -- Stores the initial voicemail transcript when a conversation starts with a voicemail
      
      -- Add voicemail_transcript column to conversations table
      ALTER TABLE conversations ADD COLUMN voicemail_transcript TEXT;
      
      -- Create index on voicemail_transcript for performance (filtering conversations with voicemails)
      CREATE INDEX IF NOT EXISTS idx_conversations_voicemail_transcript ON conversations(voicemail_transcript);
    `;

    this._execSync(migration);
  }

  /**
   * Migration 8: Add authentication tables for WebAuthn passkey support
   * 
   * This migration creates the authentication system tables per original spec:
   * - users: Admin user accounts (email only, no usernames)
   * - registration_tokens: CLI-generated registration tokens with 24-hour expiry
   * - user_credentials: WebAuthn credential storage (renamed from webauthn_credentials)
   * - user_sessions: Active session management
   * 
   * Follows CLI-only registration flow as specified in tasks.md
   */
  applyAuthenticationMigration() {
    const migration = `
      -- Migration 8: Authentication tables for CLI-based WebAuthn passkey support
      
      -- Users table: Admin user accounts (email-based, no usernames)
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1))
      );
      
      -- Registration tokens table: CLI-generated tokens with 24-hour expiry
      CREATE TABLE IF NOT EXISTS registration_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        used INTEGER DEFAULT 0 CHECK (used IN (0, 1)),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      -- User credentials table: Store WebAuthn passkey credentials
      CREATE TABLE IF NOT EXISTS user_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        credential_id TEXT UNIQUE NOT NULL,
        public_key TEXT NOT NULL,
        counter INTEGER DEFAULT 0,
        transports TEXT, -- JSON array of supported transports
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      
      -- User sessions table: Manage active login sessions
      CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_id TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_agent TEXT,
        ip_address TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      
      -- Indexes for authentication performance
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
      
      CREATE INDEX IF NOT EXISTS idx_registration_tokens_token ON registration_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_registration_tokens_email ON registration_tokens(email);
      CREATE INDEX IF NOT EXISTS idx_registration_tokens_expires_at ON registration_tokens(expires_at);
      
      CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_credentials_credential_id ON user_credentials(credential_id);
      
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
    `;

    this._execSync(migration);
  }

  /**
   * Migration 9: Make email optional in registration_tokens table
   * 
   * This migration modifies the registration_tokens table to:
   * - Make email field optional (collected during registration, not token generation)
   * - Update the schema to support email-less token generation
   * 
   * This enables the CLI to generate tokens without collecting email upfront,
   * matching the original specification where email is collected on the registration page.
   */
  applyRegistrationTokenMigration() {
    // Check if the registration_tokens table exists first
    const tableExists = this._getSync(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='registration_tokens'
    `);

    if (!tableExists) {
      // Table doesn't exist yet, create it with optional email directly
      const migration = `
        -- Migration 9: Create registration_tokens table with optional email
        CREATE TABLE IF NOT EXISTS registration_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token TEXT UNIQUE NOT NULL,
          email TEXT, -- Optional email
          expires_at DATETIME NOT NULL,
          used INTEGER DEFAULT 0 CHECK (used IN (0, 1)),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_registration_tokens_token ON registration_tokens(token);
        CREATE INDEX IF NOT EXISTS idx_registration_tokens_email ON registration_tokens(email);
        CREATE INDEX IF NOT EXISTS idx_registration_tokens_expires_at ON registration_tokens(expires_at);
      `;
      this._execSync(migration);
    } else {
      // Table exists, need to modify it (SQLite requires recreation)
      const migration = `
        -- Migration 9: Make email optional in existing registration_tokens table
        -- SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table
        
        -- Create new table with optional email
        CREATE TABLE registration_tokens_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token TEXT UNIQUE NOT NULL,
          email TEXT, -- Made optional
          expires_at DATETIME NOT NULL,
          used INTEGER DEFAULT 0 CHECK (used IN (0, 1)),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Copy existing data
        INSERT INTO registration_tokens_new (id, token, email, expires_at, used, created_at)
        SELECT id, token, email, expires_at, used, created_at FROM registration_tokens;
        
        -- Drop old table
        DROP TABLE registration_tokens;
        
        -- Rename new table
        ALTER TABLE registration_tokens_new RENAME TO registration_tokens;
        
        -- Recreate indexes
        CREATE INDEX IF NOT EXISTS idx_registration_tokens_token ON registration_tokens(token);
        CREATE INDEX IF NOT EXISTS idx_registration_tokens_email ON registration_tokens(email);
        CREATE INDEX IF NOT EXISTS idx_registration_tokens_expires_at ON registration_tokens(expires_at);
      `;
      this._execSync(migration);
    }
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
      'settings',
      'emotional_metrics'
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
      'idx_memories_category_updated',
      // Emotional metrics migration indexes (Migration 5)
      'idx_emotional_metrics_conversation_id',
      'idx_emotional_metrics_created_at',
      'idx_emotional_metrics_anxiety_level',
      'idx_emotional_metrics_overall_sentiment',
      'idx_emotional_metrics_time_patterns',
      'idx_emotional_metrics_trends',
      // Fact memory migration indexes (Migration 6)
      'idx_memories_is_fact'
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

  /**
   * Save emotional metrics for a conversation
   * 
   * @param {number} conversationId - The conversation ID to associate metrics with
   * @param {Object} metrics - Emotional metrics data
   * @param {number} [metrics.anxietyLevel] - Anxiety level (0-10)
   * @param {number} [metrics.agitationLevel] - Agitation level (0-10)
   * @param {number} [metrics.confusionLevel] - Confusion level (0-10)
   * @param {number} [metrics.comfortLevel] - Comfort level (0-10)
   * @param {boolean} [metrics.mentionsPain] - Whether pain was mentioned
   * @param {boolean} [metrics.mentionsMedication] - Whether medication was mentioned
   * @param {boolean} [metrics.mentionsStaffComplaint] - Whether staff complaints were mentioned
   * @param {boolean} [metrics.mentionsFamily] - Whether family was mentioned
   * @param {number} [metrics.interruptionCount] - Number of interruptions
   * @param {number} [metrics.repetitionCount] - Number of repetitions
   * @param {number} [metrics.topicChanges] - Number of topic changes
   * @param {string} [metrics.overallSentiment] - Overall sentiment ('positive', 'neutral', 'negative')
   * @param {number} [metrics.sentimentScore] - Sentiment score (-1.0 to 1.0)
   * @param {number} [metrics.callDurationSeconds] - Call duration in seconds
   * @param {string} [metrics.timeOfDay] - Time of day ('morning', 'afternoon', 'evening', 'night')
   * @param {string} [metrics.dayOfWeek] - Day of week ('monday', 'tuesday', etc.)
   * @param {Array} [metrics.emergencyIndicators] - Array of emergency keywords detected
   * @param {Array} [metrics.memoryTriggers] - Array of memory-related topics mentioned
   * @returns {Promise<{lastID: number, changes: number}>} Database operation result
   */
  async saveEmotionalMetrics(conversationId, metrics) {
    await this.waitForInitialization();
    this._ensureConnection();

    // Validate required parameter
    if (!conversationId) {
      throw new Error('conversationId is required for saveEmotionalMetrics');
    }

    // Convert from GPT's 0-100 scale to database's 0-10 scale
    const scaleDown = (value) => {
      if (value === undefined || value === null) return null;
      return Math.round(value / 10); // Convert 0-100 to 0-10
    };

    // Convert mood from -100 to +100 to -1.0 to +1.0
    const scaleMood = (value) => {
      if (value === undefined || value === null) return null;
      return value / 100; // Convert -100 to +100 to -1.0 to +1.0
    };

    // Apply scale conversions
    const scaledMetrics = {
      ...metrics,
      anxietyLevel: scaleDown(metrics.anxietyLevel),
      agitationLevel: scaleDown(metrics.agitationLevel),
      confusionLevel: scaleDown(metrics.confusionLevel),
      comfortLevel: scaleDown(metrics.comfortLevel),
      sentimentScore: scaleMood(metrics.overallMood)
    };

    // Validate metric ranges after scaling
    const validateRange = (value, name, min = 0, max = 10) => {
      if (value !== undefined && value !== null && (value < min || value > max)) {
        throw new Error(`${name} must be between ${min} and ${max}, got ${value}`);
      }
    };

    validateRange(scaledMetrics.anxietyLevel, 'anxietyLevel');
    validateRange(scaledMetrics.agitationLevel, 'agitationLevel');
    validateRange(scaledMetrics.confusionLevel, 'confusionLevel');
    validateRange(scaledMetrics.comfortLevel, 'comfortLevel');
    validateRange(scaledMetrics.sentimentScore, 'sentimentScore', -1.0, 1.0);

    // Validate sentiment values
    if (metrics.overallSentiment && !['positive', 'neutral', 'negative'].includes(metrics.overallSentiment)) {
      throw new Error('overallSentiment must be one of: positive, neutral, negative');
    }

    // Validate day of week
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (metrics.dayOfWeek && !validDays.includes(metrics.dayOfWeek.toLowerCase())) {
      throw new Error('dayOfWeek must be one of: ' + validDays.join(', '));
    }

    try {
      const sql = `
        INSERT INTO emotional_metrics (
          conversation_id,
          anxiety_level,
          agitation_level,
          confusion_level,
          comfort_level,
          mentions_pain,
          mentions_medication,
          mentions_staff_complaint,
          mentions_family,
          interruption_count,
          repetition_count,
          topic_changes,
          overall_sentiment,
          sentiment_score,
          call_duration_seconds,
          time_of_day,
          day_of_week,
          emergency_indicators,
          memory_triggers
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        conversationId,
        scaledMetrics.anxietyLevel || null,
        scaledMetrics.agitationLevel || null,
        scaledMetrics.confusionLevel || null,
        scaledMetrics.comfortLevel || null,
        metrics.mentionsPain ? 1 : 0,
        metrics.mentionsMedication ? 1 : 0,
        metrics.mentionsStaffComplaint ? 1 : 0,
        metrics.mentionsFamily ? 1 : 0,
        metrics.interruptionCount || 0,
        metrics.repetitionCount || 0,
        metrics.topicChanges || 0,
        metrics.overallSentiment || null,
        scaledMetrics.sentimentScore || null,
        metrics.callDurationSeconds || null,
        metrics.timeOfDay || null,
        metrics.dayOfWeek ? metrics.dayOfWeek.toLowerCase() : null,
        metrics.emergencyIndicators ? JSON.stringify(metrics.emergencyIndicators) : null,
        metrics.memoryTriggers ? JSON.stringify(metrics.memoryTriggers) : null
      ];

      return await this.run(sql, params);

    } catch (error) {
      console.error('Error saving emotional metrics:', error.message);
      console.error('ConversationId:', conversationId);
      // HIPAA COMPLIANCE: Never log full metrics object as it contains PHI (patient emotional data)
      console.error('Metrics validation failed - check input parameters');
      throw error;
    }
  }

  /**
   * Get today's call statistics including call count and time since last call
   * Uses the configured timezone to determine "today" (not UTC)
   * 
   * @returns {Promise<{callsToday: number, lastCallTime: string|null, timeSinceLastCall: string|null}>}
   */
  async getTodayCallStats() {
    await this.waitForInitialization();
    this._ensureConnection();

    try {
      // Get the configured timezone (defaults to America/Los_Angeles)
      const _timezone = process.env.TIMEZONE || 'America/Los_Angeles';
      
      // For now, use SQLite's localtime function since it matches the system timezone
      // TODO: Implement proper IANA timezone support for non-system timezones
      const callCountQuery = `
        SELECT COUNT(*) as callsToday 
        FROM conversations 
        WHERE DATE(start_time, 'localtime') = DATE('now', 'localtime')
      `;
      const callCountResult = await this.get(callCountQuery);
      const callsToday = callCountResult?.callsToday || 0;

      // Get the most recent call time (if any calls exist)
      const lastCallQuery = `
        SELECT start_time, end_time
        FROM conversations 
        ORDER BY start_time DESC 
        LIMIT 1
      `;
      const lastCallResult = await this.get(lastCallQuery);
      
      let lastCallTime = null;
      let timeSinceLastCall = null;
      
      if (lastCallResult?.start_time) {
        lastCallTime = lastCallResult.start_time;
        
        // Calculate time since last call in human-readable format
        const lastCall = new Date(lastCallTime);
        const now = new Date();
        const diffMs = now - lastCall;
        
        // Convert to human-readable format
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
          timeSinceLastCall = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else if (diffHours > 0) {
          timeSinceLastCall = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffMinutes > 0) {
          timeSinceLastCall = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
        } else {
          timeSinceLastCall = 'just now';
        }
      }

      return {
        callsToday,
        lastCallTime,
        timeSinceLastCall
      };

    } catch (error) {
      console.error('Error getting today\'s call stats:', error.message);
      // Return default values on error to prevent system failure
      return {
        callsToday: 0,
        lastCallTime: null,
        timeSinceLastCall: null
      };
    }
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