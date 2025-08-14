/**
 * Initial database schema migration for conversation summaries
 * Version: 001
 * Description: Creates core tables for conversation tracking, summaries, messages, and analytics
 */

const MIGRATION_VERSION = 1;

const UP_SQL = `
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

const DOWN_SQL = `
-- Drop indexes
DROP INDEX IF EXISTS idx_analytics_conversation_id;
DROP INDEX IF EXISTS idx_messages_timestamp;
DROP INDEX IF EXISTS idx_messages_conversation_id;
DROP INDEX IF EXISTS idx_summaries_conversation_id;
DROP INDEX IF EXISTS idx_conversations_start_time;
DROP INDEX IF EXISTS idx_conversations_call_sid;

-- Drop tables (order matters due to foreign keys)
DROP TABLE IF EXISTS analytics;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS summaries;
DROP TABLE IF EXISTS conversations;
`;

module.exports = {
  version: MIGRATION_VERSION,
  up: UP_SQL,
  down: DOWN_SQL,
  description: 'Create initial schema for conversation tracking and analytics'
};