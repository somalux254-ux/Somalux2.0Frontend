import { supabase } from '../SomaLux/Books/supabaseClient';

const DAILY_DOWNLOAD_LIMIT_FREE = 1; // Non-premium users
const DAILY_DOWNLOAD_LIMIT_PREMIUM = 999; // Premium users (essentially unlimited)
const STORAGE_KEY = 'somalux_daily_downloads';

/**
 * Get today's date key for tracking downloads
 */
const getTodayKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

/**
 * Get today's download count from localStorage
 * Note: localStorage is client-side only. For production, this should be tracked in Supabase.
 */
const getTodayDownloadCount = () => {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const todayKey = getTodayKey();
    return data[todayKey] || 0;
  } catch {
    return 0;
  }
};

/**
 * Increment today's download count in localStorage
 */
const incrementDownloadCount = () => {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const todayKey = getTodayKey();
    data[todayKey] = (data[todayKey] || 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data[todayKey];
  } catch {
    return 1;
  }
};

/**
 * Check if user has exceeded daily download limit
 * @param {object} user - User object with subscription_tier
 * @returns {object} { allowed: boolean, remaining: number, limit: number, error: string }
 */
export const checkDownloadLimit = (user) => {
  // Allow downloads if no user
  if (!user) {
    return { allowed: true, remaining: 999, limit: 999 };
  }

  const tier = user.subscription_tier || 'basic';
  const isBasic = tier === 'basic';
  const limit = isBasic ? DAILY_DOWNLOAD_LIMIT_FREE : DAILY_DOWNLOAD_LIMIT_PREMIUM;
  
  const currentCount = getTodayDownloadCount();
  const remaining = Math.max(0, limit - currentCount);

  if (currentCount >= limit) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      error: isBasic
        ? `You've reached your daily limit of ${limit} downloads for today.`
        : `You've reached your download limit for today.`
    };
  }

  return {
    allowed: true,
    remaining,
    limit,
  };
};

/**
 * Record a download after successful download
 * In production, this should also save to Supabase
 */
export const recordDownload = async (user, itemType, itemId, itemName) => {
  try {
    // Increment local counter
    incrementDownloadCount();

    // Try to record in Supabase for analytics (non-blocking)
    if (user && user.id && supabase) {
      try {
        // Check if download_history table exists, if not, just track locally
        await supabase
          .from('download_history')
          .insert({
            user_id: user.id,
            item_type: itemType, // 'book' or 'paper'
            item_id: itemId,
            item_name: itemName,
            downloaded_at: new Date().toISOString(),
          });
      } catch (supabaseError) {
        // Log error but don't fail the download - table may not exist yet
        console.warn('Failed to record download in Supabase:', supabaseError?.message);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error recording download:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get user's download history for today
 */
export const getTodayDownloadHistory = async (user) => {
  if (!user || !user.id || !supabase) {
    return [];
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('download_history')
      .select('*')
      .eq('user_id', user.id)
      .gte('downloaded_at', today.toISOString())
      .order('downloaded_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn('Error fetching download history:', error);
    return [];
  }
};

/**
 * Reset daily downloads (admin function, useful for testing)
 */
export const resetDailyDownloads = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return { success: true };
  } catch (error) {
    console.error('Error resetting downloads:', error);
    return { success: false, error: error.message };
  }
};

export default {
  checkDownloadLimit,
  recordDownload,
  getTodayDownloadHistory,
  resetDailyDownloads,
  getTodayDownloadCount,
};
