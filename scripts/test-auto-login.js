#!/usr/bin/env node

/**
 * Integration Test Script for Development Auto-Login Feature
 * 
 * Tests both development and production modes with real HTTP requests
 * to verify that the auto-login functionality works correctly and
 * production mode properly blocks unauthorized access.
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

// Test configuration
const TEST_PORT = 3001; // Different from default to avoid conflicts
const BASE_URL = `http://localhost:${TEST_PORT}`;
const APP_PATH = path.join(__dirname, '..', 'app.js');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Make HTTP request with timeout and redirect handling
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || 5000;
    const followRedirects = options.followRedirects !== false;
    
    const request = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = {
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          redirectLocation: res.headers.location
        };
        
        // Follow redirects if requested and redirect status
        if (followRedirects && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const redirectUrl = res.headers.location.startsWith('http') 
            ? res.headers.location 
            : `${BASE_URL}${res.headers.location}`;
          log('cyan', `Following redirect to: ${redirectUrl}`);
          
          makeRequest(redirectUrl, { ...options, followRedirects: false })
            .then(redirectResult => {
              result.finalStatusCode = redirectResult.statusCode;
              result.finalData = redirectResult.data;
              resolve(result);
            })
            .catch(reject);
        } else {
          resolve(result);
        }
      });
    });

    request.on('error', reject);
    request.setTimeout(timeout, () => {
      request.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });
  });
}

/**
 * Start server with specific environment
 */
function startServer(env) {
  return new Promise((resolve, reject) => {
    log('cyan', `Starting server in ${env} mode...`);
    
    const serverEnv = {
      ...process.env,
      NODE_ENV: env,
      PORT: TEST_PORT,
      SQLITE_DB_PATH: ':memory:' // Use in-memory DB for testing
    };
    
    const server = spawn('node', [APP_PATH], {
      env: serverEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let serverReady = false;
    let output = '';

    server.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      
      if (text.includes(`Server running on port ${TEST_PORT}`) && !serverReady) {
        serverReady = true;
        log('green', `✅ Server started successfully in ${env} mode`);
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.error('Server error:', text);
    });

    server.on('error', (error) => {
      reject(new Error(`Failed to start server: ${error.message}`));
    });

    server.on('exit', (code) => {
      if (!serverReady) {
        reject(new Error(`Server exited with code ${code}. Output: ${output}`));
      }
    });

    // Timeout for server startup
    setTimeout(() => {
      if (!serverReady) {
        server.kill();
        reject(new Error(`Server startup timeout. Output: ${output}`));
      }
    }, 10000);
  });
}

/**
 * Stop server gracefully
 */
function stopServer(server) {
  return new Promise((resolve) => {
    if (server && !server.killed) {
      server.kill('SIGTERM');
      server.on('exit', () => {
        log('cyan', 'Server stopped');
        resolve();
      });
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!server.killed) {
          server.kill('SIGKILL');
        }
        resolve();
      }, 5000);
    } else {
      resolve();
    }
  });
}

/**
 * Test development mode auto-login
 */
