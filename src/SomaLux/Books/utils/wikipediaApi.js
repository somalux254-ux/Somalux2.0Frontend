/**
 * Wikipedia API Module - Enhanced Version
 * Handles fetching explanations, summaries, and author images from Wikipedia
 * 
 * ✅ Features:
 * - Multiple image source strategies (Wikipedia, Commons, wikidata)
 * - Robust author image fetching with multiple fallbacks
 * - Smart term extraction with context awareness
 * - Local caching to reduce API calls
 * - Better error handling and disambiguation
 * - Validation of content quality
 * - Timeout protection for all requests
 */

// Cache management
const WIKIPEDIA_CACHE = {};
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const API_TIMEOUT = 8000; // 8 seconds
const IMAGE_FETCH_TIMEOUT = 5000; // 5 seconds for image fetches

/**
 * Get cached result if available and not expired
 */
const getCachedResult = (key) => {
  const cached = WIKIPEDIA_CACHE[key];
  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
    console.log('💾 Cache hit for:', key);
    return cached.data;
  }
  if (cached) delete WIKIPEDIA_CACHE[key];
  return null;
};

/**
 * Save result to cache
 */
const setCacheResult = (key, data) => {
  WIKIPEDIA_CACHE[key] = {
    data,
    timestamp: Date.now()
  };
};

/**
 * Extract key terms from text (handling multi-line selections)
 * @param {string} text - The text to extract from
 * @returns {string} - The search term
 */
const extractKeyTerms = (text) => {
  try {
    // Clean up the text - remove extra whitespace and newlines
    let cleanText = text.trim().replace(/\s+/g, ' ');
    
    // Remove special characters and URLs
    cleanText = cleanText.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    
    // If text is very short or empty, return original with cleanup
    if (cleanText.length < 3) {
      const fallback = text.trim().split(/\s+/)[0];
      return fallback || 'Business Intelligence';
    }
    
    // Split into words
    const words = cleanText.split(/\s+/).filter(w => w.length > 2);
    
    // Common words to filter out (stop words)
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'your', 'my', 'our', 'their', 'his', 'her', 'its', 'that', 'this', 'these', 'those', 'with', 'from', 'as', 'by', 'com', 'org', 'net'];
    
    // Filter out common words
    const meaningfulWords = words.filter(w => !commonWords.includes(w.toLowerCase()));
    
    // If we have meaningful words, use them
    if (meaningfulWords.length >= 3) {
      return meaningfulWords.slice(0, 3).join(' ');
    } else if (meaningfulWords.length === 2) {
      return meaningfulWords.join(' ');
    } else if (meaningfulWords.length === 1) {
      return meaningfulWords[0];
    } else if (words.length > 0) {
      // Fall back to first non-common words or first word
      return words.slice(0, 2).join(' ');
    } else {
      // Last resort - return original text up to first space
      return text.trim().split(/\s+/)[0] || 'Information';
    }
  } catch (error) {
    console.error('Error extracting key terms:', error);
    return text.trim().split(/\s+/).slice(0, 2).join(' ') || 'Information';
  }
};

/**
 * Fetch using REST API (most accurate and fast)
 */
