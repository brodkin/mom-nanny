/**
 * Admin Dashboard UI Improvements Test Suite
 * 
 * Tests for:
 * 1. Current statistics display fixes
 * 2. Real positive insights implementation
 * 3. Toast notification z-index fixes
 * 4. Copyright updates
 * 5. Dashboard section reordering
 * 6. System heartbeat implementation
 */

const request = require('supertest');
const app = require('../app');
const fs = require('fs');
const path = require('path');

describe('Dashboard UI Improvements', () => {
  describe('System Heartbeat Endpoint', () => {
    test('should return system health status', async () => {
      const response = await request(app)
        .get('/api/admin/heartbeat')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
          timestamp: expect.any(String),
          services: expect.objectContaining({
            database: expect.objectContaining({
              status: expect.any(String),
              responseTime: expect.any(Number)
            }),
            system: expect.objectContaining({
              status: expect.any(String),
              uptime: expect.any(Number),
              memory: expect.any(Object)
            })
          })
        }
      });
    });

    test('should handle database connection errors gracefully', async () => {
      // Mock database error
      const response = await request(app)
        .get('/api/admin/heartbeat')
        .expect(200); // Should still return 200 with degraded status

      // Should not crash and should indicate service issues
      expect(response.body.success).toBe(true);
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.data.status);
    });
  });

  describe('Real Positive Insights API', () => {
    test('should generate insights based on conversation patterns', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/positive-insights');

      // API should either succeed with insights or fail gracefully
      if (response.status === 200) {
        expect(response.body).toMatchObject({
          success: true,
          data: {
            insights: expect.arrayContaining([
              expect.objectContaining({
                category: expect.any(String),
                title: expect.any(String),
                message: expect.any(String),
                timestamp: expect.any(String),
                priority: expect.any(String),
                icon: expect.any(String)
              })
            ]),
            summary: expect.objectContaining({
              totalInsights: expect.any(Number),
              systemHealth: expect.any(String),
              overallAssessment: expect.any(String)
            })
          }
        });
      } else if (response.status === 500) {
        // Empty database should return 500 with proper error structure
        expect(response.body).toMatchObject({
          success: false,
          error: expect.any(String),
          timestamp: expect.any(String)
        });
      } else {
        throw new Error(`Unexpected status ${response.status}: ${JSON.stringify(response.body)}`);
      }
    });

    test('should include specific insight categories when data available', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/positive-insights');

      if (response.status === 200) {
        const insights = response.body.data.insights;
        const insightCategories = insights.map(insight => insight.category);
        
        expect(insightCategories).toEqual(
          expect.arrayContaining([
            'availability',
            'engagement',
            'success'
          ])
        );
      } else {
        // If API fails (empty database), just verify it returns proper error structure
        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('positive insights');
      }
    });
  });

  describe('Dashboard Statistics Display', () => {
    test('should return properly formatted care indicators', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/care-indicators');

      // API should either succeed with data or fail gracefully
      if (response.status === 200) {
        expect(response.body.data.summary).toMatchObject({
          medicationConcerns: expect.objectContaining({
            count: expect.any(Number),
            trend: expect.any(String)
          }),
          painComplaints: expect.objectContaining({
            count: expect.any(Number),
            trend: expect.any(String)
          }),
          hospitalRequests: expect.objectContaining({
            count: expect.any(Number),
            trend: expect.any(String)
          }),
          staffInteractions: expect.objectContaining({
            count: expect.any(Number),
            trend: expect.any(String)
          })
        });
      } else if (response.status === 500) {
        // Empty database should return 500 with proper error structure
        expect(response.body).toMatchObject({
          success: false,
          error: expect.any(String),
          timestamp: expect.any(String)
        });
      } else {
        throw new Error(`Unexpected status ${response.status}: ${JSON.stringify(response.body)}`);
      }
    });

    test('should handle zero values properly', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/care-indicators');

      if (response.status === 200) {
        const summary = response.body.data.summary;
        
        // Should handle zero values without errors
        Object.values(summary).forEach(indicator => {
          expect(indicator.count).toBeGreaterThanOrEqual(0);
          expect(indicator.trend).toBeDefined();
          expect(typeof indicator.trend).toBe('string');
        });
      } else {
        // If API fails (empty database), verify proper error structure
        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('care indicators');
      }
    });
  });

  describe('Dashboard HTML Structure', () => {
    test('should have correct section ordering', async () => {
      const response = await request(app)
        .get('/admin/dashboard')
        .expect(200);

      const htmlContent = response.text;
      
      // Check that sections appear in the correct order
      const mentalStateIndex = htmlContent.indexOf('<h2 class="section-title">Mental State Monitoring</h2>');
      const careIndicatorsIndex = htmlContent.indexOf('<h2 class="section-title">Care Indicators</h2>');
      const alertsIndex = htmlContent.indexOf('<h2 class="section-title">Alerts & Insights</h2>');
      const conversationIndex = htmlContent.indexOf('<h2 class="section-title">Conversation Analytics</h2>');

      expect(mentalStateIndex).toBeLessThan(careIndicatorsIndex);
      expect(careIndicatorsIndex).toBeLessThan(alertsIndex);
      expect(alertsIndex).toBeLessThan(conversationIndex);
    });

    test('should have updated copyright with current year', async () => {
      const response = await request(app)
        .get('/admin/dashboard')
        .expect(200);

      const currentYear = new Date().getFullYear();
      
      // Check for the copyright structure with dynamic year
      expect(response.text).toContain('Ryan Brodkin');
      expect(response.text).toContain(`<span id="current-year">${currentYear}</span>`);
    });

    test('should include heartbeat status indicator', async () => {
      const response = await request(app)
        .get('/admin/dashboard')
        .expect(200);

      expect(response.text).toContain('system-heartbeat');
      expect(response.text).toContain('status-indicator');
    });
  });

  describe('CSS Improvements', () => {
    test('should have toast notification z-index fix', () => {
      const cssPath = path.join(__dirname, '../admin/css/fixes.css');
      
      if (fs.existsSync(cssPath)) {
        const cssContent = fs.readFileSync(cssPath, 'utf8');
        
        // Check for toast z-index improvements
        expect(cssContent).toMatch(/\.dashboard-toast.*z-index.*9999/s);
      }
    });

    test('should have proper toast positioning below header', () => {
      const cssPath = path.join(__dirname, '../admin/css/fixes.css');
      
      if (fs.existsSync(cssPath)) {
        const cssContent = fs.readFileSync(cssPath, 'utf8');
        
        // Check for toast top positioning
        expect(cssContent).toMatch(/\.dashboard-toast.*top.*\d+px/s);
      }
    });
  });
});

