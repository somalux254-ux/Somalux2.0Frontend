/**
 * FeatureFlagsProvider & Context
 * Manages feature flags with auto-refresh, caching, and WebSocket updates
 * Similar to WhatsApp's feature distribution system
 * 
 * Gracefully handles backend failures with cached data and sensible defaults
 */

import React, { createContext, useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

export const FeatureFlagsContext = createContext();

const FEATURES_CACHE_KEY = 'app_features_cache';
const FEATURES_TIMESTAMP_KEY = 'app_features_timestamp';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

// Default features - used if backend fails and cache is empty
const DEFAULT_FEATURES = {
  // Book features
  secure_reader: { enabled: true, config: {}, version: 1 },
  pdf_download: { enabled: true, config: {}, version: 1 },
  book_sharing: { enabled: true, config: {}, version: 1 },
  
  // Past papers features
  past_papers: { enabled: true, config: {}, version: 1 },
  paper_download: { enabled: true, config: {}, version: 1 },
  
  // Admin features
  admin_dashboard: { enabled: true, config: {}, version: 1 },
  bulk_upload: { enabled: true, config: {}, version: 1 },
  auto_categorization: { enabled: false, config: {}, version: 1 },
  
  // UI features
  dark_mode: { enabled: true, config: {}, version: 1 },
  advanced_search: { enabled: true, config: {}, version: 1 },
};

export const FeatureFlagsProvider = ({ children }) => {
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const hasInitializedRef = useRef(false);

  /**
   * Fetch features from backend with comprehensive error handling
   */
  const fetchFeatures = useCallback(async () => {
    try {
      // Get user context if available (from localStorage or auth hook)
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      const params = {};
      if (user?.id) params.user_id = user.id;
      if (user?.tier) params.user_tier = user.tier;

      console.log('Fetching features from:', API_URL);
      
      let response;
      try {
        // Try main features endpoint
        response = await axios.get(
          `${API_URL}/api/features`,
          { params, timeout: 5000 }
        );
        console.log('✅ Features fetched from /api/features');
      } catch (mainError) {
        console.warn('⚠️ /api/features failed, trying simpler endpoint:', mainError.message);
        try {
          // Fallback to simple endpoint without DB queries
          response = await axios.get(
            `${API_URL}/api/features-simple`,
            { timeout: 3000 }
          );
          console.log('✅ Features fetched from /api/features-simple (fallback)');
        } catch (simpleError) {
          console.error('❌ Both /api/features and /api/features-simple failed');
          throw simpleError; // Proceed to cache/defaults
        }
      }

      const newFeatures = response.data.features || {};

      // Update cache only if we got valid features
      if (Object.keys(newFeatures).length > 0) {
        localStorage.setItem(FEATURES_CACHE_KEY, JSON.stringify(newFeatures));
        localStorage.setItem(FEATURES_TIMESTAMP_KEY, Date.now().toString());
        setFeatures(newFeatures);
        setError(null);
        console.log('✅ Features loaded from backend:', Object.keys(newFeatures).length);
      } else {
        // Empty response - use cache or defaults
        throw new Error('Backend returned empty features');
      }
      
      return newFeatures;
    } catch (err) {
      console.warn('⚠️ Failed to fetch features from backend:', err.message);
      
      // Try to use cached features
      const cachedFeatures = localStorage.getItem(FEATURES_CACHE_KEY);
      if (cachedFeatures) {
        try {
          const parsed = JSON.parse(cachedFeatures);
          setFeatures(parsed);
          setError('Using cached features');
          console.log('✅ Using cached features');
          return parsed;
        } catch (parseErr) {
          console.warn('Cache parse error:', parseErr);
        }
      }
      
      // Fall back to defaults
      console.log('Using default features (backend unavailable)');
      setFeatures(DEFAULT_FEATURES);
      setError('Backend unavailable - using default features');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Setup WebSocket for real-time feature updates (non-critical)
   * Disabled in production if not available to avoid blocking the app
   */
  const setupWebSocket = useCallback(() => {
    // Skip WebSocket setup in production on Render (which doesn't support it well)
    if (process.env.NODE_ENV === 'production' && window.location.hostname !== 'localhost') {
      console.log('⏭️ WebSocket skipped (not available in production)');
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return; // Already connected
      }

      const ws = new WebSocket(wsUrl);
      let connectTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.warn('WebSocket connection timeout');
          ws.close();
        }
      }, 3000);

      ws.onopen = () => {
        clearTimeout(connectTimeout);
        console.log('✅ Feature flags WebSocket connected');
        wsRef.current = ws;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'feature_update') {
            console.log('📢 Feature update received:', message.feature);
            fetchFeatures();
          }
        } catch (err) {
          console.warn('WebSocket message parse error:', err);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(connectTimeout);
        console.warn('⚠️ Feature flags WebSocket error (non-critical):', error?.type);
        // Don't fail the app - just log the warning
      };

      ws.onclose = () => {
        clearTimeout(connectTimeout);
        console.log('Feature flags WebSocket disconnected');
        wsRef.current = null;
        // Reconnect after 5 seconds (non-critical)
        setTimeout(setupWebSocket, 5000);
      };

      wsRef.current = ws;
    } catch (err) {
      console.warn('WebSocket setup failed (non-critical):', err);
      // Don't fail - WebSocket is optional for feature flags
    }
  }, [fetchFeatures]);

  /**
   * Initialize features on mount
   */
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    // Try to load from cache first (instant)
    const cachedFeatures = localStorage.getItem(FEATURES_CACHE_KEY);
    const timestamp = localStorage.getItem(FEATURES_TIMESTAMP_KEY);
    const now = Date.now();

    if (cachedFeatures && timestamp && (now - parseInt(timestamp)) < CACHE_DURATION) {
      try {
        const parsed = JSON.parse(cachedFeatures);
        setFeatures(parsed);
        setLoading(false);
        console.log('✅ Loaded features from cache instantly');
      } catch (parseErr) {
        console.warn('Cache parse error:', parseErr);
      }
    } else if (cachedFeatures) {
      try {
        const parsed = JSON.parse(cachedFeatures);
        setFeatures(parsed);
        console.log('⚡ Loaded stale features from cache');
      } catch (parseErr) {
        console.warn('Cache parse error:', parseErr);
      }
    } else {
      // No cache - use defaults immediately
      setFeatures(DEFAULT_FEATURES);
      console.log('📦 Using default features');
    }

    // Fetch fresh features from backend (non-blocking)
    fetchFeatures();

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {
          // Ignore close errors
        }
      }
    };
  }, [fetchFeatures, setupWebSocket]);

  /**
   * Manual refresh function for components
   */
  const refreshFeatures = useCallback(async () => {
    setLoading(true);
    await fetchFeatures();
  }, [fetchFeatures]);

  /**
   * Check if a feature is enabled
   */
  const isFeatureEnabled = useCallback((featureKey) => {
    return features[featureKey]?.enabled || false;
  }, [features]);

  /**
   * Get feature config
   */
  const getFeatureConfig = useCallback((featureKey) => {
    return features[featureKey]?.config || {};
  }, [features]);

  const value = {
    features,
    loading,
    error,
    isFeatureEnabled,
    getFeatureConfig,
    refreshFeatures,
  };

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export default FeatureFlagsContext;
