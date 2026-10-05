/**
 * OAuth Handler - Explicitly handles OAuth token recovery
 * Called at app start to detect and restore OAuth sessions from URL hash
 */

export const captureOAuthTokensFromUrl = () => {
  if (typeof window === 'undefined') return false;

  const hashString = window.location.hash.startsWith('#')
    ? window.location.hash.substring(1)
    : window.location.hash;
  const urlParams = new URLSearchParams(hashString);
  const accessToken = urlParams.get('access_token');
  const refreshToken = urlParams.get('refresh_token');

  if (!accessToken || !refreshToken) return false;

  try {
    sessionStorage.setItem('oauth_tokens_from_url', JSON.stringify({
      accessToken,
      refreshToken,
    }));
  } catch {
    return false;
  }

  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${window.location.search}#/`
  );
  return true;
};

export const handleOAuthCallback = async (supabase) => {
  
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
      }
    } catch {
    }
    
    // If tokens found in sessionStorage, use them
    if (accessToken && refreshToken) {
      
      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (!error && data?.session) {
          
          // Store in localStorage to persist across page reloads
          try {
            localStorage.setItem('somalux_oauth_session', JSON.stringify({
              session: data.session,
              timestamp: new Date().getTime(),
            }));
          } catch {
          }
          
          // Clean up sessionStorage
          sessionStorage.removeItem('oauth_tokens_from_url');
          
          return data.session;
        }
      } catch {
      }
    }
    
    // Fallback: Check URL hash (in case it's still there)
    const fullHash = window.location.hash;
    if (fullHash.length > 0) {
      const hashString = fullHash.startsWith('#') ? fullHash.substring(1) : fullHash;
      const urlParams = new URLSearchParams(hashString);
      const urlAccessToken = urlParams.get('access_token');
      const urlRefreshToken = urlParams.get('refresh_token');
      
      if (urlAccessToken) {
        
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: urlAccessToken,
            refresh_token: urlRefreshToken || '',
          });
          
          if (!error && data?.session) {
            
            try {
              localStorage.setItem('somalux_oauth_session', JSON.stringify({
                session: data.session,
                timestamp: new Date().getTime(),
              }));
            } catch {
            }
            
            return data.session;
          }
        } catch {
        }
      }
    }
    
    // Try to get session from Supabase (in case detectSessionInUrl worked)
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      return session;
    }
    
    // No OAuth tokens found - check if we have a cached session from localStorage
    try {
      const cached = localStorage.getItem('somalux_oauth_session');
      if (cached) {
        const { session: cachedSession } = JSON.parse(cached);
        return cachedSession;
      }
    } catch {
    }
    
    return null;
  } catch {
    return null;
  }
};
