/**
 * Session Manager - Handles auth session persistence and recovery
 * Ensures users remain logged in across page reloads
 */

const SESSION_CACHE_KEY = 'somalux_session_cache';
const SESSION_EXPIRY_KEY = 'somalux_session_expiry';
const USER_CACHE_KEY = 'somalux_user_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hour cache (aggressive persistence)

// Initialize session on app load - MUST be called first
export const initializeSession = async (supabase) => {
  try {
    // 1. Check Supabase session FIRST (always trust Supabase over local cache)
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Supabase getSession error:', error);
      // If Supabase fails, use cache as fallback
      const cachedSession = getCachedSession();
      if (cachedSession && !isSessionExpired()) {
        console.log('✓ Fallback to cached session');
        return cachedSession;
      }
      return null;
    }

    // 2. If Supabase has a session, cache it and return
    if (session) {
      cacheSession(session);
      console.log('✓ Session from Supabase (cached)');
      return session;
    }

    // 3. No session in Supabase - check cache as fallback
    const cachedSession = getCachedSession();
    if (cachedSession && !isSessionExpired()) {
      console.log('✓ Session from cache (Supabase empty)');
      return cachedSession;
    }

    // 4. No session anywhere
    clearSessionCache();
    console.log('ℹ No active session found');
    return null;
  } catch (err) {
    console.error('❌ Session initialization error:', err);
    // Last resort: try cache
    const cachedSession = getCachedSession();
    return cachedSession && !isSessionExpired() ? cachedSession : null;
  }
};

// Cache session in localStorage for instant restore
export const cacheSession = (session) => {
  if (!session) return;
  
  try {
    const expiresAt = new Date().getTime() + CACHE_DURATION;
    
    // Cache the full session
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
      session,
      timestamp: new Date().getTime()
    }));
    
    // Cache expiry time
    localStorage.setItem(SESSION_EXPIRY_KEY, expiresAt.toString());
    
    // Cache user info separately for quick access
    if (session.user) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify({
        user: session.user,
        timestamp: new Date().getTime()
      }));
    }
    
    console.log('💾 Session cached successfully');
  } catch (err) {
    console.error('❌ Failed to cache session:', err);
  }
};

// Retrieve cached session
const getCachedSession = () => {
  try {
    const cached = localStorage.getItem(SESSION_CACHE_KEY);
    if (!cached) return null;
    
    const { session } = JSON.parse(cached);
    return session;
  } catch (err) {
    console.error('❌ Failed to retrieve cached session:', err);
    return null;
  }
};

// Check if cached session is still valid
const isSessionExpired = () => {
  try {
    const expiryStr = localStorage.getItem(SESSION_EXPIRY_KEY);
    if (!expiryStr) return true;
    
    const expiry = parseInt(expiryStr, 10);
    const isExpired = new Date().getTime() > expiry;
    
    if (isExpired) {
      console.log('⏰ Session cache expired');
    }
    
    return isExpired;
  } catch (err) {
    return true;
  }
};

// Clear session cache
export const clearSessionCache = () => {
  try {
    localStorage.removeItem(SESSION_CACHE_KEY);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
    console.log('🗑️ Session cache cleared');
  } catch (err) {
    console.error('❌ Failed to clear session cache:', err);
  }
};

// Setup auth state listener with automatic session refresh
export const setupAuthListener = (supabase, onAuthChange) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔐 Auth event:', event, session ? '(with session)' : '(no session)');
    
    if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
      // Always cache valid sessions on every auth event
      cacheSession(session);
      console.log('✓ Session cached on auth event:', event);
      // Call callback with valid session
      if (onAuthChange) {
        onAuthChange(event, session);
      }
    } else if (event === 'SIGNED_OUT') {
      // Only clear cache on explicit sign out
      clearSessionCache();
      // Call callback for sign out event
      if (onAuthChange) {
        onAuthChange(event, null);
      }
    }
    // For other events without a session (like INITIAL_SESSION with no session),
    // don't call the callback - this prevents incorrect logout behavior
  });

  return subscription;
};

// Ensure session is valid (optional refresh)
export const refreshSessionIfNeeded = async (supabase) => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.log('❌ Session invalid, clearing cache');
      clearSessionCache();
      return null;
    }

    // Cache the validated session
    cacheSession(session);
    console.log('✓ Session validated and cached');
    return session;
  } catch (err) {
    console.error('❌ Session refresh error:', err);
    clearSessionCache();
    return null;
  }
};
