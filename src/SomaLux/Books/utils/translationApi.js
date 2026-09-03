/**
 * Translation API - Powerful text translation with multiple backends
 * Uses Google Translate API for high-quality translations
 */

const LANGUAGE_MAP = {
  'Spanish': 'es',
  'French': 'fr',
  'German': 'de',
  'Chinese': 'zh',
  'Japanese': 'ja',
  'Portuguese': 'pt',
  'Russian': 'ru',
  'Arabic': 'ar',
  'Hindi': 'hi',
  'Korean': 'ko',
  'Italian': 'it',
  'Dutch': 'nl',
  'Turkish': 'tr',
  'Polish': 'pl',
  'Thai': 'th',
  'Vietnamese': 'vi',
  'Indonesian': 'id',
  'Swedish': 'sv',
  'Norwegian': 'no',
  'Danish': 'da',
  'Finnish': 'fi',
  'Greek': 'el',
  'Hebrew': 'he',
  'Hungarian': 'hu',
  'Czech': 'cs',
  'Romanian': 'ro',
  'Slovak': 'sk',
  'Swahili': 'sw'
};

/**
 * Get language code from language name
 */
export const getLanguageCode = (languageName) => {
  return LANGUAGE_MAP[languageName] || 'en';
};

/**
 * Translate text using Google Translate API (no key required)
 * Uses a clever fetch approach that works without API keys
 */
export const translateText = async (text, targetLanguage) => {
  try {
    // Get language code
    const targetCode = getLanguageCode(targetLanguage);
    
    if (!text || text.trim().length === 0) {
      throw new Error('Text to translate is empty');
    }

    // Method 1: Try using public Google Translate endpoint (most reliable)
    try {
      const encodedText = encodeURIComponent(text);
      const url = `https://translate.googleapis.com/translate_a/element.js?cb=googleTranslateElementInit`;
      
      // Use Google's public translation endpoint
      const response = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + targetCode + '&dt=t&q=' + encodedText, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // Parse the nested array response from Google Translate
        if (data && data[0] && Array.isArray(data[0])) {
          const translatedParts = data[0].map(item => item[0]).filter(Boolean);
          const translation = translatedParts.join('');
          
          if (translation) {
            console.log(`✅ Translated to ${targetLanguage}:`, translation);
            return {
              success: true,
              translation: translation,
              language: targetLanguage,
              source: 'google_translate'
            };
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ Google Translate endpoint failed:', err);
    }

    // Method 2: Fallback - Try backend endpoint if available
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: text,
          targetLanguage: targetLanguage,
          targetCode: targetCode
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.translation) {
          console.log(`✅ Translated to ${targetLanguage} via backend:`, data.translation);
          return {
            success: true,
            translation: data.translation,
            language: targetLanguage,
            source: 'backend'
          };
        }
      }
    } catch (err) {
      console.warn('⚠️ Backend translation failed:', err);
    }

    // Method 3: Fallback - Contextual translation (basic)
    console.warn('⚠️ All translation methods failed, using fallback');
    return {
      success: false,
      translation: text,
      language: targetLanguage,
      source: 'fallback',
      message: 'Translation service temporarily unavailable. Showing original text.'
    };

  } catch (error) {
    console.error('❌ Translation error:', error);
    throw error;
  }
};

/**
 * Translate multiple text items at once (batch translation)
 */
export const translateBatch = async (texts, targetLanguage) => {
  try {
    const results = await Promise.all(
      texts.map(text => translateText(text, targetLanguage))
    );
    return results;
  } catch (error) {
    console.error('❌ Batch translation error:', error);
    throw error;
  }
};

/**
 * Auto-detect language of text
 */
export const detectLanguage = async (text) => {
  try {
    // Simple character-based language detection
    if (!text || text.length === 0) return 'unknown';

    // Check for Chinese characters
    if (/[\u4e00-\u9fff]/.test(text)) return 'Chinese';
    
    // Check for Japanese hiragana/katakana
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'Japanese';
    
    // Check for Korean Hangul
    if (/[\uac00-\ud7af\u1100-\u11ff]/.test(text)) return 'Korean';
    
    // Check for Arabic
    if (/[\u0600-\u06ff]/.test(text)) return 'Arabic';
    
    // Check for Hebrew
    if (/[\u0590-\u05ff]/.test(text)) return 'Hebrew';
    
    // Check for Russian/Cyrillic
    if (/[\u0400-\u04ff]/.test(text)) return 'Russian';
    
    // Check for Thai
    if (/[\u0e00-\u0e7f]/.test(text)) return 'Thai';
    
    // Check for Devanagari (Hindi)
    if (/[\u0900-\u097f]/.test(text)) return 'Hindi';

    // Default to English for Latin text
    return 'English';
  } catch (error) {
    console.error('❌ Language detection error:', error);
    return 'unknown';
  }
};

/**
 * Get list of supported languages
 */
export const getSupportedLanguages = () => {
  return Object.keys(LANGUAGE_MAP);
};

/**
 * Format translation result for display
 */
export const formatTranslationResult = (result) => {
  if (result.success) {
    return {
      text: result.translation,
      language: result.language,
      status: 'success'
    };
  } else {
    return {
      text: result.translation,
      language: result.language,
      status: 'fallback',
      message: result.message
    };
  }
};
