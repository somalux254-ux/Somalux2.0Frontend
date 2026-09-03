/**
 * downloadFolderManager.js - Utility for managing download folder preferences
 * 
 * Features:
 * - Store selected folder path in localStorage
 * - Get current selected folder
 * - List available folders
 * - Create new folders
 * - Manage folder history
 */

import { API_URL as API_BASE } from '../../config';

const DOWNLOAD_FOLDER_KEY = 'selectedDownloadFolder';
const DOWNLOAD_FOLDERS_HISTORY_KEY = 'downloadFoldersHistory';
const CUSTOM_FOLDERS_KEY = 'customDownloadFolders';
const DEFAULT_FOLDER = 'Downloads';

/**
 * Get the currently selected download folder
 * @returns {string} The selected folder path
 */
export const getSelectedFolder = () => {
  try {
    const folder = localStorage.getItem(DOWNLOAD_FOLDER_KEY);
    return folder || DEFAULT_FOLDER;
  } catch (err) {
    console.warn('Error reading selected folder:', err);
    return DEFAULT_FOLDER;
  }
};

/**
 * Set the selected download folder
 * @param {string} folderPath - The folder path to select
 */
export const setSelectedFolder = (folderPath) => {
  try {
    localStorage.setItem(DOWNLOAD_FOLDER_KEY, folderPath);
    addToFolderHistory(folderPath);
  } catch (err) {
    console.warn('Error saving selected folder:', err);
  }
};

/**
 * Get the folder selection history
 * @returns {string[]} Array of previously selected folders
 */
export const getFolderHistory = () => {
  try {
    const history = localStorage.getItem(DOWNLOAD_FOLDERS_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (err) {
    console.warn('Error reading folder history:', err);
    return [];
  }
};

/**
 * Add a folder to the selection history
 * @param {string} folderPath - The folder path to add
 */
export const addToFolderHistory = (folderPath) => {
  try {
    const history = getFolderHistory();
    // Remove if already exists, then add to beginning
    const filtered = history.filter(f => f !== folderPath);
    const updated = [folderPath, ...filtered].slice(0, 10); // Keep last 10
    localStorage.setItem(DOWNLOAD_FOLDERS_HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Error updating folder history:', err);
  }
};

/**
 * Clear the folder selection history
 */
export const clearFolderHistory = () => {
  try {
    localStorage.removeItem(DOWNLOAD_FOLDERS_HISTORY_KEY);
  } catch (err) {
    console.warn('Error clearing folder history:', err);
  }
};

/**
 * Get custom folders from localStorage
 * @returns {Array} Array of custom folder objects
 */
export const getCustomFolders = () => {
  try {
    const customFolders = localStorage.getItem(CUSTOM_FOLDERS_KEY);
    return customFolders ? JSON.parse(customFolders) : [];
  } catch (err) {
    console.warn('Error reading custom folders:', err);
    return [];
  }
};

/**
 * Add a custom folder to localStorage
 * @param {string} folderPath - The folder path
 * @param {string} folderName - The folder name (optional)
 */
export const addCustomFolder = (folderPath, folderName = null) => {
  try {
    const customFolders = getCustomFolders();
    
    // Check if folder already exists
    const exists = customFolders.some(f => f.path === folderPath);
    if (exists) {
      console.warn(`Folder already exists: ${folderPath}`);
      return;
    }
    
    const name = folderName || getFolderName(folderPath);
    const newFolder = {
      name,
      path: folderPath,
      size: 0,
      created: new Date().toISOString()
    };
    
    const updated = [...customFolders, newFolder];
    localStorage.setItem(CUSTOM_FOLDERS_KEY, JSON.stringify(updated));
    console.log(`✓ Custom folder added: ${folderPath}`);
  } catch (err) {
    console.warn('Error adding custom folder:', err);
  }
};

/**
 * Remove a custom folder from localStorage
 * @param {string} folderPath - The folder path to remove
 */
export const removeCustomFolder = (folderPath) => {
  try {
    const customFolders = getCustomFolders();
    const filtered = customFolders.filter(f => f.path !== folderPath);
    localStorage.setItem(CUSTOM_FOLDERS_KEY, JSON.stringify(filtered));
    console.log(`✓ Custom folder removed: ${folderPath}`);
  } catch (err) {
    console.warn('Error removing custom folder:', err);
  }
};

/**
 * Fetch available download folders from backend
 * @returns {Promise<Array>} Array of available folders
 */
export const fetchAvailableFolders = async () => {
  try {
    const defaultFolders = getDefaultFolders();
    const customFolders = getCustomFolders();
    
    // Combine default and custom folders
    const allFolders = [...defaultFolders, ...customFolders];
    
    // Try to fetch from API to see if there are any additional folders
    try {
      const response = await fetch(`${API_BASE}/api/elib/download-folders`);
      
      // Check if response is OK and is JSON
      if (!response.ok) {
        console.warn('Folder API returned status:', response.status);
        return allFolders;
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('Folder API returned non-JSON content, using defaults');
        return allFolders;
      }
      
      const data = await response.json();
      
      if (data.ok && Array.isArray(data.folders)) {
        // Merge API folders with custom folders
        return [...data.folders, ...customFolders];
      }
    } catch (apiErr) {
      console.warn('API fetch failed, using local folders:', apiErr.message);
    }
    
    return allFolders;
  } catch (err) {
    console.warn('Error fetching folders:', err.message);
    return getDefaultFolders();
  }
};

/**
 * Get default folders
 * @returns {Array} Array of default folders
 */
export const getDefaultFolders = () => {
  return [
    { name: 'Downloads', path: 'Downloads', size: 0 },
    { name: 'Documents', path: 'Documents', size: 0 },
    { name: 'Books', path: 'Books', size: 0 },
    { name: 'Past Papers', path: 'Past Papers', size: 0 },
    { name: 'Research', path: 'Research', size: 0 }
  ];
};

/**
 * Create a new download folder
 * @param {string} folderName - Name of the new folder
 * @param {string} parentFolder - Parent folder path (optional)
 * @returns {Promise<Object>} Created folder info or error
 */
export const createDownloadFolder = async (folderName, parentFolder = null) => {
  try {
    const response = await fetch(`${API_BASE}/api/elib/download-folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folderName: folderName.trim(),
        parentFolder: parentFolder || getSelectedFolder()
      })
    });

    const data = await response.json();
    
    if (data.ok) {
      setSelectedFolder(data.folderPath);
      return { ok: true, folderPath: data.folderPath, folder: data.folder };
    } else {
      return { ok: false, error: data.error || 'Failed to create folder' };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

/**
 * Validate if a folder path is accessible
 * @param {string} folderPath - The folder path to validate
 * @returns {Promise<boolean>} True if folder is accessible
 */
export const validateFolder = async (folderPath) => {
  try {
    const response = await fetch(`${API_BASE}/api/elib/download-folders/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath })
    });

    const data = await response.json();
    return data.ok || false;
  } catch (err) {
    console.error('Error validating folder:', err);
    return false;
  }
};

