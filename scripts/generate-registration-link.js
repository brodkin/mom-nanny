#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

const crypto = require('crypto');
const DatabaseManager = require('../services/database-manager');

/**
 * CLI Script: Generate Registration Link
 * 
 * Creates secure registration tokens for admin user registration.
 * Per original specification in tasks.md:
 * - CLI-only registration (no web-based setup)
 * - 24-hour token expiry
 * - Email-based user identification
 * 
 * Usage:
 *   npm run generate-registration-link
 *   node scripts/generate-registration-link.js [email] [name]
 */

async function generateRegistrationLink() {
  try {
    // Initialize database using same path as main app
    const dbPath = process.env.SQLITE_DB_PATH || './storage/conversation-summaries.db';
    const dbManager = new DatabaseManager(dbPath);
    await dbManager.waitForInitialization();

    // Generate secure token (32 bytes = 256 bits)
    const token = crypto.randomBytes(32).toString('hex');
    
    // Calculate expiry time (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Store token in database (email will be collected during registration)
    await dbManager.run(`
      INSERT INTO registration_tokens (token, expires_at, created_at)
      VALUES (?, ?, datetime('now'))
    `, [token, expiresAt.toISOString()]);

    // Generate registration URL
    const serverUrl = process.env.SERVER 
      ? `https://${process.env.SERVER}` 
      : 'http://localhost:3000';
    const registrationUrl = `${serverUrl}/admin/register?token=${token}`;

    // Clean up expired tokens while we're here
    await dbManager.run(`
      DELETE FROM registration_tokens 
      WHERE expires_at < datetime('now') OR used = 1
    `);

    // Output results
    console.log('\n✅ Registration link generated successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🎫 Token: ${token.substring(0, 16)}...`);
    console.log(`⏰ Expires: ${expiresAt.toLocaleString()}`);
    console.log(`🔗 Registration URL:\n   ${registrationUrl}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📋 Instructions:');
    console.log('   1. Send the registration URL to the admin user');
    console.log('   2. User will provide their email and name during registration');
    console.log('   3. They must complete registration within 24 hours');
    console.log('   4. Registration requires a modern browser with passkey support');
    console.log('   5. The token can only be used once');
    
    // Show active token count
    const activeTokens = await dbManager.get(`
      SELECT COUNT(*) as count 
      FROM registration_tokens 
      WHERE expires_at > datetime('now') AND used = 0
    `);
    
    if (activeTokens.count > 1) {
      console.log(`\n⚠️  Note: ${activeTokens.count} active registration tokens exist`);
      console.log('   Use "npm run list-registration-tokens" to view all active tokens');
    }

  } catch (error) {
    console.error('❌ Error generating registration link:', error.message);
    process.exit(1);
  }
}

// Additional utility functions
async function listActiveTokens() {
  try {
    const dbPath = process.env.SQLITE_DB_PATH || './storage/conversation-summaries.db';
    const dbManager = new DatabaseManager(dbPath);
    await dbManager.waitForInitialization();

    const tokens = await dbManager.all(`
      SELECT token, email, expires_at, created_at
      FROM registration_tokens 
      WHERE expires_at > datetime('now') AND used = 0
      ORDER BY created_at DESC
    `);

    if (tokens.length === 0) {
      console.log('📭 No active registration tokens found');
      return;
    }

    console.log(`\n📋 Active Registration Tokens (${tokens.length}):`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    tokens.forEach((token, index) => {
      const expiresAt = new Date(token.expires_at);
      const createdAt = new Date(token.created_at);
      const timeLeft = Math.round((expiresAt - Date.now()) / (1000 * 60 * 60));
      
      console.log(`${index + 1}. Token: ${token.token.substring(0, 16)}...`);
      if (token.email) {
        console.log(`   Email: ${token.email}`);
      } else {
        console.log('   Email: (will be collected during registration)');
      }
      console.log(`   Created: ${createdAt.toLocaleString()}`);
      console.log(`   Expires: ${expiresAt.toLocaleString()} (${timeLeft}h remaining)`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error listing tokens:', error.message);
    process.exit(1);
  }
}

async function cleanupExpiredTokens() {
  try {
    const dbPath = process.env.SQLITE_DB_PATH || './storage/conversation-summaries.db';
    const dbManager = new DatabaseManager(dbPath);
    await dbManager.waitForInitialization();

    const result = await dbManager.run(`
      DELETE FROM registration_tokens 
      WHERE expires_at < datetime('now') OR used = 1
    `);

    console.log(`🧹 Cleaned up ${result.changes} expired/used registration tokens`);

  } catch (error) {
    console.error('❌ Error cleaning up tokens:', error.message);
    process.exit(1);
  }
}

// Handle different script invocations
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === '--list' || command === 'list') {
    listActiveTokens();
  } else if (command === '--cleanup' || command === 'cleanup') {
    cleanupExpiredTokens();
  } else {
    generateRegistrationLink();
  }
}

module.exports = {
  generateRegistrationLink,
  listActiveTokens,
  cleanupExpiredTokens
};