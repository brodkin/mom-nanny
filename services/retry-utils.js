/**
 * Retry utility with exponential backoff for API calls
 */

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after the delay
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.initialDelayMs - Initial delay in milliseconds (default: 1000)
 * @param {number} options.maxDelayMs - Maximum delay in milliseconds (default: 30000)
 * @param {number} options.backoffFactor - Multiplier for exponential backoff (default: 2)
 * @param {Function} options.shouldRetry - Function to determine if should retry based on error (default: always retry)
 * @param {Function} options.onRetry - Callback function called before each retry
 * @returns {Promise} Result of the function
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffFactor = 2,
    shouldRetry = () => true,
    onRetry = null
  } = options;

  let lastError;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Check for rate limit headers
      if (error.response) {
        // Handle 429 rate limit specifically
        if (error.response.status === 429) {
          // Check for Retry-After header
          const retryAfter = error.response.headers?.get?.('retry-after');
          if (retryAfter) {
            // Retry-After can be in seconds or a date
            const retryAfterMs = isNaN(retryAfter) 
              ? new Date(retryAfter).getTime() - Date.now()
              : parseInt(retryAfter) * 1000;
            
            if (retryAfterMs > 0 && retryAfterMs < maxDelayMs) {
              delay = retryAfterMs;
            }
          }
          
          console.log(`Rate limited (429). Waiting ${delay}ms before retry ${attempt}/${maxRetries}`.yellow);
        }
      }

      // Log retry attempt
      if (onRetry) {
        onRetry(attempt, delay, error);
      } else {
        console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms. Error: ${error.message}`.yellow);
      }

      // Wait before retrying
      await sleep(delay);

      // Exponential backoff for next attempt
      delay = Math.min(delay * backoffFactor, maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Create a retry wrapper specifically for Deepgram API calls
 * @param {Object} options - Override default retry options
 * @returns {Function} Retry function configured for Deepgram
 */
function createDeepgramRetry(options = {}) {
  const deepgramDefaults = {
    maxRetries: parseInt(process.env.DEEPGRAM_MAX_RETRIES) || 3,
    initialDelayMs: parseInt(process.env.DEEPGRAM_INITIAL_RETRY_DELAY_MS) || 1000,
    maxDelayMs: parseInt(process.env.DEEPGRAM_MAX_RETRY_DELAY_MS) || 30000,
    backoffFactor: 2,
    shouldRetry: (error) => {
      // Retry on network errors
      if (!error.response) return true;
      
      // Retry on specific status codes
      const retryableStatuses = [429, 500, 502, 503, 504];
      return retryableStatuses.includes(error.response?.status);
    },
    onRetry: (attempt, delay, error) => {
      const status = error.response?.status || 'Network Error';
      console.log(`Deepgram API retry ${attempt}: Status ${status}, waiting ${delay}ms`.yellow);
    }
  };

  return (fn) => retryWithBackoff(fn, { ...deepgramDefaults, ...options });
}

module.exports = {
  sleep,
  retryWithBackoff,
  createDeepgramRetry
};