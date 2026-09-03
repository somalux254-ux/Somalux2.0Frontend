/**
 * OAuth Handler - Explicitly handles OAuth token recovery
 * Called at app start to detect and restore OAuth sessions from URL hash
 */

export const handleOAuthCallback = async (supabase) => {
  console.log('🔐 [oauthHandler] Checking for OAuth tokens...');
  
  try {
    // 🔐 CRITICAL: First check sessionStorage for tokens captured at app startup
    let accessToken = null;
    let refreshToken = null;
    let oauthData = null;
    
    try {
      const stored = sessionStorage.getItem('oauth_tokens_from_url');
      if (stored) {
        oauthData = JSON.parse(stored);
        accessToken = oauthData.accessToken;
        refreshToken = oauthData.refreshToken;
        console.log('🔐 [oauthHandler] OAuth tokens retrieved from sessionStorage!');
        console.log('🔐 [oauthHandler] Captured at:', oauthData.capturedAt);
      }
    } catch (e) {
      console.warn('⚠️ [oauthHandler] Failed to parse sessionStorage:', e.message);
    }
    
    // If tokens found in sessionStorage, use them
    if (accessToken && refreshToken) {
      console.log('🔐 [oauthHandler] Setting session with captured OAuth tokens...');
      
      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (error) {
          console.error('❌ [oauthHandler] setSession() failed:', error.message);
        } else if (data?.session) {
          console.log('✅ [oauthHandler] Session set successfully!');
          console.log('✅ [oauthHandler] User ID:', data.session.user?.id);
          console.log('✅ [oauthHandler] User email:', data.session.user?.email);
          
          // Store in localStorage to persist across page reloads
          try {
            localStorage.setItem('somalux_oauth_session', JSON.stringify({
              session: data.session,
              timestamp: new Date().getTime(),
            }));
            console.log('💾 [oauthHandler] Session cached to localStorage');
          } catch (e) {
            console.warn('⚠️ [oauthHandler] Failed to cache session:', e);
          }
          
          // Clean up sessionStorage
          sessionStorage.removeItem('oauth_tokens_from_url');
          
          return data.session;
        }
      } catch (err) {
        console.error('❌ [oauthHandler] Exception in setSession():', err);
      }
    }
    
    // Fallback: Check URL hash (in case it's still there)
    const fullHash = window.location.hash;
    if (fullHash.length > 0) {
      console.log('🔐 [oauthHandler] URL hash found, attempting to parse...');
      const hashString = fullHash.startsWith('#') ? fullHash.substring(1) : fullHash;
      const urlParams = new URLSearchParams(hashString);
      const urlAccessToken = urlParams.get('access_token');
      const urlRefreshToken = urlParams.get('refresh_token');
      
      if (urlAccessToken) {
        console.log('🔐 [oauthHandler] Access token found in URL hash!');
        
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: urlAccessToken,
            refresh_token: urlRefreshToken || '',
          });
          
          if (error) {
            console.error('❌ [oauthHandler] setSession() failed:', error.message);
          } else if (data?.session) {
            console.log('✅ [oauthHandler] Session set from URL successfully!');
            console.log('✅ [oauthHandler] User ID:', data.session.user?.id);
            console.log('✅ [oauthHandler] User email:', data.session.user?.email);
            
            try {
              localStorage.setItem('somalux_oauth_session', JSON.stringify({
                session: data.session,
                timestamp: new Date().getTime(),
              }));
              console.log('💾 [oauthHandler] Session cached to localStorage');
            } catch (e) {
              console.warn('⚠️ [oauthHandler] Failed to cache session:', e);
            }
            
            return data.session;
          }
        } catch (err) {
          console.error('❌ [oauthHandler] Exception in setSession():', err);
        }
      }
    }
    
    // Try to get session from Supabase (in case detectSessionInUrl worked)
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session) {
      console.log('✅ [oauthHandler] Session found via getSession()!');
      return session;
    }
    
    // No OAuth tokens found - check if we have a cached session from localStorage
    try {
      const cached = localStorage.getItem('somalux_oauth_session');
      if (cached) {
        const { session: cachedSession } = JSON.parse(cached);
        console.log('✅ [oauthHandler] Using cached OAuth session from localStorage');
        return cachedSession;
      }
    } catch (e) {
      console.warn('⚠️ [oauthHandler] Failed to load cached session:', e.message);
    }
    
    console.log('ℹ️ [oauthHandler] No OAuth session found');
    return null;
  } catch (err) {
    console.error('❌ [oauthHandler] Error:', err);
    return null;
  }
};
