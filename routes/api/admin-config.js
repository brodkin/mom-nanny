const express = require('express');
const router = express.Router();

/**
 * Admin Configuration API Routes
 * 
 * Provides endpoints for system configuration management and health monitoring
 * Handles configuration retrieval, updates, and system health checks
 */

// In-memory configuration store (in production, this would be in a database)
let systemConfig = {
  ai: {
    model: 'gpt-4',
    maxTokens: 150,
    temperature: 0.7,
    systemPromptEnabled: true,
    functionCallingEnabled: true,
    maxConversationHistory: 10
  },
  voice: {
    provider: 'deepgram',
    model: process.env.VOICE_MODEL || 'aura-asteria-en',
    speed: 1.0,
    pitch: 1.0,
    responseChunking: true,
    chunkDelimiter: '•'
  },
  call: {
    maxDuration: 1800, // 30 minutes
    recordingEnabled: process.env.RECORDING_ENABLED === 'true',
    greetingEnabled: true,
    interruptionHandling: true,
    maxInterruptions: 5
  },
  security: {
    rateLimitEnabled: true,
    maxCallsPerHour: 60,
    allowedNumbers: ['*'], // '*' means all numbers allowed
    blockedNumbers: [],
    adminAuthRequired: false // Placeholder for future auth
  },
  monitoring: {
    loggingLevel: 'info',
    metricsEnabled: true,
    alertingEnabled: false,
    healthCheckInterval: 60000 // 1 minute
  },
  system: {
    environment: process.env.NODE_ENV || 'development',
    timezone: 'America/New_York',
    maintenanceMode: false,
    debugMode: false
  }
};

// Configuration validation schemas
const configSchema = {
  ai: {
    model: { type: 'string', allowed: ['gpt-4', 'gpt-3.5-turbo'] },
    maxTokens: { type: 'number', min: 50, max: 500 },
    temperature: { type: 'number', min: 0, max: 1 },
    systemPromptEnabled: { type: 'boolean' },
    functionCallingEnabled: { type: 'boolean' },
    maxConversationHistory: { type: 'number', min: 1, max: 50 }
  },
  voice: {
    provider: { type: 'string', allowed: ['deepgram', 'elevenlabs'] },
    model: { type: 'string' },
    speed: { type: 'number', min: 0.5, max: 2.0 },
    pitch: { type: 'number', min: 0.5, max: 2.0 },
    responseChunking: { type: 'boolean' },
    chunkDelimiter: { type: 'string', maxLength: 5 }
  },
  call: {
    maxDuration: { type: 'number', min: 60, max: 3600 },
    recordingEnabled: { type: 'boolean' },
    greetingEnabled: { type: 'boolean' },
    interruptionHandling: { type: 'boolean' },
    maxInterruptions: { type: 'number', min: 1, max: 20 }
  }
};

