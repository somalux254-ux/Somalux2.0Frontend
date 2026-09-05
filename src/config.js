// Centralized configuration for API endpoints
const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
const defaultApiUrl = 'https://somalux-backend-xfq9.onrender.com';
export const API_URL = process.env.REACT_APP_API_URL || defaultApiUrl;

console.log('🔧 API Configuration:', {
  NODE_ENV: process.env.NODE_ENV,
  isDevelopment,
  defaultApiUrl,
  API_URL: API_URL,
  REACT_APP_API_URL: process.env.REACT_APP_API_URL,
  isProduction: process.env.NODE_ENV === 'production'
});