/**
 * Get user's folder preferences
 * @returns {Promise<Object>} User's folder preferences
 */
export const getUserFolderPreferences = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/elib/download-folders/preferences`);
    const data = await response.json();
    
    if (data.ok) {
      return data.preferences;
    } else {
      return { defaultFolder: DEFAULT_FOLDER, folders: [] };
    }
  } catch (err) {
    console.error('Error fetching preferences:', err);
    return { defaultFolder: DEFAULT_FOLDER, folders: [] };
  }
};

/**
 * Save user's folder preferences
 * @param {Object} preferences - Folder preferences
 * @returns {Promise<boolean>} Success status
 */
export const saveUserFolderPreferences = async (preferences) => {
  try {
    const response = await fetch(`${API_BASE}/api/elib/download-folders/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences)
    });

    const data = await response.json();
    return data.ok || false;
  } catch (err) {
    console.error('Error saving preferences:', err);
    return false;
  }
};

/**
 * Format folder path for display
 * @param {string} folderPath - The folder path to format
 * @returns {string} Formatted folder path
 */
export const formatFolderPath = (folderPath) => {
  if (!folderPath) return DEFAULT_FOLDER;
  
  // Replace backslashes with forward slashes
  let formatted = folderPath.replace(/\\/g, '/');
  
  // Remove leading/trailing slashes
  formatted = formatted.replace(/^\/+|\/+$/g, '');
  
  // Collapse multiple slashes
  formatted = formatted.replace(/\/+/g, '/');
  
  return formatted || DEFAULT_FOLDER;
};

/**
 * Get folder name from path
 * @param {string} folderPath - The folder path
 * @returns {string} Folder name (last segment)
 */
export const getFolderName = (folderPath) => {
  if (!folderPath) return DEFAULT_FOLDER;
  const parts = folderPath.split('/').filter(p => p);
  return parts[parts.length - 1] || DEFAULT_FOLDER;
};

/**
 * Build a folder path from parent and child
 * @param {string} parentFolder - Parent folder path
 * @param {string} childFolder - Child folder name
 * @returns {string} Combined folder path
 */
export const buildFolderPath = (parentFolder, childFolder) => {
  if (!parentFolder) return childFolder;
  if (!childFolder) return parentFolder;
  
  return `${parentFolder.replace(/\/+$/, '')}/${childFolder}`;
};
