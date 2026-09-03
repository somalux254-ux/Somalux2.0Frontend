/**
 * Book Download Tracking Service
 * Handles accurate download count recording and analytics
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Record a book download with full tracking information
 * @param {Object} params
 * @param {string} params.userId - User ID downloading the book
 * @param {string} params.bookId - Book ID being downloaded
 * @param {string} params.ipAddress - Optional IP address
 * @returns {Promise<Object>} Result with success status and data
 */
export async function recordBookDownload({
  userId,
  bookId,
  ipAddress = null
}) {
  try {
    if (!userId || !bookId) {
      throw new Error('userId and bookId are required');
    }

    const downloadRecord = {
      user_id: userId,
      book_id: bookId,
      downloaded_at: new Date().toISOString(),
      ip_address: ipAddress,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
    };

    // Insert download record
    const { data, error } = await supabase
      .from('book_downloads')
      .insert([downloadRecord])
      .select();

    if (error) {
      console.error('❌ Download tracking error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      // Still return success so download doesn't fail, but log for debugging
      return {
        success: false,
        error: error.message,
        data: null
      };
    }

    console.log('✅ Download recorded successfully:', {
      userId,
      bookId,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      data: data,
      error: null
    };
  } catch (error) {
    console.error('❌ Exception in recordBookDownload:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

/**
 * Get download statistics for a book
 * @param {string} bookId - Book ID to get stats for
 * @returns {Promise<Object>} Download statistics
 */
export async function getBookDownloadStats(bookId) {
  try {
    if (!bookId) {
      throw new Error('bookId is required');
    }

    // Call RPC function for statistics
    const { data, error } = await supabase.rpc(
      'get_book_download_stats',
      { p_book_id: bookId }
    );

    if (error) {
      console.error('Error fetching download stats:', error);
      return null;
    }

    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Exception in getBookDownloadStats:', error);
    return null;
  }
}

/**
 * Get user's download history
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of download records
 */
export async function getUserDownloadHistory(userId, options = {}) {
  try {
    const { limit = 50, offset = 0 } = options;

    if (!userId) {
      throw new Error('userId is required');
    }

    let query = supabase
      .from('book_downloads')
      .select(`
        id,
        book_id,
        downloaded_at,
        books(id, title, author, cover_image_url)
      `)
      .eq('user_id', userId)
      .order('downloaded_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    if (offset) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching download history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception in getUserDownloadHistory:', error);
    return [];
  }
}

/**
 * Get download analytics for a book
 * @param {string} bookId - Book ID
 * @returns {Promise<Object>} Analytics data
 */
export async function getBookDownloadAnalytics(bookId) {
  try {
    if (!bookId) {
      throw new Error('bookId is required');
    }

    const { data, error } = await supabase
      .from('book_download_analytics')
      .select('*')
      .eq('book_id', bookId);

    if (error) {
      console.error('Error fetching download analytics:', error);
      return null;
    }

    return data && data.length > 0 ? data : null;
  } catch (error) {
    console.error('Exception in getBookDownloadAnalytics:', error);
    return null;
  }
}

/**
 * Check if a user has downloaded a book
 * @param {string} userId - User ID
 * @param {string} bookId - Book ID
 * @returns {Promise<boolean>} True if user has downloaded the book
 */
export async function hasUserDownloadedBook(userId, bookId) {
  try {
    if (!userId || !bookId) {
      throw new Error('userId and bookId are required');
    }

    const { data, error } = await supabase
      .from('book_downloads')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('book_id', bookId);

    if (error) {
      console.error('Error checking download status:', error);
      return false;
    }

    return (data && data.length > 0) || false;
  } catch (error) {
    console.error('Exception in hasUserDownloadedBook:', error);
    return false;
  }
}

/**
 * Get top downloaded books
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Top downloaded books
 */
export async function getTopDownloadedBooks(options = {}) {
  try {
    const { limit = 10, days = 30 } = options;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await supabase
      .from('book_download_analytics')
      .select('*')
      .gte('first_download_date', cutoffDate.toISOString())
      .order('total_downloads', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching top downloaded books:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception in getTopDownloadedBooks:', error);
    return [];
  }
}

export default {
  recordBookDownload,
  getBookDownloadStats,
  getUserDownloadHistory,
  getBookDownloadAnalytics,
  hasUserDownloadedBook,
  getTopDownloadedBooks
};
