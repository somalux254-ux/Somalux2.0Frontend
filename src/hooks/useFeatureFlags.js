/**
 * useFeatureFlags Hook
 * React hook for accessing feature flags throughout the app
 * Handles auto-refresh, caching, and real-time updates via WebSocket
 */

import { useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './useAuth'; // Your existing auth hook
import FeatureFlagsContext from '../context/FeatureFlagsContext';

export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagsContext);

  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagsProvider');
  }

  return context;
};

/**
 * Hook to check if a specific feature is enabled
 */
export const useFeatureFlag = (featureKey) => {
  const { features } = useFeatureFlags();
  
  return {
    enabled: features[featureKey]?.enabled || false,
    config: features[featureKey]?.config || {},
    version: features[featureKey]?.version,
  };
};

/**
 * Hook for conditional rendering based on feature availability
 */
export const useFeatureGate = (featureKey) => {
  const { enabled } = useFeatureFlag(featureKey);
  return enabled;
};

export default useFeatureFlags;
