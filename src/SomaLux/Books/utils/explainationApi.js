/**
 * Comprehensive Explanation API Module
 * Uses multiple sources: Backend API, Dictionary API, Wiktionary, and Wikipedia
 * Plus contextual analysis for better explanations
 * 
 * ✅ SECURITY: No hardcoded API keys
 * ✅ PERFORMANCE: Request timeouts and caching
 * ✅ QUALITY: Multi-source fallback chain
 */

import { getContextualExplanation } from './contextualExplainer.js';

// Configuration
const API_TIMEOUT = 5000; // 5 seconds
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours
const CACHE_PREFIX = 'explanation_cache_';

/**
 * Cache management functions
 */
const getCacheKey = (searchTerm) => {
  return CACHE_PREFIX + searchTerm.toLowerCase().trim();
};

const getFromCache = (searchTerm) => {
  try {
    const key = getCacheKey(searchTerm);
    const cached = localStorage.getItem(key);
    
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    
    // Check if cache is expired
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    
    console.log('💾 Cache hit for:', searchTerm);
    return data;
  } catch (error) {
    console.error('Cache retrieval error:', error);
    return null;
  }
};

const saveToCache = (searchTerm, data) => {
  try {
    const key = getCacheKey(searchTerm);
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
    console.log('💾 Cached explanation for:', searchTerm);
  } catch (error) {
    console.error('Cache save error:', error);
    // Continue execution even if caching fails
  }
};

/**
 * Fetch with timeout
 */
const fetchWithTimeout = (url, options = {}, timeout = API_TIMEOUT) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
};

/**
 * Extract key terms from text - IMPROVED for long paragraphs
 */
const extractKeyTerms = (text) => {
  try {
    let cleanText = text.trim().replace(/\s+/g, ' ');
    
    // For long text (paragraphs), use smarter extraction
    if (cleanText.length > 200) {
      console.log('📖 Long paragraph detected, extracting main topic...');
      return extractMainTopicFromParagraph(cleanText);
    }
    
    cleanText = cleanText.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    
    if (cleanText.length < 3) {
      const fallback = text.trim().split(/\s+/)[0];
      return fallback || 'concept';
    }
    
    const words = cleanText.split(/\s+/).filter(w => w.length > 2);
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'your', 'my', 'our', 'their', 'his', 'her', 'its', 'that', 'this', 'these', 'those', 'with', 'from', 'as', 'by', 'com', 'org', 'net'];
    
    const meaningfulWords = words.filter(w => !commonWords.includes(w.toLowerCase()));
    
    if (meaningfulWords.length >= 3) {
      return meaningfulWords.slice(0, 3).join(' ');
    } else if (meaningfulWords.length === 2) {
      return meaningfulWords.join(' ');
    } else if (meaningfulWords.length === 1) {
      return meaningfulWords[0];
    } else if (words.length > 0) {
      return words.slice(0, 2).join(' ');
    } else {
      return text.trim().split(/\s+/)[0] || 'concept';
    }
  } catch (error) {
    console.error('Error extracting key terms:', error);
    return text.trim().split(/\s+/).slice(0, 2).join(' ') || 'concept';
  }
};

/**
 * Extract main topic from long paragraph
 */
const extractMainTopicFromParagraph = (text) => {
  // Remove punctuation and common words
  const cleanText = text.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase();
  const words = cleanText.split(/\s+/).filter(w => w.length > 3);
  
  // Very common words to skip
  const veryCommonWords = new Set([
    'the', 'and', 'that', 'this', 'with', 'from', 'are', 'have', 'been', 'will',
    'which', 'their', 'were', 'about', 'other', 'more', 'also', 'into', 'there'
  ]);
  
  // Words likely to be topics (noun indicators)
  const topicWords = words.filter(w => !veryCommonWords.has(w));
  
  if (topicWords.length === 0) {
    return words.slice(0, 2).join(' ') || 'concept';
  }
  
  // Get frequency of important words (likely topics appear multiple times)
  const wordFreq = {};
  topicWords.forEach(w => {
    wordFreq[w] = (wordFreq[w] || 0) + 1;
  });
  
  // Sort by frequency and length
  const topTopics = Object.entries(wordFreq)
    .sort((a, b) => {
      const freqScore = b[1] - a[1];
      if (freqScore !== 0) return freqScore;
      return b[0].length - a[0].length;
    })
    .slice(0, 3)
    .map(([word]) => word);
  
  if (topTopics.length === 0) {
    return topicWords.slice(0, 2).join(' ') || 'concept';
  }
  
  console.log('🎯 Main topics extracted:', topTopics.join(', '));
  return topTopics.join(' ');
};