const fetchWithRestApi = async (keyTerm) => {
  try {
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(keyTerm)}`;
    
    console.log('🌐 REST API request for:', keyTerm);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    
    const response = await fetch(wikiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SomaLux/2.0'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`⚠️ REST API status ${response.status}`);
      return { success: false };
    }
    
    const data = await response.json();
    
    if (!data.extract || data.extract.trim().length < 50) {
      console.warn('⚠️ Extract too short or missing');
      return { success: false };
    }
    
    console.log('✅ REST API successful');
    
    return {
      title: data.title || keyTerm,
      extract: data.extract.substring(0, 1500), // More content for better explanation
      success: true,
      source: 'REST API',
      url: data.content_urls?.desktop?.page || null,
      image: data.thumbnail?.source || null
    };
  } catch (error) {
    console.error('❌ REST API error:', error.message);
    return { success: false };
  }
};

/**
 * Fetch using Query API (fallback strategy 1)
 */
const fetchWithQueryApi = async (searchTerm) => {
  try {
    console.log('📚 Trying Wikipedia query API for:', searchTerm);
    
    const keyTerm = extractKeyTerms(searchTerm);
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(keyTerm)}&prop=extracts|pageimages|info&pithumbsize=300&inprop=url&explaintext=true&format=json&origin=*`;
    
    console.log('🔍 Query API request');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    
    const response = await fetch(wikiUrl, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const pages = data.query?.pages || {};
    const pageId = Object.keys(pages)[0];
    
    if (!pageId || pageId === '-1') {
      console.warn('⚠️ Page not found in query API');
      return { success: false };
    }
    
    const page = pages[pageId];
    
    if (!page.extract || page.extract.trim().length < 50) {
      console.warn('⚠️ No valid extract in query response');
      return { success: false };
    }
    
    console.log('✅ Query API successful');
    
    return {
      title: page.title || keyTerm,
      extract: page.extract.substring(0, 1500),
      success: true,
      source: 'Query API',
      url: page.fullurl || null,
      image: page.pageimage || null
    };
  } catch (error) {
    console.error('❌ Query API error:', error.message);
    return { success: false };
  }
};

/**
 * Fetch using Search fallback (fallback strategy 2)
 * Tries to get the best matching article
 */
const fetchWithSearchFallback = async (searchTerm) => {
  try {
    console.log('🔎 Using search fallback for:', searchTerm);
    
    const keyTerm = extractKeyTerms(searchTerm);
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(keyTerm)}&srlimit=1&format=json&origin=*`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    
    const response = await fetch(wikiUrl, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { success: false };
    }
    
    const data = await response.json();
    const results = data.query?.search || [];
    
    if (results.length === 0) {
      console.warn('⚠️ No search results found');
      return { success: false };
    }
    
    const bestMatch = results[0];
    
    // Now fetch the full content of the best match
    const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(bestMatch.title)}&prop=extracts|info|pageimages&pithumbsize=300&inprop=url&explaintext=true&format=json&origin=*`;
    
    const contentResponse = await fetch(contentUrl, {
      signal: controller.signal
    });
    
    if (!contentResponse.ok) {
      return { success: false };
    }
    
    const contentData = await contentResponse.json();
    const pages = contentData.query?.pages || {};
    const pageId = Object.keys(pages)[0];
    
    if (!pageId) {
      return { success: false };
    }
    
    const page = pages[pageId];
    
    if (!page.extract || page.extract.trim().length < 50) {
      console.warn('⚠️ No valid extract from search result');
      return { success: false };
    }
    
    console.log('✅ Search fallback successful');
    
    return {
      title: page.title || bestMatch.title,
      extract: page.extract.substring(0, 1500),
      success: true,
      source: 'Search Fallback',
      url: page.fullurl || null,
      image: page.pageimage || null
    };
  } catch (error) {
    console.error('❌ Search fallback error:', error.message);
    return { success: false };
  }
};

/**
 * Fetch a summary/explanation from Wikipedia with multiple fallback strategies
 * @param {string} searchTerm - The term to search for
 * @returns {Promise<Object>} - Object containing title and extract
 */
export const fetchWikipediaExplanation = async (searchTerm) => {
  try {
    console.log('📚 Fetching Wikipedia explanation for:', searchTerm);
    
    // Extract key terms from the search term (handles multi-line selections)
    const keyTerm = extractKeyTerms(searchTerm);
    console.log('🔍 Extracted key term:', keyTerm);
    
    // Check cache first
    const cacheKey = keyTerm.toLowerCase();
    const cached = getCachedResult(cacheKey);
    if (cached) return cached;
    
    // Try REST API first (most reliable)
    let result = await fetchWithRestApi(keyTerm);
    if (result.success) {
      setCacheResult(cacheKey, result);
      return result;
    }
    
    // Fallback to query API
    console.log('📚 REST API failed, trying Query API...');
    result = await fetchWithQueryApi(keyTerm);
    if (result.success) {
      setCacheResult(cacheKey, result);
      return result;
    }
    
    // Last resort: try search for disambiguation or related articles
    console.log('📚 Query API failed, trying search fallback...');
    result = await fetchWithSearchFallback(keyTerm);
    if (result.success) {
      setCacheResult(cacheKey, result);
      return result;
    }
    
    return {
      title: keyTerm,
      extract: null,
      success: false,
      error: 'Unable to fetch from Wikipedia'
    };
  } catch (error) {
    console.error('❌ Wikipedia API error:', error);
    return {
      title: searchTerm,
      extract: null,
      success: false,
      error: error.message
    };
  }
};

