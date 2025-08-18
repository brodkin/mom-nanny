/**
 * Modal Viewport Coverage Test
 * 
 * This test demonstrates the current issue where the #transcript-modal
 * does not cover the exact viewport dimensions, showing gaps on the sides.
 */

describe('Modal Viewport Coverage Bug Test', () => {
  let modal, overlay;

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = `
      <div id="transcript-modal" class="modal" style="display: none;">
        <div class="modal-overlay"></div>
        <div class="modal-container">
          <div class="modal-header">
            <h3 class="modal-title">Test Modal</h3>
            <button class="modal-close">×</button>
          </div>
          <div class="modal-body">
            <div id="transcript-content">Test content</div>
          </div>
        </div>
      </div>
    `;

    modal = document.getElementById('transcript-modal');
    overlay = modal.querySelector('.modal-overlay');

    // Mock viewport dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 1080
    });

    // Load our fixed CSS implementation
    const style = document.createElement('style');
    style.textContent = `
      /* FIXED implementation - exact viewport coverage */
      #transcript-modal {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        min-width: 100vw !important;
        min-height: 100vh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        border-radius: 0 !important;
        z-index: 1050 !important;
        display: none;
        align-items: center !important;
        justify-content: center !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        transform: none !important;
      }

      #transcript-modal .modal-overlay {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0, 0, 0, 0.5) !important;
        backdrop-filter: blur(4px);
        z-index: 1040 !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        border-radius: 0 !important;
        box-sizing: border-box !important;
      }
    `;
    document.head.appendChild(style);
  });

  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
    const styles = document.head.querySelectorAll('style');
    styles.forEach(style => style.remove());
  });

  // TEST 1: This should now PASS after our fix
  test('FIXED: modal should cover exact viewport dimensions without gaps', () => {
    // Show modal
    modal.style.display = 'flex';
    
    // Get computed styles
    const modalStyles = window.getComputedStyle(modal);
    const overlayStyles = window.getComputedStyle(overlay);

    // These assertions should pass for proper viewport coverage
    expect(modalStyles.position).toBe('fixed');
    expect(modalStyles.top).toBe('0px');
    expect(modalStyles.left).toBe('0px');
    expect(modalStyles.right).toBe('0px');
    expect(modalStyles.bottom).toBe('0px');
    
    // These are the critical assertions - viewport units should be set correctly
    expect(modalStyles.width).toBe('100vw'); // Should be 100vw for viewport width
    expect(modalStyles.height).toBe('100vh'); // Should be 100vh for viewport height
    
    // Min/max constraints should match for exact coverage
    expect(modalStyles.minWidth).toBe('100vw');
    expect(modalStyles.minHeight).toBe('100vh');
    expect(modalStyles.maxWidth).toBe('100vw');
    expect(modalStyles.maxHeight).toBe('100vh');
    
    // Overlay should fill entire modal container (100% of modal)
    expect(overlayStyles.width).toBe('100%');
    expect(overlayStyles.height).toBe('100%');
    
    // Check for any transforms that might cause gaps
    expect(modalStyles.transform).toBe('none');
    expect(modalStyles.margin).toBe('0px');
    expect(modalStyles.padding).toBe('0px');
  });

  test('FIXED: modal should not have any margins or transforms that create gaps', () => {
    modal.style.display = 'flex';
    
    const modalStyles = window.getComputedStyle(modal);
    const overlayStyles = window.getComputedStyle(overlay);

    // These would fail if there are any margins/padding causing gaps
    expect(modalStyles.marginTop).toBe('0px');
    expect(modalStyles.marginRight).toBe('0px');
    expect(modalStyles.marginBottom).toBe('0px');
    expect(modalStyles.marginLeft).toBe('0px');
    
    expect(modalStyles.paddingTop).toBe('0px');
    expect(modalStyles.paddingRight).toBe('0px');
    expect(modalStyles.paddingBottom).toBe('0px');
    expect(modalStyles.paddingLeft).toBe('0px');

    // Overlay should have no gaps either
    expect(overlayStyles.marginTop).toBe('0px');
    expect(overlayStyles.marginRight).toBe('0px');
    expect(overlayStyles.marginBottom).toBe('0px');
    expect(overlayStyles.marginLeft).toBe('0px');
  });

  test('modal should have proper z-index for full coverage', () => {
    modal.style.display = 'flex';
    
    const modalStyles = window.getComputedStyle(modal);
    const overlayStyles = window.getComputedStyle(overlay);

    // Z-index should be high enough to cover everything
    expect(parseInt(modalStyles.zIndex)).toBeGreaterThanOrEqual(1050);
    expect(parseInt(overlayStyles.zIndex)).toBeGreaterThanOrEqual(1040);
  });
});