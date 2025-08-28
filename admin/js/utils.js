/**
 * Utility functions for the admin dashboard
 */

// DOM utilities
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const createElement = (tag, classes, content) => {
  const element = document.createElement(tag);
  if (classes) element.className = classes;
  if (content) element.innerHTML = content;
  return element;
};

// Local storage utilities
const storage = {
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.warn(`Error parsing localStorage item '${key}':`, e);
      return defaultValue;
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn(`Error setting localStorage item '${key}':`, e);
      return false;
    }
  },
  
  remove: (key) => {
    localStorage.removeItem(key);
  },
  
  clear: () => {
    localStorage.clear();
  }
};

// Date and time utilities
const formatTime = (date) => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
};

const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
};

const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const timeAgo = (date) => {
  // Handle falsy values (null, undefined, '', 0, false)
  if (!date) return 'Never';
  
  // Convert to Date object if needed
  const dateObj = date instanceof Date ? date : new Date(date);
  
  // Check for invalid dates
  if (isNaN(dateObj.getTime())) return 'Never';
  
  const now = new Date();
  const diffMs = now - dateObj;
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  // Within last 5 minutes - "Just now"
  if (minutes < 5) {
    return 'Just now';
  }
  
  // Under 60 minutes - "N minutes ago"
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  // Same day - "N hours, N minutes ago"
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDateDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  
  if (startOfToday.getTime() === startOfDateDay.getTime()) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}, ${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  // Calculate days more accurately using date difference, not hours/24
  const daysDiff = Math.floor((startOfToday - startOfDateDay) / (1000 * 60 * 60 * 24));
  
  // Within last 7 days - "N days ago"
  if (daysDiff > 0 && daysDiff <= 7) {
    return `${daysDiff} ${daysDiff === 1 ? 'day' : 'days'} ago`;
  }
  
  // Fallback to formatted date for older dates
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Number utilities
const formatNumber = (num) => {
  return new Intl.NumberFormat('en-US').format(num);
};

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const formatPercentage = (value, total) => {
  if (total === 0) return '0%';
  return Math.round((value / total) * 100) + '%';
};

// String utilities
const capitalize = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const slugify = (str) => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const truncate = (str, length = 100, ending = '...') => {
  if (str.length <= length) return str;
  return str.substring(0, length - ending.length) + ending;
};

// Array utilities
const groupBy = (array, key) => {
  return array.reduce((groups, item) => {
    const group = item[key];
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {});
};

const sortBy = (array, key, direction = 'asc') => {
  return array.sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (direction === 'desc') {
      return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
    }
    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
  });
};

const unique = (array) => {
  return [...new Set(array)];
};

// Validation utilities
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhone = (phone) => {
  const phoneRegex = /^\+?[\d\s\-()]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Debounce and throttle
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Animation utilities
const animate = (element, keyframes, options) => {
  return element.animate(keyframes, options);
};

const fadeIn = (element, duration = 300) => {
  element.style.opacity = '0';
  element.style.display = 'block';
  
  return animate(element, 
    [{ opacity: 0 }, { opacity: 1 }], 
    { duration, easing: 'ease-out', fill: 'forwards' }
  );
};

const fadeOut = (element, duration = 300) => {
  return animate(element,
    [{ opacity: 1 }, { opacity: 0 }],
    { duration, easing: 'ease-in', fill: 'forwards' }
  ).finished.then(() => {
    element.style.display = 'none';
  });
};

const slideUp = (element, duration = 300) => {
  const height = element.offsetHeight;
  return animate(element,
    [
      { height: height + 'px', opacity: 1 },
      { height: '0px', opacity: 0 }
    ],
    { duration, easing: 'ease-in-out', fill: 'forwards' }
  ).finished.then(() => {
    element.style.display = 'none';
  });
};

const slideDown = (element, duration = 300) => {
  element.style.display = 'block';
  const height = element.scrollHeight;
  element.style.height = '0px';
  
  return animate(element,
    [
      { height: '0px', opacity: 0 },
      { height: height + 'px', opacity: 1 }
    ],
    { duration, easing: 'ease-in-out', fill: 'forwards' }
  );
};

// Event utilities
const on = (element, event, handler, options = false) => {
  element.addEventListener(event, handler, options);
  return () => element.removeEventListener(event, handler, options);
};

const once = (element, event, handler) => {
  element.addEventListener(event, handler, { once: true });
};

const emit = (element, eventName, data = {}) => {
  const event = new CustomEvent(eventName, { detail: data });
  element.dispatchEvent(event);
};

// HTTP utilities
const request = async (url, options = {}) => {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };
  
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }
  
  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text();
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
};

const get = (url, options = {}) => request(url, { ...options, method: 'GET' });
const post = (url, data, options = {}) => request(url, { ...options, method: 'POST', body: data });
const put = (url, data, options = {}) => request(url, { ...options, method: 'PUT', body: data });
const del = (url, options = {}) => request(url, { ...options, method: 'DELETE' });

// Color utilities
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const rgbToHex = (r, g, b) => {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

// Clipboard utilities
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy text: ', err);
    return false;
  }
};

// Device detection
const device = {
  isMobile: () => window.innerWidth <= 768,
  isTablet: () => window.innerWidth > 768 && window.innerWidth <= 1024,
  isDesktop: () => window.innerWidth > 1024,
  hasTouch: () => 'ontouchstart' in window,
  hasHover: () => window.matchMedia('(hover: hover)').matches,
  prefersDark: () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  prefersReducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
};

// Export utilities for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    $, $$, createElement,
    storage,
    formatTime, formatDate, formatDuration, timeAgo,
    formatNumber, formatBytes, formatPercentage,
    capitalize, slugify, truncate,
    groupBy, sortBy, unique,
    isValidEmail, isValidPhone, isValidUrl,
    debounce, throttle,
    animate, fadeIn, fadeOut, slideUp, slideDown,
    on, once, emit,
    request, get, post, put, del,
    hexToRgb, rgbToHex,
    copyToClipboard,
    device
  };
}

// Also attach to window for global access
if (typeof window !== 'undefined') {
  window.AdminUtils = {
    $, $$, createElement,
    storage,
    formatTime, formatDate, formatDuration, timeAgo,
    formatNumber, formatBytes, formatPercentage,
    capitalize, slugify, truncate,
    groupBy, sortBy, unique,
    isValidEmail, isValidPhone, isValidUrl,
    debounce, throttle,
    animate, fadeIn, fadeOut, slideUp, slideDown,
    on, once, emit,
    request, get, post, put, del,
    hexToRgb, rgbToHex,
    copyToClipboard,
    device
  };
}