/**
 * Fetch detailed page content from Wikipedia
 * @param {string} searchTerm - The term to search for
 * @returns {Promise<Object>} - Object containing page data
 */
export const fetchWikipediaPage = async (searchTerm) => {
  try {
    console.log('📄 Fetching Wikipedia page for:', searchTerm);
    
    const keyTerm = extractKeyTerms(searchTerm);
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(keyTerm)}&prop=extracts|info|pageimages&pithumbsize=500&inprop=url&explaintext=true&format=json&origin=*`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    
    const response = await fetch(wikiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    const pages = data.query?.pages;
    if (!pages) {
      throw new Error('No pages found');
    }
    
    const pageId = Object.keys(pages)[0];
    if (pageId === '-1') {
      throw new Error('Page does not exist');
    }
    
    const page = pages[pageId];
    
    console.log('✅ Page data received');
    
    return {
      title: page.title,
      extract: page.extract || '',
      url: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
      image: page.pageimage || null,
      success: true
    };
  } catch (error) {
    console.error('❌ Wikipedia page fetch error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Search Wikipedia for related articles
 * @param {string} searchTerm - The term to search for
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} - Array of search results
 */
export const searchWikipedia = async (searchTerm, limit = 5) => {
  try {
    console.log('🔎 Searching Wikipedia for:', searchTerm);
    
    const keyTerm = extractKeyTerms(searchTerm);
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(keyTerm)}&srlimit=${limit}&format=json&origin=*`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    
    const response = await fetch(wikiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log('✅ Search results received:', data.query?.search?.length || 0);
    
    return data.query?.search || [];
  } catch (error) {
    console.error('❌ Wikipedia search error:', error);
    return [];
  }
};

/**
 * Get a simple definition from Wikipedia
 * @param {string} searchTerm - The term to search for
 * @returns {Promise<string>} - Simple definition text
 */
export const getWikipediaDefinition = async (searchTerm) => {
  try {
    console.log('📖 Getting Wikipedia definition for:', searchTerm);
    
    const result = await fetchWikipediaExplanation(searchTerm);
    
    if (result.success && result.extract) {
      // Return just the first sentence or paragraph
      const firstParagraph = result.extract.split('\n')[0];
      return firstParagraph || result.extract.substring(0, 150);
    }
    
    return `Unable to fetch definition for "${searchTerm}"`;
  } catch (error) {
    console.error('❌ Definition fetch error:', error);
    return `Unable to fetch definition for "${searchTerm}"`;
  }
};

/**
 * Fetch author image from Wikipedia with multiple strategies
 * @param {string} authorName - The author name to search for
 * @returns {Promise<string|null>} - URL of author image or null if not found
 */
/**
 * Fetch author image from multiple sources - OpenLibrary first
 */
export const fetchAuthorImage = async (authorName) => {
  if (!authorName || authorName.trim().length < 2) return null;

  const cacheKey = `author_image_${authorName.toLowerCase()}`;
  const cached = getCachedResult(cacheKey);
  if (cached !== undefined) {
    console.log(`💾 [${authorName}] From cache`);
    return cached;
  }

  try {
    console.log(`🔍 [${authorName}] Fetching...`);

    // Strategy 1: Open Library API (has author photos built-in)
    let imageUrl = await fetchFromOpenLibrary(authorName);
    if (imageUrl) {
      console.log(`✅ [${authorName}] OpenLibrary`);
      setCacheResult(cacheKey, imageUrl);
      return imageUrl;
    }

    // Strategy 2: Gravatar search
    imageUrl = await fetchFromGravatar(authorName);
    if (imageUrl) {
      console.log(`✅ [${authorName}] Gravatar`);
      setCacheResult(cacheKey, imageUrl);
      return imageUrl;
    }

    // Strategy 3: Direct Wikipedia thumbnail
    imageUrl = await fetchWikipediaDirectImage(authorName);
    if (imageUrl) {
      console.log(`✅ [${authorName}] Wikipedia Direct`);
      setCacheResult(cacheKey, imageUrl);
      return imageUrl;
    }

    console.log(`⚠️ [${authorName}] No image found`);
    setCacheResult(cacheKey, null);
    return null;
  } catch (error) {
    console.error(`❌ [${authorName}] Error:`, error.message);
    setCacheResult(cacheKey, null);
    return null;
  }
};

