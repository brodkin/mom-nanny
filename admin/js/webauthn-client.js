/**
 * WebAuthn Client for Passkey Authentication
 * 
 * Provides client-side WebAuthn/FIDO2 functionality for the compassionate AI
 * companion admin interface. Implements secure passkey registration and authentication
 * flows with comprehensive error handling and browser compatibility.
 * 
 * Features:
 * - Browser compatibility detection
 * - Secure passkey registration and authentication
 * - Comprehensive error handling with user-friendly messages
 * - Integration with @simplewebauthn/browser
 */

// Import SimpleWebAuthn browser library
// Note: This will be loaded from CDN in the HTML pages
/* global SimpleWebAuthnBrowser */
const { startRegistration, startAuthentication } = SimpleWebAuthnBrowser;

/**
 * WebAuthn Client Class
 */
class WebAuthnClient {
  constructor() {
    this.isSupported = this.checkBrowserSupport();
  }

  /**
   * Check if WebAuthn is supported in the current browser
   * @returns {boolean} True if WebAuthn is supported
   */
  checkBrowserSupport() {
    return !!(window.PublicKeyCredential && window.navigator.credentials && window.navigator.credentials.create);
  }

  /**
   * Register a new passkey using a token
   * @param {string} token - Registration token
   * @param {string} email - Email address
   * @param {string} displayName - Display name
   * @returns {Promise<Object>} Registration result
   */
  async registerPasskey(token, email, displayName) {
    try {
      if (!this.isSupported) {
        throw new Error('WebAuthn is not supported in this browser. Please use a modern browser like Chrome, Safari, or Firefox.');
      }

      // Validate inputs
      if (!token || !email || !displayName) {
        throw new Error('Registration token, email, and display name are required');
      }

      // Step 1: Get registration options from server
      console.log('[WebAuthn Client] Starting passkey registration...');
      const beginResponse = await fetch('/api/auth/register/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, displayName })
      });

      const beginResult = await beginResponse.json();
      if (!beginResult.success) {
        throw new Error(beginResult.error || 'Failed to start registration');
      }

      // Step 2: Create credential with WebAuthn
      console.log('[WebAuthn Client] Creating passkey credential...');
      const credential = await startRegistration({ optionsJSON: beginResult.options });
      
      if (!credential) {
        throw new Error('Passkey creation was cancelled or failed');
      }

      // Step 3: Send credential to server for verification
      console.log('[WebAuthn Client] Verifying passkey credential...');
      const verifyResponse = await fetch('/api/auth/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeKey: beginResult.options.challengeKey,
          credential,
          displayName
        })
      });

      const verifyResult = await verifyResponse.json();
      if (!verifyResult.success) {
        throw new Error(verifyResult.error || 'Registration verification failed');
      }

      console.log('[WebAuthn Client] Passkey registration successful!');
      return verifyResult;

    } catch (error) {
      console.error('[WebAuthn Client] Registration error:', error);
      throw this.handleWebAuthnError(error);
    }
  }

  /**
   * Authenticate with an existing passkey
   * @param {string} email - Email address (optional for discoverable credentials)
   * @returns {Promise<Object>} Authentication result
   */
  async authenticatePasskey(email = null) {
    try {
      if (!this.isSupported) {
        throw new Error('WebAuthn is not supported in this browser. Please use a modern browser like Chrome, Safari, or Firefox.');
      }

      // Step 1: Get authentication options from server
      console.log('[WebAuthn Client] Starting passkey authentication...');
      const beginResponse = await fetch('/api/auth/login/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const beginResult = await beginResponse.json();
      if (!beginResult.success) {
        throw new Error(beginResult.error || 'Failed to start authentication');
      }

      // Step 2: Get assertion with WebAuthn
      console.log('[WebAuthn Client] Getting passkey assertion...');
      const credential = await startAuthentication({ optionsJSON: beginResult.options });
      
      if (!credential) {
        throw new Error('Passkey authentication was cancelled or failed');
      }

      // Step 3: Send assertion to server for verification
      console.log('[WebAuthn Client] Verifying passkey assertion...');
      const verifyResponse = await fetch('/api/auth/login/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeKey: beginResult.options.challengeKey,
          credential
        })
      });

      const verifyResult = await verifyResponse.json();
      if (!verifyResult.success) {
        throw new Error(verifyResult.error || 'Authentication verification failed');
      }

      console.log('[WebAuthn Client] Passkey authentication successful!');
      return verifyResult;

    } catch (error) {
      console.error('[WebAuthn Client] Authentication error:', error);
      throw this.handleWebAuthnError(error);
    }
  }

  /**
   * Log out the current user
   * @returns {Promise<Object>} Logout result
   */
  async logout() {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Logout failed');
      }

      return result;

    } catch (error) {
      console.error('[WebAuthn Client] Logout error:', error);
      throw error;
    }
  }

  /**
   * Check authentication status
   * @returns {Promise<Object>} Status information
   */
  async checkStatus() {
    try {
      const response = await fetch('/api/auth/status');
      return await response.json();
    } catch (error) {
      console.error('[WebAuthn Client] Status check error:', error);
      return { 
        authenticated: false, 
        setupRequired: true, 
        error: error.message 
      };
    }
  }

  /**
   * Check setup status (whether admin users exist)
   * @returns {Promise<Object>} Setup status
   */
  async checkSetupStatus() {
    try {
      const response = await fetch('/api/auth/setup/status');
      return await response.json();
    } catch (error) {
      console.error('[WebAuthn Client] Setup status error:', error);
      return { 
        setupComplete: false, 
        setupRequired: true, 
        error: error.message 
      };
    }
  }

  /**
   * Handle WebAuthn-specific errors and convert to user-friendly messages
   * @param {Error} error - Original error
   * @returns {Error} User-friendly error
   */
  handleWebAuthnError(error) {
    const message = error.message || error.toString();

    // WebAuthn-specific error handling
    if (message.includes('NotSupportedError')) {
      return new Error('Your device does not support passkeys. Please try a different device or browser.');
    }
    
    if (message.includes('NotAllowedError')) {
      return new Error('Passkey operation was cancelled or not allowed. Please try again.');
    }
    
    if (message.includes('AbortError')) {
      return new Error('Passkey operation was cancelled. Please try again.');
    }
    
    if (message.includes('SecurityError')) {
      return new Error('Security error occurred. Please ensure you are on a secure connection (HTTPS).');
    }
    
    if (message.includes('InvalidStateError')) {
      return new Error('A passkey for this account may already exist on this device.');
    }
    
    if (message.includes('ConstraintError')) {
      return new Error('Passkey requirements could not be satisfied. Please try a different authenticator.');
    }
    
    if (message.includes('NetworkError')) {
      return new Error('Network error occurred. Please check your connection and try again.');
    }

    // Server-side error handling
    if (message.includes('expired')) {
      return new Error('Request expired. Please try again.');
    }
    
    if (message.includes('already exists')) {
      return new Error('A user with this email address already exists.');
    }
    
    if (message.includes('not found')) {
      return new Error('User not found or no passkey available for authentication.');
    }

    // Generic error handling
    if (message.includes('rate limit') || message.includes('too many')) {
      return new Error('Too many attempts. Please wait a few minutes and try again.');
    }

    // Return original error if no specific handling
    return error;
  }

  /**
   * Display browser compatibility information
   * @returns {Object} Compatibility information
   */
  getBrowserCompatibility() {
    const userAgent = navigator.userAgent;
    const isChrome = /Chrome/.test(userAgent);
    const isFirefox = /Firefox/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    const isEdge = /Edg/.test(userAgent);

    return {
      isSupported: this.isSupported,
      browser: isChrome ? 'Chrome' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : isEdge ? 'Edge' : 'Unknown',
      hasWebAuthn: !!window.PublicKeyCredential,
      hasCredentialsAPI: !!window.navigator.credentials,
      hasCreateMethod: !!(window.navigator.credentials && window.navigator.credentials.create),
      recommendedAction: this.isSupported ? 'Your browser supports passkeys!' : 'Please update to a modern browser for passkey support.'
    };
  }
}