// Validation helper function
const validateConfig = (config, schema) => {
  const errors = [];
  
  for (const [section, sectionConfig] of Object.entries(config)) {
    if (!schema[section]) continue;
    
    for (const [key, value] of Object.entries(sectionConfig)) {
      const rules = schema[section][key];
      if (!rules) continue;
      
      // Type validation
      if (rules.type && typeof value !== rules.type) {
        errors.push(`${section}.${key}: Expected ${rules.type}, got ${typeof value}`);
        continue;
      }
      
      // Range validation for numbers
      if (rules.type === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors.push(`${section}.${key}: Value ${value} is below minimum ${rules.min}`);
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push(`${section}.${key}: Value ${value} is above maximum ${rules.max}`);
        }
      }
      
      // String length validation
      if (rules.type === 'string' && rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${section}.${key}: String length ${value.length} exceeds maximum ${rules.maxLength}`);
      }
      
      // Allowed values validation
      if (rules.allowed && !rules.allowed.includes(value)) {
        errors.push(`${section}.${key}: Value "${value}" not in allowed values: ${rules.allowed.join(', ')}`);
      }
    }
  }
  
  return errors;
};

// GET /api/admin/config - Get system configuration
router.get('/config', (req, res) => {
  try {
    const section = req.query.section; // Optional: get specific section
    
    if (section) {
      if (systemConfig[section]) {
        res.json({
          success: true,
          data: { [section]: systemConfig[section] },
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(404).json({
          success: false,
          error: `Configuration section '${section}' not found`,
          availableSections: Object.keys(systemConfig)
        });
      }
    } else {
      res.json({
        success: true,
        data: systemConfig,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Error fetching configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system configuration',
      timestamp: new Date().toISOString()
    });
  }
});

// PUT /api/admin/config - Update configuration
router.put('/config', (req, res) => {
  try {
    const updates = req.body;
    
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Configuration updates must be provided as an object',
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate the configuration updates
    const validationErrors = validateConfig(updates, configSchema);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Configuration validation failed',
        details: validationErrors,
        timestamp: new Date().toISOString()
      });
    }
    
    // Apply the updates (deep merge)
    const previousConfig = JSON.parse(JSON.stringify(systemConfig)); // Backup
    
    for (const [section, sectionUpdates] of Object.entries(updates)) {
      if (systemConfig[section]) {
        systemConfig[section] = {
          ...systemConfig[section],
          ...sectionUpdates
        };
      } else {
        // New section
        systemConfig[section] = sectionUpdates;
      }
    }
    
    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: {
        updated: updates,
        current: systemConfig
      },
      timestamp: new Date().toISOString()
    });
    
    // Log the configuration change
    console.log('Admin configuration updated:', {
      timestamp: new Date().toISOString(),
      updates: updates,
      previousConfig: previousConfig
    });
    
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update system configuration',
      timestamp: new Date().toISOString()
    });
  }
});

// PATCH /api/admin/config/:section - Update specific configuration section
router.patch('/config/:section', (req, res) => {
  try {
    const { section } = req.params;
    const updates = req.body;
    
    if (!systemConfig[section]) {
      return res.status(404).json({
        success: false,
        error: `Configuration section '${section}' not found`,
        availableSections: Object.keys(systemConfig)
      });
    }
    
    // Validate section-specific updates
    if (configSchema[section]) {
      const validationErrors = validateConfig({ [section]: updates }, configSchema);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Configuration validation failed',
          details: validationErrors,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    const previousSection = { ...systemConfig[section] };
    systemConfig[section] = {
      ...systemConfig[section],
      ...updates
    };
    
    res.json({
      success: true,
      message: `Configuration section '${section}' updated successfully`,
      data: {
        section: section,
        previous: previousSection,
        current: systemConfig[section]
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`Error updating configuration section '${req.params.section}':`, error);
    res.status(500).json({
      success: false,
      error: `Failed to update configuration section '${req.params.section}'`,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/admin/health - System health check
router.get('/health', (req, res) => {
  try {
    const now = new Date();
    const detailed = req.query.detailed === 'true';
    
    // Basic health check
    const healthData = {
      status: 'healthy',
      timestamp: now.toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };
    
    if (detailed) {
      // Detailed health information
      healthData.details = {
        memory: {
          used: Math.round(process.memoryUsage().rss / 1024 / 1024),
          heap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB'
        },
        cpu: {
          usage: process.cpuUsage(),
          loadAverage: require('os').loadavg()
        },
        system: {
          platform: require('os').platform(),
          arch: require('os').arch(),
          nodeVersion: process.version,
          pid: process.pid
        },
        services: {
          express: { status: 'running', port: process.env.PORT || 3000 },
          websocket: { status: 'available', endpoint: '/connection' },
          // Mock service statuses (in production, these would be real checks)
          twilio: { 
            status: Math.random() > 0.05 ? 'connected' : 'degraded',
            lastCheck: now.toISOString() 
          },
          openai: { 
            status: Math.random() > 0.02 ? 'available' : 'limited',
            lastCheck: now.toISOString() 
          },
          deepgram: { 
            status: Math.random() > 0.03 ? 'operational' : 'slow',
            lastCheck: now.toISOString() 
          }
        },
        configuration: {
          maintenanceMode: systemConfig.system?.maintenanceMode || false,
          debugMode: systemConfig.system?.debugMode || false,
          recordingEnabled: systemConfig.call?.recordingEnabled || false
        }
      };
      
      // Determine overall health status based on services
      const serviceStatuses = Object.values(healthData.details.services);
      const hasFailures = serviceStatuses.some(service => 
        service.status === 'down' || service.status === 'error'
      );
      const hasDegradation = serviceStatuses.some(service => 
        service.status === 'degraded' || service.status === 'limited' || service.status === 'slow'
      );
      
      if (hasFailures) {
        healthData.status = 'unhealthy';
      } else if (hasDegradation) {
        healthData.status = 'degraded';
      }
    }
    
    // Set appropriate HTTP status code based on health
    const statusCode = healthData.status === 'healthy' ? 200 : 
                      healthData.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: healthData.status !== 'unhealthy',
      data: healthData
    });
    
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(500).json({
      success: false,
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      }
    });
  }
});

// POST /api/admin/maintenance - Toggle maintenance mode
router.post('/maintenance', (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled field must be a boolean value',
        timestamp: new Date().toISOString()
      });
    }
    
    systemConfig.system.maintenanceMode = enabled;
    
    res.json({
      success: true,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
      data: {
        maintenanceMode: enabled,
        timestamp: new Date().toISOString()
      }
    });
    
    console.log(`Maintenance mode ${enabled ? 'enabled' : 'disabled'} via admin interface`);
    
  } catch (error) {
    console.error('Error toggling maintenance mode:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle maintenance mode',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/admin/config/schema - Get configuration schema for UI generation
router.get('/config/schema', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        schema: configSchema,
        sections: Object.keys(systemConfig),
        description: 'Configuration schema for validation and UI generation'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching configuration schema:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch configuration schema',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;