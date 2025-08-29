const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const DatabaseManager = require('./database-manager');
const crypto = require('crypto');

/**
 * WebAuthn Service for Passkey Authentication
 * 
 * Provides comprehensive WebAuthn/FIDO2 authentication for the compassionate AI
 * companion admin interface. Implements secure passkey registration and authentication
 * flows with proper challenge management and credential storage.
 * 
 * Features:
 * - Secure challenge generation and verification
 * - Credential storage and management
 * - Counter validation for replay protection
 * - Support for multiple credentials per user
 * - Proper error handling for healthcare data security
 */
class WebAuthnService {
  constructor() {
    this.rpName = 'Nanny';
    this.rpID = this._getRPID();
    this.origin = this._getOrigin();
    this.challenges = new Map(); // In-memory challenge storage
    
    // Challenge cleanup interval (5 minutes)
    setInterval(() => this._cleanupExpiredChallenges(), 5 * 60 * 1000);
  }

  /**
   * Generate WebAuthn registration options for token-based enrollment
   * @param {string} token - Registration token from CLI
   * @param {string} email - User's email address
   * @returns {Object} Registration options for WebAuthn API
   */
  async generateRegistrationOptions(token, email) {
    try {
      const dbManager = DatabaseManager.getInstance();
      await dbManager.waitForInitialization();

      // Validate registration token
      const tokenData = await dbManager.get(
        'SELECT expires_at, used FROM registration_tokens WHERE token = ?',
        [token]
      );

      if (!tokenData) {
        throw new Error('Invalid registration token');
      }

      if (tokenData.used) {
        throw new Error('Registration token has already been used');
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        throw new Error('Registration token has expired');
      }

      // Check if user already exists with this email
      const existingUser = await dbManager.get(
        'SELECT id FROM users WHERE email = ?',
        [email.toLowerCase().trim()]
      );

      if (existingUser) {
        throw new Error('User already exists with this email address');
      }

      // Update token record with email for this registration attempt
      await dbManager.run(
        'UPDATE registration_tokens SET email = ? WHERE token = ?',
        [email.toLowerCase().trim(), token]
      );

      // Get existing credentials to exclude from registration (should be none for new user)
      const existingCredentials = await dbManager.all(
        `SELECT credential_id FROM user_credentials 
         WHERE user_id IN (SELECT id FROM users WHERE email = ?)`,
        [email.toLowerCase().trim()]
      );

      const excludeCredentials = existingCredentials.map(cred => ({
        id: Buffer.from(cred.credential_id, 'base64'),
        type: 'public-key'
      }));

      const options = await generateRegistrationOptions({
        rpName: this.rpName,
        rpID: this.rpID,
        userID: crypto.randomBytes(32),
        userName: email.toLowerCase().trim(),
        userDisplayName: email.toLowerCase().trim(), // Use email as display name initially
        timeout: 60000,
        attestationType: 'none',
        excludeCredentials,
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
          authenticatorAttachment: 'platform'
        },
        supportedAlgorithmIDs: [-7, -257] // ES256, RS256
      });

      // Store challenge with expiration
      const challengeKey = `reg_${token}_${Date.now()}`;
      this.challenges.set(challengeKey, {
        challenge: options.challenge,
        token,
        email: email.toLowerCase().trim(),
        expires: Date.now() + (5 * 60 * 1000) // 5 minutes
      });

      return {
        ...options,
        challengeKey
      };
    } catch (error) {
      console.error('[WebAuthn] Registration options generation failed:', error);
      throw new Error(`Failed to generate registration options: ${error.message}`);
    }
  }

  /**
   * Verify WebAuthn registration response and create user account
   * @param {string} challengeKey - Challenge key from registration options
   * @param {Object} credential - WebAuthn credential response
   * @param {string} displayName - User's display name
   * @returns {Object} Registration result
   */
  async verifyRegistrationResponse(challengeKey, credential, displayName) {
    try {
      const challengeData = this.challenges.get(challengeKey);
      if (!challengeData) {
        throw new Error('Invalid or expired registration challenge');
      }

      if (Date.now() > challengeData.expires) {
        this.challenges.delete(challengeKey);
        throw new Error('Registration challenge has expired');
      }

      const verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: challengeData.challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        requireUserVerification: true
      });

      if (!verification.verified) {
        throw new Error('Registration verification failed');
      }

      // Extract credential data from the v13 structure
      const registeredCredential = verification.registrationInfo?.credential;
      if (!registeredCredential?.id) {
        throw new Error('Missing credential.id in verification result');
      }
      if (!registeredCredential?.publicKey) {
        throw new Error('Missing credential.publicKey in verification result');
      }

      const dbManager = DatabaseManager.getInstance();
      await dbManager.waitForInitialization();

      // Start transaction for user creation and token marking
      const db = dbManager.getConnection();
      const transaction = db.transaction(() => {
        // Create user (no username, email-based)
        const userResult = db.prepare(`
          INSERT INTO users (email, display_name, created_at, updated_at)
          VALUES (?, ?, datetime('now'), datetime('now'))
        `).run(challengeData.email, displayName || challengeData.email);

        // Store credential in user_credentials table
        const credentialResult = db.prepare(`
          INSERT INTO user_credentials (
            user_id, credential_id, public_key, counter, transports, created_at
          ) VALUES (?, ?, ?, ?, ?, datetime('now'))
        `).run(
          userResult.lastInsertRowid,
          registeredCredential.id, // Already base64 encoded from WebAuthn
          Buffer.from(Object.values(registeredCredential.publicKey)).toString('base64'), // Convert Uint8Array-like object to Buffer
          registeredCredential.counter,
          JSON.stringify(registeredCredential.transports || [])
        );

        // Mark registration token as used
        db.prepare(`
          UPDATE registration_tokens 
          SET used = 1 
          WHERE token = ?
        `).run(challengeData.token);

        return { userId: userResult.lastInsertRowid, credentialId: credentialResult.lastInsertRowid };
      });

      const result = transaction();
      this.challenges.delete(challengeKey);

      console.log(`[WebAuthn] User registered successfully: ${challengeData.email} (ID: ${result.userId})`);
      
      return {
        verified: true,
        userId: result.userId,
        credentialId: result.credentialId,
        email: challengeData.email
      };
    } catch (error) {
      console.error('[WebAuthn] Registration verification failed:', error);
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Generate WebAuthn authentication options for user login
   * @param {string} email - Email address attempting to authenticate (optional for discoverable credentials)
   * @returns {Object} Authentication options for WebAuthn API
   */
  async generateAuthenticationOptions(email = null) {
    try {
      const dbManager = DatabaseManager.getInstance();
      await dbManager.waitForInitialization();

      let allowCredentials = [];
      
      if (email) {
        // Get user's credentials for targeted authentication
        const userCredentials = await dbManager.all(`
          SELECT uc.credential_id 
          FROM user_credentials uc
          JOIN users u ON uc.user_id = u.id
          WHERE u.email = ? AND u.is_active = 1
        `, [email]);

        allowCredentials = userCredentials.map(cred => ({
          id: cred.credential_id, // Already base64url-encoded from WebAuthn
          type: 'public-key',
          transports: ['internal', 'hybrid']
        }));

        if (allowCredentials.length === 0) {
          throw new Error('No credentials found for user');
        }
      }

      const options = await generateAuthenticationOptions({
        rpID: this.rpID,
        timeout: 60000,
        allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
        userVerification: 'preferred'
      });

      // Store challenge with expiration
      const challengeKey = `auth_${email || 'any'}_${Date.now()}`;
      this.challenges.set(challengeKey, {
        challenge: options.challenge,
        email,
        expires: Date.now() + (5 * 60 * 1000) // 5 minutes
      });

      return {
        ...options,
        challengeKey
      };
    } catch (error) {
      console.error('[WebAuthn] Authentication options generation failed:', error);
      throw new Error('Failed to generate authentication options');
    }
  }

  /**
   * Verify WebAuthn authentication response and validate login
   * @param {string} challengeKey - Challenge key from authentication options
   * @param {Object} credential - WebAuthn credential response
   * @returns {Object} Authentication result with user information
   */
  async verifyAuthenticationResponse(challengeKey, credential) {
    try {
      const challengeData = this.challenges.get(challengeKey);
      if (!challengeData) {
        throw new Error('Invalid or expired authentication challenge');
      }

      if (Date.now() > challengeData.expires) {
        this.challenges.delete(challengeKey);
        throw new Error('Authentication challenge has expired');
      }

      const dbManager = DatabaseManager.getInstance();
      await dbManager.waitForInitialization();

      // Find the credential in database
      
      // Try direct lookup first (in case it's already in the right format)
      let storedCredential = await dbManager.get(`
        SELECT uc.*, u.id as user_id, u.email, u.display_name, u.is_active
        FROM user_credentials uc
        JOIN users u ON uc.user_id = u.id
        WHERE uc.credential_id = ? AND u.is_active = 1
      `, [credential.id]);
      
      // If not found, try base64 conversion
      if (!storedCredential) {
        const credentialId = Buffer.from(credential.id, 'base64url').toString('base64');
        storedCredential = await dbManager.get(`
          SELECT uc.*, u.id as user_id, u.email, u.display_name, u.is_active
          FROM user_credentials uc
          JOIN users u ON uc.user_id = u.id
          WHERE uc.credential_id = ? AND u.is_active = 1
        `, [credentialId]);
      }

      if (!storedCredential) {
        throw new Error('Credential not found or user inactive');
      }


      // If email was specified in challenge, verify it matches
      if (challengeData.email && challengeData.email !== storedCredential.email) {
        throw new Error('Credential does not belong to specified user');
      }

      // Build credential object with debug logging (SimpleWebAuthn v12 expects specific property names)
      const storedTransports = storedCredential.transports ? JSON.parse(storedCredential.transports) : ['internal', 'hybrid'];
      const authenticatorCredential = {
        id: Buffer.from(storedCredential.credential_id, 'base64url'), // Credential ID is stored as base64url
        publicKey: Buffer.from(storedCredential.public_key, 'base64'), // SimpleWebAuthn expects 'publicKey', not 'credentialPublicKey'
        counter: storedCredential.counter,
        transports: storedTransports
      };
      

      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response: credential,
          expectedChallenge: challengeData.challenge,
          expectedOrigin: this.origin,
          expectedRPID: this.rpID,
          credential: authenticatorCredential,
          requireUserVerification: true
        });
      } catch (verifyError) {
        console.error('[WebAuthn] Authentication verification failed:', verifyError.message);
        throw verifyError;
      }

      if (!verification.verified) {
        throw new Error('Authentication verification failed');
      }

      // Update credential counter and last used timestamp
      await dbManager.run(`
        UPDATE user_credentials 
        SET counter = ?, last_used_at = datetime('now')
        WHERE id = ?
      `, [verification.authenticationInfo.newCounter, storedCredential.id]);

      this.challenges.delete(challengeKey);

      console.log(`[WebAuthn] User authenticated successfully: ${storedCredential.email} (ID: ${storedCredential.user_id})`);

      return {
        verified: true,
        user: {
          id: storedCredential.user_id,
          email: storedCredential.email,
          displayName: storedCredential.display_name
        }
      };
    } catch (error) {
      console.error('[WebAuthn] Authentication verification failed:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Check if any users exist in the system
   * @returns {boolean} True if users exist, false if setup needed
   */
  async hasUsers() {
    try {
      const dbManager = DatabaseManager.getInstance();
      await dbManager.waitForInitialization();
      
      const result = await dbManager.get('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
      return result.count > 0;
    } catch (error) {
      console.error('[WebAuthn] Error checking for users:', error);
      return false;
    }
  }

  /**
   * Get user credentials for management
   * @param {number} userId - User ID
   * @returns {Array} List of user's credentials
   */
  async getUserCredentials(userId) {
    try {
      const dbManager = DatabaseManager.getInstance();
      await dbManager.waitForInitialization();
      
      return await dbManager.all(`
        SELECT id, created_at, last_used_at
        FROM user_credentials
        WHERE user_id = ?
        ORDER BY created_at DESC
      `, [userId]);
    } catch (error) {
      console.error('[WebAuthn] Error fetching user credentials:', error);
      return [];
    }
  }

  /**
   * Remove expired credentials and cleanup
   * @param {number} maxAgeHours - Maximum age in hours for unused credentials
   */
  async cleanupOldCredentials(maxAgeHours = 8760) { // 1 year default
    try {
      const dbManager = DatabaseManager.getInstance();
      await dbManager.waitForInitialization();
      
      const result = await dbManager.run(`
        DELETE FROM user_credentials
        WHERE last_used_at IS NULL 
        AND datetime(created_at, '+${maxAgeHours} hours') < datetime('now')
      `);

      if (result.changes > 0) {
        console.log(`[WebAuthn] Cleaned up ${result.changes} old unused credentials`);
      }
    } catch (error) {
      console.error('[WebAuthn] Error cleaning up credentials:', error);
    }
  }

  /**
   * Get relying party ID from environment or server configuration
   * @private
   */
  _getRPID() {
    if (process.env.SERVER) {
      return process.env.SERVER.replace(/^https?:\/\//, '');
    }
    return 'localhost';
  }

  /**
   * Get origin URL from environment or default
   * @private
   */
  _getOrigin() {
    if (process.env.SERVER) {
      return `https://${process.env.SERVER}`;
    }
    return 'http://localhost:3000';
  }

  /**
   * Clean up expired challenges from memory
   * @private
   */
  _cleanupExpiredChallenges() {
    const now = Date.now();
    for (const [key, data] of this.challenges.entries()) {
      if (now > data.expires) {
        this.challenges.delete(key);
      }
    }
  }
}

module.exports = WebAuthnService;