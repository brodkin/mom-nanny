/**
 * Timezone utilities for consistent date/time formatting
 * Handles conversion between UTC storage and configured timezone display
 */

class TimezoneUtils {
  /**
   * Format a date in the specified timezone
   * @param {Date|string} date - Date to format
   * @param {string} timezone - IANA timezone (e.g., 'America/Los_Angeles')
   * @param {Object} options - Intl.DateTimeFormat options
   * @returns {string} Formatted date string
   */
  static formatInTimezone(date, timezone = 'America/Los_Angeles', options = {}) {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      
      // Check if style options are being used
      const hasStyleOptions = options.timeStyle || options.dateStyle;
      
      let formatOptions;
      if (hasStyleOptions) {
        // If style options are provided, use only those with timezone
        // Don't mix with individual component options
        formatOptions = {
          timeZone: timezone,
          ...options
        };
      } else {
        // Otherwise, use individual component options
        const defaultOptions = {
          timeZone: timezone,
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        };
        formatOptions = { ...defaultOptions, ...options };
      }
      
      return new Intl.DateTimeFormat('en-US', formatOptions).format(dateObj);
    } catch (error) {
      console.error('Error formatting date in timezone:', error);
      // Fallback to ISO string if timezone formatting fails
      return new Date(date).toISOString();
    }
  }

  /**
   * Get just the time portion in specified timezone
   * @param {Date|string} date - Date to format
   * @param {string} timezone - IANA timezone
   * @returns {string} Time string (e.g., "2:30 PM")
   */
  static getTimeInTimezone(date, timezone = 'America/Los_Angeles') {
    return this.formatInTimezone(date, timezone, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }

  /**
   * Get just the date portion in specified timezone
   * @param {Date|string} date - Date to format
   * @param {string} timezone - IANA timezone
   * @returns {string} Date string (e.g., "Jan 15, 2024")
   */
  static getDateInTimezone(date, timezone = 'America/Los_Angeles') {
    return this.formatInTimezone(date, timezone, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Get current time in specified timezone
   * @param {string} timezone - IANA timezone
   * @returns {string} Current time string
   */
  static getCurrentTimeInTimezone(timezone = 'America/Los_Angeles') {
    return this.formatInTimezone(new Date(), timezone, {
      timeStyle: 'medium',
      dateStyle: 'medium'
    });
  }

  /**
   * Get timezone abbreviation (e.g., PST, EST)
   * @param {string} timezone - IANA timezone
   * @returns {string} Timezone abbreviation
   */
  static getTimezoneAbbreviation(timezone = 'America/Los_Angeles') {
    try {
      const date = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short'
      });
      
      const parts = formatter.formatToParts(date);
      const timeZoneName = parts.find(part => part.type === 'timeZoneName');
      return timeZoneName ? timeZoneName.value : timezone;
    } catch (error) {
      console.error('Error getting timezone abbreviation:', error);
      return timezone;
    }
  }

  /**
   * Calculate time ago with timezone awareness
   * @param {Date|string} date - Past date
   * @param {string} timezone - IANA timezone for "now" calculation
   * @returns {string} Human-readable time difference
   */
  static getTimeAgo(date, timezone = 'America/Los_Angeles') {
    const now = new Date();
    const then = typeof date === 'string' ? new Date(date) : date;
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    // For older dates, show the actual date in timezone
    return this.getDateInTimezone(then, timezone);
  }

  /**
   * Validate if a timezone string is valid
   * @param {string} timezone - IANA timezone to validate
   * @returns {boolean} True if valid
   */
  static isValidTimezone(timezone) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get offset from UTC for a timezone
   * @param {string} timezone - IANA timezone
   * @returns {string} Offset string (e.g., "-08:00")
   */
  static getTimezoneOffset(timezone = 'America/Los_Angeles') {
    try {
      const date = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      // Get the time in the specified timezone
      const tzTime = new Date(formatter.format(date));
      
      // Calculate offset in minutes
      const offsetMinutes = (date.getTime() - tzTime.getTime()) / 60000;
      const hours = Math.floor(Math.abs(offsetMinutes) / 60);
      const minutes = Math.abs(offsetMinutes) % 60;
      const sign = offsetMinutes >= 0 ? '+' : '-';
      
      return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } catch (error) {
      console.error('Error calculating timezone offset:', error);
      return '+00:00';
    }
  }

  /**
   * Get relative time description (e.g., "2 hours ago")
   * @param {Date|string} date - Date to compare
   * @returns {string} Relative time description
   */
  static getRelativeTime(date) {
    const now = new Date();
    const then = typeof date === 'string' ? new Date(date) : date;
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    // For older dates, return a simple date
    return then.toLocaleDateString();
  }

  /**
   * Convert a UTC date to a specific timezone for display
   * Maintains the original UTC storage while showing local time
   * @param {string} utcDateString - UTC date string from database
   * @param {string} timezone - Target timezone for display
   * @returns {Object} Object with formatted strings
   */
  static convertUTCToTimezone(utcDateString, timezone = 'America/Los_Angeles') {
    const date = new Date(utcDateString);
    
    return {
      full: this.formatInTimezone(date, timezone),
      date: this.getDateInTimezone(date, timezone),
      time: this.getTimeInTimezone(date, timezone),
      iso: date.toISOString(), // Keep original UTC for data integrity
      timeAgo: this.getTimeAgo(date, timezone),
      relative: this.getRelativeTime(date)
    };
  }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimezoneUtils;
}

// Export for browser
if (typeof window !== 'undefined') {
  window.TimezoneUtils = TimezoneUtils;
}