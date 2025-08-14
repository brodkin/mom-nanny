const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class DatabaseManager {
  constructor(dbPath = './conversation-summaries.db') {
    this.dbPath = dbPath;
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
    this.exec(`
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
      this.run('INSERT INTO migrations (version) VALUES (?)', [1]);
    }
    
    // Apply memories table migration if needed
    if (currentVersion < 2) {
      this.applyMemoriesMigration();
      this.run('INSERT INTO migrations (version) VALUES (?)', [2]);
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

    this.exec(migration);
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

    this.exec(migration);
  }

  getCurrentMigrationVersion() {
    try {
      const result = this.get('SELECT MAX(version) as version FROM migrations');
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

  get(sql, params = []) {
    if (this.isClosed) {
      throw new Error('Database connection is closed');
    }
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

  exec(sql) {
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

  // Transaction helper
  async transaction(callback) {
    await this.waitForInitialization();
    this._ensureConnection();
    
    try {
      // For better-sqlite3, transactions must be synchronous
      // We'll execute the callback directly but ensure it doesn't return a promise
      const transactionFn = this.db.transaction(() => {
        // Call the callback synchronously - it cannot be async
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