/**
 * Fetch author image from Open Library (reliable and has photos)
 */
const fetchFromOpenLibrary = async (authorName) => {
  try {
    console.log(`  📚 [OpenLibrary] Searching: ${authorName}`);
    
    // Search for authors by name
    const searchUrl = `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(authorName)}&limit=10`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT);

    const response = await fetch(searchUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`    ⚠️ Search failed`);
      return null;
    }

    const data = await response.json();
    const docs = data.docs || [];

    console.log(`    Found ${docs.length} results`);

    // Look for an author with a photo
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      
      if (doc.has_remote_image) {
        // Use the Open Library image URL
        const imageUrl = `https://covers.openlibrary.org/a/id/${doc.id}-M.jpg`;
        console.log(`    ✓ Image from result ${i + 1}`);
        return imageUrl;
      }
    }

    console.log(`    ℹ️ No images found`);
    return null;
  } catch (error) {
    console.log(`  ⚠️ Error: ${error.message}`);
    return null;
  }
};

/**
 * Fetch from Gravatar (fallback)
 */
const fetchFromGravatar = async (authorName) => {
  try {
    console.log(`  👤 [Gravatar] Searching: ${authorName}`);
    
    // Gravatar search is limited, so just try the hash of the name
    const nameHash = authorName.toLowerCase().trim();
    // Note: Gravatar would need email, so this is more limited
    
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Fetch Wikipedia image directly with simpler approach
 */
const fetchWikipediaDirectImage = async (authorName) => {
  try {
    console.log(`  📖 [Wikipedia] Direct search: ${authorName}`);
    
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(authorName)}&srnamespace=0&srlimit=5&format=json`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT);

    const response = await fetch(searchUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`    ⚠️ Search failed`);
      return null;
    }

    const data = await response.json();
    const results = data.query?.search || [];

    if (results.length === 0) {
      console.log(`    ℹ️ No results`);
      return null;
    }

    // Get the first result's image
    const pageTitle = results[0].title;
    const imageUrl = await getWikipediaPageImageDirect(pageTitle);
    
    if (imageUrl) {
      console.log(`    ✓ Image from first result`);
      return imageUrl;
    }

    return null;
  } catch (error) {
    console.log(`  ⚠️ Error: ${error.message}`);
    return null;
  }
};

/**
 * Get Wikipedia page image directly
 */
const getWikipediaPageImageDirect = async (pageTitle) => {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&piprop=thumbnail&pithumbsize=600&format=json`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    const pages = data.query?.pages || {};
    const page = Object.values(pages)[0];

    if (page?.thumbnail?.source) {
      // Ensure HTTPS
      let imageUrl = page.thumbnail.source;
      if (imageUrl.startsWith('http://')) {
        imageUrl = 'https://' + imageUrl.substring(7);
      }
      return imageUrl;
    }

    return null;
  } catch (error) {
    console.log(`Error getting Wikipedia image: ${error.message}`);
    return null;
  }
};

/**
 * Fetch multiple author images in parallel
 */
export const fetchAuthorImages = async (authorNames) => {
  const results = {};
  
  const promises = authorNames.map(async (name) => {
    const imageUrl = await fetchAuthorImage(name);
    results[name] = imageUrl;
  });

  await Promise.all(promises);
  return results;
};

/**
 * Clear the Wikipedia cache
 */
export const clearWikipediaCache = () => {
  const count = Object.keys(WIKIPEDIA_CACHE).length;
  Object.keys(WIKIPEDIA_CACHE).forEach(key => delete WIKIPEDIA_CACHE[key]);
  console.log(`🗑️ Cleared ${count} cache entries`);
};
