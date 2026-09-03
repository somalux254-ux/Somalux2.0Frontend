/**
 * Device Detection Utility
 * Detects device type and input method for adaptive UI
 */

export const DeviceDetection = {
  /**
   * Check if device is mobile
   * @returns {boolean}
   */
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || window.innerWidth <= 768;
  },

  /**
   * Check if device supports touch
   * @returns {boolean}
   */
  isTouch() {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0
    );
  },

  /**
   * Check if device is tablet
   * @returns {boolean}
   */
  isTablet() {
    const ua = navigator.userAgent;
    return (
      /(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua) ||
      (window.innerWidth >= 768 && window.innerWidth <= 1024)
    );
  },

  /**
   * Check if device is desktop
   * @returns {boolean}
   */
  isDesktop() {
    return !this.isMobile() && !this.isTablet();
  },

  /**
   * Get primary input method
   * @returns {'touch'|'mouse'|'hybrid'}
   */
  getInputMethod() {
    if (this.isTouch() && this.isMobile()) {
      return 'touch'; // Mobile touch
    } else if (this.isTouch() && !this.isMobile()) {
      return 'hybrid'; // Desktop with touch (Surface, touchscreen laptops)
    } else {
      return 'mouse'; // Desktop mouse/trackpad
    }
  },

  /**
   * Get device type
   * @returns {'mobile'|'tablet'|'desktop'}
   */
  getDeviceType() {
    if (this.isMobile()) return 'mobile';
    if (this.isTablet()) return 'tablet';
    return 'desktop';
  },

  /**
   * Check if device is iOS
   * @returns {boolean}
   */
  isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  },

  /**
   * Check if device is Android
   * @returns {boolean}
   */
  isAndroid() {
    return /Android/i.test(navigator.userAgent);
  },

  /**
   * Get screen size category
   * @returns {'small'|'medium'|'large'|'xlarge'}
   */
  getScreenSize() {
    const width = window.innerWidth;
    if (width < 640) return 'small';
    if (width < 1024) return 'medium';
    if (width < 1440) return 'large';
    return 'xlarge';
  },

  /**
   * Check if device supports vibration
   * @returns {boolean}
   */
  supportsVibration() {
    return 'vibrate' in navigator;
  },

  /**
   * Vibrate device (if supported)
   * @param {number|number[]} pattern - Vibration pattern in ms
   */
  vibrate(pattern = 50) {
    if (this.supportsVibration()) {
      navigator.vibrate(pattern);
    }
  },

  /**
   * Get optimal gesture configuration based on device
   * @returns {Object} Gesture config
   */
  getGestureConfig() {
    const inputMethod = this.getInputMethod();
    
    if (inputMethod === 'touch') {
      return {
        longPressDuration: 500, // ms
        swipeThreshold: 60, // px
        swipeMaxDistance: 100, // px
        enableSwipe: true,
        enableLongPress: true,
        enableRightClick: false,
        enableDoubleClick: false,
      };
    } else if (inputMethod === 'hybrid') {
      return {
        longPressDuration: 500,
        swipeThreshold: 60,
        swipeMaxDistance: 100,
        enableSwipe: true,
        enableLongPress: true,
        enableRightClick: true,
        enableDoubleClick: true,
      };
    } else {
      return {
        longPressDuration: 0,
        swipeThreshold: 0,
        swipeMaxDistance: 0,
        enableSwipe: false,
        enableLongPress: false,
        enableRightClick: true,
        enableDoubleClick: true,
      };
    }
  },

  /**
   * Log device information (for debugging)
   */
  logDeviceInfo() {
    console.log('🔍 Device Detection:', {
      userAgent: navigator.userAgent,
      isMobile: this.isMobile(),
      isTablet: this.isTablet(),
      isDesktop: this.isDesktop(),
      isTouch: this.isTouch(),
      inputMethod: this.getInputMethod(),
      deviceType: this.getDeviceType(),
      isIOS: this.isIOS(),
      isAndroid: this.isAndroid(),
      screenSize: this.getScreenSize(),
      supportsVibration: this.supportsVibration(),
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      gestureConfig: this.getGestureConfig(),
    });
  }
};

// Export as default
export default DeviceDetection;