async function testDevelopmentMode() {
  log('yellow', '\n=== Testing Development Mode Auto-Login ===');
  
  const server = await startServer('development');
  
  try {
    // Wait a moment for server to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test admin dashboard access (should auto-login or redirect to setup)
    log('cyan', 'Testing admin dashboard access...');
    const response = await makeRequest(`${BASE_URL}/admin/dashboard`);
    
    if (response.statusCode === 200) {
      log('green', '✅ Auto-login successful - dashboard loaded directly');
      return { success: true, type: 'auto-login' };
    } else if (response.statusCode === 302 && response.redirectLocation?.includes('/admin/setup')) {
      log('green', '✅ Correctly redirected to setup (no users exist yet)');
      return { success: true, type: 'setup-redirect' };
    } else if (response.statusCode === 302 && response.redirectLocation?.includes('/admin/login')) {
      log('red', '❌ Unexpected redirect to login in development mode');
      return { success: false, reason: 'redirected-to-login' };
    } else {
      log('red', `❌ Unexpected response: ${response.statusCode}`);
      return { success: false, reason: 'unexpected-response', statusCode: response.statusCode };
    }
    
  } catch (error) {
    log('red', `❌ Development mode test failed: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    await stopServer(server);
  }
}

/**
 * Test production mode security
 */
async function testProductionMode() {
  log('yellow', '\n=== Testing Production Mode Security ===');
  
  const server = await startServer('production');
  
  try {
    // Wait a moment for server to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test admin dashboard access (should redirect to login)
    log('cyan', 'Testing admin dashboard access...');
    const response = await makeRequest(`${BASE_URL}/admin/dashboard`);
    
    if (response.statusCode === 302 && response.redirectLocation?.includes('/admin/login')) {
      log('green', '✅ Correctly redirected to login in production mode');
      return { success: true, type: 'login-redirect' };
    } else if (response.statusCode === 302 && response.redirectLocation?.includes('/admin/setup')) {
      log('green', '✅ Correctly redirected to setup (no users exist yet)');
      return { success: true, type: 'setup-redirect' };
    } else if (response.statusCode === 200) {
      log('red', '❌ SECURITY ISSUE: Auto-login worked in production mode!');
      return { success: false, reason: 'auto-login-in-production' };
    } else {
      log('red', `❌ Unexpected response: ${response.statusCode}`);
      return { success: false, reason: 'unexpected-response', statusCode: response.statusCode };
    }
    
  } catch (error) {
    log('red', `❌ Production mode test failed: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    await stopServer(server);
  }
}

/**
 * Test with undefined NODE_ENV (should NOT enable auto-login for security)
 */
async function testUndefinedMode() {
  log('yellow', '\n=== Testing Undefined NODE_ENV (should NOT enable auto-login for security) ===');
  
  // Start server without NODE_ENV set
  log('cyan', 'Starting server with undefined NODE_ENV...');
  
  const serverEnv = {
    ...process.env,
    PORT: TEST_PORT,
    SQLITE_DB_PATH: ':memory:'
  };
  delete serverEnv.NODE_ENV; // Explicitly remove NODE_ENV
  
  const server = spawn('node', [APP_PATH], {
    env: serverEnv,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  return new Promise((resolve) => {
    let serverReady = false;
    let output = '';

    server.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      
      if (text.includes(`Server running on port ${TEST_PORT}`) && !serverReady) {
        serverReady = true;
        log('green', '✅ Server started successfully with undefined NODE_ENV');
        
        // Test the behavior after a brief delay
        setTimeout(async () => {
          try {
            const response = await makeRequest(`${BASE_URL}/admin/dashboard`);
            
            if (response.statusCode === 302 && (response.redirectLocation?.includes('/admin/login') || response.redirectLocation?.includes('/admin/setup'))) {
              log('green', '✅ Undefined NODE_ENV correctly blocks auto-login (secure behavior)');
              resolve({ success: true });
            } else if (response.statusCode === 200) {
              log('red', '❌ SECURITY ISSUE: Undefined NODE_ENV enabled auto-login!');
              resolve({ success: false });
            } else {
              log('red', `❌ Unexpected response for undefined NODE_ENV: ${response.statusCode}`);
              resolve({ success: false });
            }
          } catch (error) {
            log('red', `❌ Test failed: ${error.message}`);
            resolve({ success: false });
          } finally {
            await stopServer(server);
          }
        }, 2000);
      }
    });

    server.stderr.on('data', (data) => {
      output += data.toString();
    });

    server.on('exit', (_code) => {
      if (!serverReady) {
        log('red', `❌ Server failed to start: ${output}`);
        resolve({ success: false });
      }
    });

    // Timeout
    setTimeout(async () => {
      if (!serverReady) {
        await stopServer(server);
        log('red', '❌ Server startup timeout');
        resolve({ success: false });
      }
    }, 10000);
  });
}

/**
 * Main test runner
 */
async function runTests() {
  log('cyan', '🚀 Starting Development Auto-Login Integration Tests\n');
  
  const results = {
    development: null,
    production: null,
    undefined: null
  };
  
  try {
    // Run tests sequentially to avoid port conflicts
    results.development = await testDevelopmentMode();
    results.production = await testProductionMode();
    results.undefined = await testUndefinedMode();
    
    // Summary
    log('yellow', '\n=== Test Results Summary ===');
    
    const allPassed = Object.values(results).every(r => r && r.success);
    
    log(results.development.success ? 'green' : 'red', 
      `Development Mode: ${results.development.success ? 'PASS' : 'FAIL'}`);
    
    log(results.production.success ? 'green' : 'red', 
      `Production Mode: ${results.production.success ? 'PASS' : 'FAIL'}`);
    
    log(results.undefined.success ? 'green' : 'red', 
      `Undefined NODE_ENV Security: ${results.undefined.success ? 'PASS' : 'FAIL'}`);
    
    if (allPassed) {
      log('green', '\n🎉 All tests passed! Development auto-login is working correctly.');
      process.exit(0);
    } else {
      log('red', '\n❌ Some tests failed. Check the output above for details.');
      console.log('Failed results:', JSON.stringify(results, null, 2));
      process.exit(1);
    }
    
  } catch (error) {
    log('red', `\n❌ Test suite failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Handle process cleanup
process.on('SIGINT', () => {
  log('yellow', '\nReceived SIGINT, cleaning up...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  log('red', 'Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run tests
if (require.main === module) {
  runTests();
}

module.exports = {
  testDevelopmentMode,
  testProductionMode,
  testUndefinedMode,
  runTests
};