// Create global instance
window.webauthnClient = new WebAuthnClient();

// Utility functions for common UI patterns
window.WebAuthnUI = {
  /**
   * Show loading state for buttons
   */
  showLoading(button, loadingText = 'Please wait...') {
    if (!button) return;
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.classList.add('loading');
  },

  /**
   * Hide loading state for buttons
   */
  hideLoading(button) {
    if (!button) return;
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
    button.classList.remove('loading');
  },

  /**
   * Show error message in UI
   */
  showError(message, container = null) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message alert alert-danger';
    errorDiv.textContent = message;
    
    if (container) {
      // Clear existing errors
      container.querySelectorAll('.error-message').forEach(el => el.remove());
      container.appendChild(errorDiv);
    } else {
      // Show in default location
      const defaultContainer = document.querySelector('.auth-container') || document.body;
      defaultContainer.appendChild(errorDiv);
    }
    
    // Auto-remove after 10 seconds
    setTimeout(() => errorDiv.remove(), 10000);
  },

  /**
   * Show success message in UI
   */
  showSuccess(message, container = null) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message alert alert-success';
    successDiv.textContent = message;
    
    if (container) {
      container.appendChild(successDiv);
    } else {
      const defaultContainer = document.querySelector('.auth-container') || document.body;
      defaultContainer.appendChild(successDiv);
    }
    
    // Auto-remove after 5 seconds
    setTimeout(() => successDiv.remove(), 5000);
  }
};