/**
 * Fetch from Backend Explanation API (Primary source)
 */
const fetchFromBackendAPI = async (searchTerm) => {
  try {
    console.log('🔌 Fetching from Backend API:', searchTerm);
    
    // Check cache first
    const cached = getFromCache(searchTerm);
    if (cached) return cached;
    
    const API_URL = process.env.REACT_APP_API_URL || 'https://somalux-q2bw.onrender.com';
    const url = `${API_URL}/api/explain`;
    
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: searchTerm })
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Backend API returned status ${response.status}`);
      return null;
    }
    
    // Check if response is HTML (error page)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      console.error('❌ Backend returned HTML instead of JSON - backend may be down');
      return null;
    }
    
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('❌ Failed to parse JSON response from backend:', parseError);
      return null;
    }
    
    if (data && data.explanation) {
      console.log('✅ Backend API data received');
      const result = {
        title: data.title || searchTerm,
        extract: data.explanation,
        source: 'Backend API',
        success: true
      };
      saveToCache(searchTerm, result);
      return result;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Backend API error:', error);
    return null;
  }
};

/**
 * Fetch from Google Knowledge Graph API (via Backend)
 */
const fetchFromGoogleKnowledgeGraph = async (searchTerm) => {
  try {
    console.log('🔍 Fetching from Google Knowledge Graph (via backend):', searchTerm);
    
    const API_URL = process.env.REACT_APP_API_URL || 'https://somalux-q2bw.onrender.com';
    const url = `${API_URL}/api/knowledge-graph`;
    
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: searchTerm })
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Knowledge Graph API returned status ${response.status}`);
      return null;
    }
    
    // Check if response is HTML (error page)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      console.error('❌ Backend returned HTML instead of JSON - backend may be down');
      return null;
    }
    
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('❌ Failed to parse JSON response from Knowledge Graph API:', parseError);
      return null;
    }
    
    if (data && data.description) {
      console.log('✅ Google Knowledge Graph data received');
      return {
        title: data.title || searchTerm,
        extract: data.description.substring(0, 1000),
        source: 'Google Knowledge Graph',
        success: true
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Google Knowledge Graph error:', error);
    return null;
  }
};

/**
 * Fetch from Free Dictionary API
 */
const fetchFromDictionary = async (searchTerm) => {
  try {
    console.log('📖 Fetching from Dictionary API:', searchTerm);
    
    const word = searchTerm.split(' ')[0]; // Use first word for dictionary
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      throw new Error('Dictionary API error');
    }
    
    const data = await response.json();
    
    if (Array.isArray(data) && data[0]) {
      const entry = data[0];
      const definition = entry.meanings[0]?.definitions[0]?.definition || '';
      const examples = entry.meanings[0]?.definitions[0]?.example ? `\n\nExample: "${entry.meanings[0].definitions[0].example}"` : '';
      
      if (definition) {
        console.log('✅ Dictionary data received');
        return {
          title: entry.word,
          extract: definition + examples,
          source: 'Dictionary API',
          success: true
        };
      }
    }
    
    throw new Error('No dictionary entry found');
  } catch (error) {
    console.error('❌ Dictionary API error:', error);
    return null;
  }
};

/**
 * Fetch from Wiktionary API
 */
