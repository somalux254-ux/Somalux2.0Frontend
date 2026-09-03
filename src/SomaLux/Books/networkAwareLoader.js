// networkAwareLoader.js - Adaptive loading based on network conditions
// Automatically adjusts preview loading speed based on connection quality

export const useNetworkAwareLoader = () => {
  const [connection, setConnection] = React.useState(null);

  React.useEffect(() => {
    // Get initial connection quality
    if ('connection' in navigator) {
      const conn = navigator.connection;
      const effectiveType = conn.effectiveType; // 4g, 3g, 2g, slow-4g
      setConnection(effectiveType);

      // Listen for connection changes
      const handleChange = () => {
        setConnection(conn.effectiveType);
        console.log('Network changed to:', conn.effectiveType);
      };

      conn.addEventListener('change', handleChange);
      return () => conn.removeEventListener('change', handleChange);
    }
  }, []);

  // Get loader configuration based on network
  const getLoaderConfig = () => {
    switch (connection) {
      case '4g':
        return {
          maxConcurrentLoads: 2,
          delayBetweenLoads: 100,
          prioritizeVisible: true,
          description: '⚡ Fast (4G connection detected)'
        };
      case 'wifi':
      case '3g':
        return {
          maxConcurrentLoads: 1,
          delayBetweenLoads: 250,
          prioritizeVisible: true,
          description: '⚙️ Balanced (3G/WiFi connection)'
        };
      case 'slow-4g':
      case '2g':
        return {
          maxConcurrentLoads: 1,
          delayBetweenLoads: 500,
          prioritizeVisible: true,
          description: '🔋 Slow (2G/Slow-4G connection)'
        };
      default:
        return {
          maxConcurrentLoads: 1,
          delayBetweenLoads: 250,
          prioritizeVisible: true,
          description: '⚙️ Default (Unknown connection)'
        };
    }
  };

  // Check if user prefers reduced motion
  const prefersReducedMotion = React.useMemo(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Check battery status if available
  const [batteryLevel, setBatteryLevel] = React.useState(null);

  React.useEffect(() => {
    if ('getBattery' in navigator) {
      navigator.getBattery().then((battery) => {
        setBatteryLevel(battery.level);
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(battery.level);
        });
      });
    }
  }, []);

  // Determine if should enable power saving
  const shouldSavePower = batteryLevel !== null && batteryLevel < 0.2; // < 20% battery

  // Get final configuration
  const config = getLoaderConfig();

  if (shouldSavePower) {
    config.delayBetweenLoads = Math.max(config.delayBetweenLoads, 500);
    config.description += ' (Power Save Mode)';
  }

  if (prefersReducedMotion) {
    config.description += ' (Reduced Motion)';
  }

  return {
    config,
    connection,
    batteryLevel,
    shouldSavePower,
    prefersReducedMotion,
    connectionDescription: config.description
  };
};

// Example usage in component:
/*
const { config, connectionDescription } = useNetworkAwareLoader();

const { loadedPaperIds, markAsLoaded, progress } = useProgressivePDFLoader(
  displayedPapers,
  config
);

// Show user what mode is active
<div>{connectionDescription}</div>
*/

// ============================================================================
// ADVANCED: Memory-aware loader
// ============================================================================

export const useMemoryAwareLoader = () => {
  const [memoryInfo, setMemoryInfo] = React.useState(null);

  React.useEffect(() => {
    if ('memory' in performance) {
      const updateMemory = () => {
        const memory = performance.memory;
        setMemoryInfo({
          usedJSHeapSize: memory.usedJSHeapSize / 1048576, // Convert to MB
          totalJSHeapSize: memory.totalJSHeapSize / 1048576,
          jsHeapSizeLimit: memory.jsHeapSizeLimit / 1048576,
          percentUsed: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
        });
      };

      updateMemory();
      const timer = setInterval(updateMemory, 1000);
      return () => clearInterval(timer);
    }
  }, []);

  const getLoaderConfig = () => {
    if (!memoryInfo) {
      return { maxConcurrentLoads: 1, delayBetweenLoads: 250 };
    }

    const percentUsed = memoryInfo.percentUsed;

    if (percentUsed > 85) {
      // Memory pressure - slow down aggressively
      return {
        maxConcurrentLoads: 1,
        delayBetweenLoads: 1000,
        description: '⚠️ High Memory Usage - Slowing Down'
      };
    } else if (percentUsed > 70) {
      // Some memory pressure - moderate slowdown
      return {
        maxConcurrentLoads: 1,
        delayBetweenLoads: 500,
        description: '📊 Moderate Memory Usage'
      };
    } else {
      // Plenty of memory - normal speed
      return {
        maxConcurrentLoads: 1,
        delayBetweenLoads: 250,
        description: '✅ Memory Healthy'
      };
    }
  };

  return {
    memoryInfo,
    config: getLoaderConfig(),
    canLoadMore: !memoryInfo || memoryInfo.percentUsed < 80
  };
};

// ============================================================================
// UTILITY: Detect device capability
// ============================================================================

export const detectDeviceCapability = () => {
  const cores = navigator.hardwareConcurrency || 1;
  const ram = navigator.deviceMemory || 4; // GB
  const lowEndDevice = cores <= 2 && ram <= 2;
  const midRangeDevice = cores <= 4 && ram <= 4;
  const highEndDevice = cores > 4 && ram > 4;

  return {
    cores,
    ram,
    lowEndDevice,
    midRangeDevice,
    highEndDevice,
    recommendedConfig: lowEndDevice
      ? { maxConcurrentLoads: 1, delayBetweenLoads: 500 }
      : midRangeDevice
      ? { maxConcurrentLoads: 1, delayBetweenLoads: 250 }
      : { maxConcurrentLoads: 2, delayBetweenLoads: 100 }
  };
};

// Usage:
/*
const capability = detectDeviceCapability();
console.log(`Device: ${capability.cores} cores, ${capability.ram}GB RAM`);

const { loadedPaperIds, markAsLoaded } = useProgressivePDFLoader(
  displayedPapers,
  capability.recommendedConfig
);
*/

// ============================================================================
// COMBINED: Smart loader that uses all factors
// ============================================================================

export const useSmartPDFLoader = () => {
  const network = useNetworkAwareLoader();
  const memory = useMemoryAwareLoader();
  const device = detectDeviceCapability();

  // Combine all factors to determine best config
  const getOptimalConfig = () => {
    const configs = [
      network.config,
      memory.config,
      device.recommendedConfig
    ];

    // Use the most conservative config (slowest)
    const maxDelay = Math.max(
      ...configs.map(c => c.delayBetweenLoads || 250)
    );

    const minConcurrent = Math.min(
      ...configs.map(c => c.maxConcurrentLoads || 1)
    );

    return {
      maxConcurrentLoads: minConcurrent,
      delayBetweenLoads: maxDelay,
      prioritizeVisible: true
    };
  };

  return {
    config: getOptimalConfig(),
    network: network.connectionDescription,
    memory: memory.config.description,
    device: `${device.cores} cores, ${device.ram}GB RAM`,
    canLoadMore: memory.canLoadMore
  };
};

// Final usage:
/*
const smartLoader = useSmartPDFLoader();
console.log('Network:', smartLoader.network);
console.log('Memory:', smartLoader.memory);
console.log('Device:', smartLoader.device);

const { loadedPaperIds, markAsLoaded, progress } = useProgressivePDFLoader(
  displayedPapers,
  smartLoader.config
);
*/
