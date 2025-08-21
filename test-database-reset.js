#!/usr/bin/env node

/**
 * Database Reset and Migration Test Script
 * 
 * Comprehensive validation of database schema creation, migration processes,
 * and idempotency. Tests the complete database lifecycle from initial creation
 * through all migration versions.
 * 
 * Test Scenarios:
 * 1. Fresh database creation with all migrations (versions 1-4)
 * 2. Applying migrations to empty database
 * 3. Re-running migrations for idempotency validation
 * 4. Schema verification against expected structure
 * 5. Comparison with database-schema-backup.sql
 * 
 * Usage: node test-database-reset.js
 * Exit Codes: 0 = success, 1 = failure
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const DatabaseManager = require('./services/database-manager');

// Test configuration
const TEST_CONFIG = {
    BACKUP_SUFFIX: '.bak',
    TEST_DB_DIR: './test-databases',
    SCHEMA_BACKUP_FILE: './database-schema-backup.sql',
    PRODUCTION_DB_PATH: './storage/conversation-summaries.db'
};

// Expected schema structure
const EXPECTED_SCHEMA = {
    tables: [
        'conversations',
        'summaries', 
        'messages',
        'analytics',
        'memories',
        'settings'
    ],
    indexes: [
        // Initial schema indexes (Migration 1)
        'idx_conversations_call_sid',
        'idx_conversations_start_time', 
        'idx_summaries_conversation_id',
        'idx_messages_conversation_id',
        'idx_messages_timestamp',
        'idx_analytics_conversation_id',
        // Memories migration indexes (Migration 2)
        'idx_memories_key',
        'idx_memories_category',
        'idx_memories_updated',
        // Settings migration indexes (Migration 3)
        'idx_settings_key',
        'idx_settings_updated',
        // Performance migration indexes (Migration 4)
        'idx_conversations_created_at',
        'idx_summaries_created_at',
        'idx_analytics_created_at',
        'idx_messages_role_timestamp',
        'idx_memories_category_updated'
    ],
    // Automatic indexes created by SQLite for UNIQUE constraints
    autoIndexes: [
        'sqlite_autoindex_conversations_1',  // call_sid UNIQUE
        'sqlite_autoindex_memories_1',       // memory_key UNIQUE
        'sqlite_autoindex_migrations_1',     // version UNIQUE
        'sqlite_autoindex_settings_1'        // key UNIQUE
    ]
};

class DatabaseTester {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            errors: []
        };
        this.testDbPaths = [];
    }

    async runAllTests() {
        console.log('🧪 Starting Database Reset and Migration Test Suite');
        console.log('=' .repeat(60));

        try {
            // Setup test environment
            await this.setupTestEnvironment();
            
            // Test 1: Fresh database with all migrations
            await this.testFreshDatabaseCreation();
            
            // Test 2: Empty database migration application
            await this.testEmptyDatabaseMigrations();
            
            // Test 3: Idempotency validation
            await this.testMigrationIdempotency();
            
            // Test 4: Schema verification
            await this.testSchemaVerification();
            
            // Test 5: Backup comparison
            await this.testBackupComparison();
            
            // Cleanup and results
            await this.cleanup();
            this.printResults();
            
            return this.testResults.failed === 0;
            
        } catch (error) {
            console.error('❌ Fatal test error:', error);
            this.testResults.errors.push(`Fatal error: ${error.message}`);
            await this.cleanup();
            return false;
        }
    }

    async setupTestEnvironment() {
        console.log('\n🔧 Setting up test environment...');
        
        // Create test directories
        if (!fs.existsSync(TEST_CONFIG.TEST_DB_DIR)) {
            fs.mkdirSync(TEST_CONFIG.TEST_DB_DIR, { recursive: true });
        }

        // Backup existing production database if it exists
        if (fs.existsSync(TEST_CONFIG.PRODUCTION_DB_PATH)) {
            const backupPath = TEST_CONFIG.PRODUCTION_DB_PATH + TEST_CONFIG.BACKUP_SUFFIX;
            console.log(`📦 Backing up production database to ${backupPath}`);
            fs.copyFileSync(TEST_CONFIG.PRODUCTION_DB_PATH, backupPath);
        }

        // Reset DatabaseManager singleton for clean testing
        DatabaseManager.resetInstance();
        
        console.log('✅ Test environment ready');
    }

    async testFreshDatabaseCreation() {
        console.log('\n🆕 Test 1: Fresh Database Creation with All Migrations');
        
        try {
            const testDbPath = path.join(TEST_CONFIG.TEST_DB_DIR, 'fresh-creation.db');
            this.testDbPaths.push(testDbPath);
            
            // Ensure clean start
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
            
            // Create database manager instance
            const dbManager = new DatabaseManager(testDbPath);
            await dbManager.waitForInitialization();
            
            // Verify all tables exist
            const tables = await dbManager.getTables();
            const missingTables = EXPECTED_SCHEMA.tables.filter(table => !tables.includes(table));
            
            if (missingTables.length > 0) {
                throw new Error(`Missing tables: ${missingTables.join(', ')}`);
            }
            
            // Verify migration version
            const version = dbManager.getCurrentMigrationVersion();
            if (version !== 4) {
                throw new Error(`Expected migration version 4, got ${version}`);
            }
            
            // Test schema verification method
            const schemaResult = await dbManager.verifySchema();
            if (!schemaResult.isValid) {
                throw new Error(`Schema verification failed: missing tables [${schemaResult.missingTables.join(', ')}], missing indexes [${schemaResult.missingIndexes.join(', ')}]`);
            }
            
            await dbManager.close();
            this.pass('Fresh database creation with all migrations');
            
        } catch (error) {
            this.fail('Fresh database creation', error);
        }
    }

    async testEmptyDatabaseMigrations() {
        console.log('\n📤 Test 2: Applying Migrations to Empty Database');
        
        try {
            const testDbPath = path.join(TEST_CONFIG.TEST_DB_DIR, 'empty-migrations.db');
            this.testDbPaths.push(testDbPath);
            
            // Create empty SQLite database
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
            
            const emptyDb = new Database(testDbPath);
            emptyDb.close();
            
            // Apply migrations via DatabaseManager
            const dbManager = new DatabaseManager(testDbPath);
            await dbManager.waitForInitialization();
            
            // Verify each migration was applied
            const migrations = await dbManager.all('SELECT version FROM migrations ORDER BY version');
            const expectedVersions = [1, 2, 3, 4];
            const actualVersions = migrations.map(m => m.version);
            
            if (!this.arraysEqual(expectedVersions, actualVersions)) {
                throw new Error(`Migration versions mismatch. Expected: [${expectedVersions.join(', ')}], Got: [${actualVersions.join(', ')}]`);
            }
            
            await dbManager.close();
            this.pass('Empty database migration application');
            
        } catch (error) {
            this.fail('Empty database migrations', error);
        }
    }

    async testMigrationIdempotency() {
        console.log('\n🔄 Test 3: Migration Idempotency (Safe Re-running)');
        
        try {
            const testDbPath = path.join(TEST_CONFIG.TEST_DB_DIR, 'idempotency-test.db');
            this.testDbPaths.push(testDbPath);
            
            // Create database with all migrations
            if (fs.existsExists(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
            
            let dbManager = new DatabaseManager(testDbPath);
            await dbManager.waitForInitialization();
            
            // Get initial state
            const initialTables = await dbManager.getTables();
            const initialVersion = dbManager.getCurrentMigrationVersion();
            const initialIndexes = await this.getIndexes(dbManager);
            
            await dbManager.close();
            
            // Create new instance and re-run initialization (should be idempotent)
            dbManager = new DatabaseManager(testDbPath);
            await dbManager.waitForInitialization();
            
            // Verify state unchanged
            const finalTables = await dbManager.getTables();
            const finalVersion = dbManager.getCurrentMigrationVersion();
            const finalIndexes = await this.getIndexes(dbManager);
            
            if (!this.arraysEqual(initialTables.sort(), finalTables.sort())) {
                throw new Error('Tables changed after re-running migrations');
            }
            
            if (initialVersion !== finalVersion) {
                throw new Error(`Migration version changed: ${initialVersion} → ${finalVersion}`);
            }
            
            if (!this.arraysEqual(initialIndexes.sort(), finalIndexes.sort())) {
                throw new Error('Indexes changed after re-running migrations');
            }
            
            await dbManager.close();
            this.pass('Migration idempotency validation');
            
        } catch (error) {
            this.fail('Migration idempotency', error);
        }
    }

    async testSchemaVerification() {
        console.log('\n✅ Test 4: Schema Verification Method');
        
        try {
            const testDbPath = path.join(TEST_CONFIG.TEST_DB_DIR, 'schema-verification.db');
            this.testDbPaths.push(testDbPath);
            
            // Create complete database
            const dbManager = new DatabaseManager(testDbPath);
            await dbManager.waitForInitialization();
            
            // Test complete schema
            const completeResult = await dbManager.verifySchema();
            if (!completeResult.isValid) {
                throw new Error(`Complete schema invalid: missing tables [${completeResult.missingTables.join(', ')}], missing indexes [${completeResult.missingIndexes.join(', ')}]`);
            }
            
            // Manually drop an index and test detection
            await dbManager.exec('DROP INDEX IF EXISTS idx_conversations_created_at');
            const partialResult = await dbManager.verifySchema();
            
            if (partialResult.isValid) {
                throw new Error('Schema validation should have detected missing index');
            }
            
            if (!partialResult.missingIndexes.includes('idx_conversations_created_at')) {
                throw new Error('Schema validation did not detect the correct missing index');
            }
            
            await dbManager.close();
            this.pass('Schema verification method');
            
        } catch (error) {
            this.fail('Schema verification', error);
        }
    }

    async testBackupComparison() {
        console.log('\n📊 Test 5: Backup Schema Comparison');
        
        try {
            const testDbPath = path.join(TEST_CONFIG.TEST_DB_DIR, 'backup-comparison.db');
            this.testDbPaths.push(testDbPath);
            
            // Create database using backup schema
            if (!fs.existsSync(TEST_CONFIG.SCHEMA_BACKUP_FILE)) {
                console.warn('⚠️  Schema backup file not found, skipping comparison');
                return;
            }
            
            const backupContent = fs.readFileSync(TEST_CONFIG.SCHEMA_BACKUP_FILE, 'utf8');
            
            // Create database from backup
            const backupDb = new Database(testDbPath);
            backupDb.exec(backupContent);
            backupDb.close();
            
            // Create database via migrations
            const migratedDbPath = path.join(TEST_CONFIG.TEST_DB_DIR, 'migrated-comparison.db');
            this.testDbPaths.push(migratedDbPath);
            
            const dbManager = new DatabaseManager(migratedDbPath);
            await dbManager.waitForInitialization();
            await dbManager.close();
            
            // Compare schemas
            const backupTables = this.getTablesFromDb(testDbPath);
            const migratedTables = this.getTablesFromDb(migratedDbPath);
            
            const backupIndexes = this.getIndexesFromDb(testDbPath);
            const migratedIndexes = this.getIndexesFromDb(migratedDbPath);
            
            // Compare tables
            if (!this.arraysEqual(backupTables.sort(), migratedTables.sort())) {
                throw new Error(`Table mismatch. Backup: [${backupTables.join(', ')}], Migrated: [${migratedTables.join(', ')}]`);
            }
            
            // Compare explicit indexes (filter out auto indexes which may vary)
            const backupExplicitIndexes = backupIndexes.filter(idx => !idx.startsWith('sqlite_autoindex_'));
            const migratedExplicitIndexes = migratedIndexes.filter(idx => !idx.startsWith('sqlite_autoindex_'));
            
            if (!this.arraysEqual(backupExplicitIndexes.sort(), migratedExplicitIndexes.sort())) {
                console.log('Backup indexes:', backupExplicitIndexes);
                console.log('Migrated indexes:', migratedExplicitIndexes);
                throw new Error(`Index mismatch detected`);
            }
            
            this.pass('Backup schema comparison');
            
        } catch (error) {
            this.fail('Backup schema comparison', error);
        }
    }

    async getIndexes(dbManager) {
        const result = await dbManager.all(`
            SELECT name FROM sqlite_master 
            WHERE type='index' AND sql NOT NULL
            ORDER BY name
        `);
        return result.map(row => row.name);
    }

    getTablesFromDb(dbPath) {
        const db = new Database(dbPath);
        const result = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'
            ORDER BY name
        `).all();
        db.close();
        return result.map(row => row.name);
    }

    getIndexesFromDb(dbPath) {
        const db = new Database(dbPath);
        const result = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='index' AND sql NOT NULL
            ORDER BY name
        `).all();
        db.close();
        return result.map(row => row.name);
    }

    arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        return arr1.every((val, index) => val === arr2[index]);
    }

    pass(testName) {
        console.log(`✅ PASS: ${testName}`);
        this.testResults.passed++;
    }

    fail(testName, error) {
        console.log(`❌ FAIL: ${testName}`);
        console.log(`   Error: ${error.message}`);
        this.testResults.failed++;
        this.testResults.errors.push(`${testName}: ${error.message}`);
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test databases...');
        
        // Close any remaining connections
        DatabaseManager.resetInstance();
        
        // Remove test database files
        for (const dbPath of this.testDbPaths) {
            try {
                if (fs.existsSync(dbPath)) {
                    fs.unlinkSync(dbPath);
                }
                // Clean up WAL and SHM files
                const walPath = dbPath + '-wal';
                const shmPath = dbPath + '-shm';
                if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
                if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
            } catch (error) {
                console.warn(`⚠️  Could not remove ${dbPath}: ${error.message}`);
            }
        }
        
        // Remove test directory if empty
        try {
            const files = fs.readdirSync(TEST_CONFIG.TEST_DB_DIR);
            if (files.length === 0) {
                fs.rmdirSync(TEST_CONFIG.TEST_DB_DIR);
            }
        } catch (error) {
            // Directory may not exist or may not be empty, which is fine
        }
        
        console.log('✅ Cleanup completed');
    }

    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST RESULTS SUMMARY');
        console.log('='.repeat(60));
        
        console.log(`✅ Tests Passed: ${this.testResults.passed}`);
        console.log(`❌ Tests Failed: ${this.testResults.failed}`);
        console.log(`📊 Total Tests: ${this.testResults.passed + this.testResults.failed}`);
        
        if (this.testResults.errors.length > 0) {
            console.log('\n🔍 Error Details:');
            this.testResults.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }
        
        const success = this.testResults.failed === 0;
        console.log('\n' + '='.repeat(60));
        console.log(success ? 
            '🎉 ALL TESTS PASSED - Database reset and migration system is working correctly!' :
            '💥 SOME TESTS FAILED - Review errors above and fix issues before deploying!'
        );
        console.log('='.repeat(60));
        
        // Expected counts verification
        console.log('\n📋 Schema Verification:');
        console.log(`   Expected Tables: ${EXPECTED_SCHEMA.tables.length} (${EXPECTED_SCHEMA.tables.join(', ')})`);
        console.log(`   Expected Explicit Indexes: ${EXPECTED_SCHEMA.indexes.length}`);
        console.log(`   Expected Auto Indexes: ${EXPECTED_SCHEMA.autoIndexes.length} (from UNIQUE constraints)`);
        console.log(`   Total Expected Indexes: ${EXPECTED_SCHEMA.indexes.length + EXPECTED_SCHEMA.autoIndexes.length} (16 explicit + 4 automatic)`);
    }
}

// Fix typo in testMigrationIdempotency
DatabaseTester.prototype.testMigrationIdempotency = async function() {
    console.log('\n🔄 Test 3: Migration Idempotency (Safe Re-running)');
    
    try {
        const testDbPath = path.join(TEST_CONFIG.TEST_DB_DIR, 'idempotency-test.db');
        this.testDbPaths.push(testDbPath);
        
        // Create database with all migrations
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
        
        let dbManager = new DatabaseManager(testDbPath);
        await dbManager.waitForInitialization();
        
        // Get initial state
        const initialTables = await dbManager.getTables();
        const initialVersion = dbManager.getCurrentMigrationVersion();
        const initialIndexes = await this.getIndexes(dbManager);
        
        await dbManager.close();
        
        // Create new instance and re-run initialization (should be idempotent)
        dbManager = new DatabaseManager(testDbPath);
        await dbManager.waitForInitialization();
        
        // Verify state unchanged
        const finalTables = await dbManager.getTables();
        const finalVersion = dbManager.getCurrentMigrationVersion();
        const finalIndexes = await this.getIndexes(dbManager);
        
        if (!this.arraysEqual(initialTables.sort(), finalTables.sort())) {
            throw new Error('Tables changed after re-running migrations');
        }
        
        if (initialVersion !== finalVersion) {
            throw new Error(`Migration version changed: ${initialVersion} → ${finalVersion}`);
        }
        
        if (!this.arraysEqual(initialIndexes.sort(), finalIndexes.sort())) {
            throw new Error('Indexes changed after re-running migrations');
        }
        
        await dbManager.close();
        this.pass('Migration idempotency validation');
        
    } catch (error) {
        this.fail('Migration idempotency', error);
    }
};

// Main execution
async function main() {
    const tester = new DatabaseTester();
    const success = await tester.runAllTests();
    
    // Exit with appropriate code
    process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        console.error('💥 Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = DatabaseTester;