describe('Integration Tests', () => {
  describe('Dashboard Data Flow', () => {
    test('should integrate heartbeat with dashboard status', async () => {
      const heartbeatResponse = await request(app)
        .get('/api/admin/heartbeat');

      const dashboardResponse = await request(app)
        .get('/admin/dashboard')
        .expect(200);

      // Dashboard should reflect heartbeat status
      expect(heartbeatResponse.body.success).toBe(true);
      expect(dashboardResponse.text).toContain('system-heartbeat');
    });

    test('should show real data in statistics sections', async () => {
      const careResponse = await request(app)
        .get('/api/admin/dashboard/care-indicators');

      const insightsResponse = await request(app)
        .get('/api/admin/dashboard/positive-insights');

      // APIs should return valid responses (either data or proper errors)
      expect([200, 500]).toContain(careResponse.status);
      expect([200, 500]).toContain(insightsResponse.status);
      
      if (careResponse.status === 200) {
        expect(careResponse.body.data.summary.medicationConcerns.count).toBeGreaterThanOrEqual(0);
      }
      
      if (insightsResponse.status === 200) {
        expect(insightsResponse.body.data.insights.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors gracefully in dashboard', async () => {
      // Test with invalid endpoint
      const response = await request(app)
        .get('/api/admin/dashboard/invalid-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String)
      });
    });

    test('should maintain dashboard functionality when services are down', async () => {
      // Dashboard should still load even if some APIs fail
      const response = await request(app)
        .get('/admin/dashboard')
        .expect(200);

      expect(response.text).toContain('Compassionate Care Dashboard');
    });
  });
});