const fetchFromWiktionary = async (searchTerm) => {
  try {
    console.log('📚 Fetching from Wiktionary:', searchTerm);
    
    const url = `https://en.wiktionary.org/w/api.php?action=query&titles=${encodeURIComponent(searchTerm)}&prop=extracts&explaintext=true&format=json&origin=*`;
    
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      throw new Error('Wiktionary error');
    }
    
    const data = await response.json();
    const pages = data.query?.pages || {};
    const pageId = Object.keys(pages)[0];
    
    if (pageId && pages[pageId]?.extract) {
      const extract = pages[pageId].extract.substring(0, 1000);
      
      console.log('✅ Wiktionary data received');
      return {
        title: pages[pageId].title,
        extract: extract,
        source: 'Wiktionary',
        success: true
      };
    }
    
    throw new Error('No Wiktionary entry');
  } catch (error) {
    console.error('❌ Wiktionary error:', error);
    return null;
  }
};

/**
 * Fetch from Wikipedia (last fallback)
 */
const fetchFromWikipedia = async (searchTerm) => {
  try {
    console.log('🌍 Fetching from Wikipedia:', searchTerm);
    
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerm)}`;
    
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      throw new Error('Wikipedia error');
    }
    
    const data = await response.json();
    
    if (data.extract) {
      console.log('✅ Wikipedia data received');
      return {
        title: data.title,
        extract: data.extract.substring(0, 1000),
        source: 'Wikipedia',
        success: true
      };
    }
    
    throw new Error('No Wikipedia extract');
  } catch (error) {
    console.error('❌ Wikipedia error:', error);
    return null;
  }
};

/**
 * Main explanation function - uses multiple sources with fallbacks
 */
export const getTextExplanation = async (text) => {
  try {
    console.log('🚀 Starting multi-source explanation for:', text.substring(0, 50));
    
    const searchTerm = extractKeyTerms(text);
    console.log('🔑 Key term extracted:', searchTerm);
    
    // Count words in original text
    const wordCount = text.trim().split(/\s+/).length;
    console.log('📊 Word count:', wordCount);
    
    // Try sources in order - Backend first (protected), then public APIs
    const sources = [
      () => fetchFromBackendAPI(searchTerm),
      () => fetchFromGoogleKnowledgeGraph(searchTerm),
      () => fetchFromDictionary(searchTerm),
      () => fetchFromWiktionary(searchTerm),
      () => fetchFromWikipedia(searchTerm)
    ];
    
    for (const source of sources) {
      try {
        const result = await source();
        if (result && result.success) {
          console.log('✅ Successfully fetched from:', result.source);
          return result;
        }
      } catch (error) {
        console.warn('⚠️ Source failed, trying next:', error.message);
        // Continue to next source
      }
    }
    
    // If all sources fail, return null to trigger fallback
    console.log('⚠️ All sources exhausted, falling back to contextual analysis');
    return null;
  } catch (error) {
    console.error('❌ Explanation API error:', error);
    return null;
  }
};

/**
 * Generate a local explanation if APIs fail
 */
export const generateLocalExplanation = (text) => {
  console.log('💡 Generating contextual local explanation');
  
  try {
    // Use contextual explainer for better explanations
    const contextualExplanation = getContextualExplanation(text);
    
    const words = text.split(/\s+/).filter(w => w.length > 2);
    const mainTerms = words.slice(0, 3).join(' ') || 'concept';
    
    return {
      title: mainTerms,
      extract: contextualExplanation,
      source: 'Contextual Analysis',
      success: true
    };
  } catch (err) {
    console.error('❌ Error in contextual explanation:', err);
    
    // Fallback to basic explanation
    const words = text.split(/\s+/).filter(w => w.length > 2);
    const mainTerms = words.slice(0, 3).join(' ') || 'concept';
    
    return {
      title: mainTerms,
      extract: `**"${mainTerms}"** appears in your text.\n\nThis passage discusses important concepts that would benefit from further research. To better understand this topic:\n\n• Search for "${mainTerms}" on Wikipedia, Wiktionary, or Google\n• Check educational resources and textbooks\n• Look for online courses covering this subject\n• Consult academic papers or journals\n\nThe key is to explore multiple sources to build a comprehensive understanding of the concepts presented.`,
      source: 'Local Generation',
      success: true
    };
  }
};

/**
 * Main exported function for explanation
 */
export const fetchExplanation = async (text) => {
  // Try API sources first
  const apiResult = await getTextExplanation(text);
  
  if (apiResult && apiResult.success) {
    return apiResult;
  }
  
  // Fallback to local generation
  return generateLocalExplanation(text);
};
