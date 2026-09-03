import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import { FiUser } from 'react-icons/fi';
import { userCache } from "../Books/utils/cacheManager";
import { supabase } from "../Books/supabaseClient";
import { ProfileAvatar, ProfilePlaceholder } from "./ProfileAvatar";
import { AuthModals } from "./AuthModals";
import { getCurrentUserProfile } from "../Books/Admin/api";
import "./Profile.css";

export const Profile = ({ user: propUser = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useState(null);
  const [currentUserTier, setCurrentUserTier] = useState('basic');
  const [showActionsGrid, setShowActionsGrid] = useState(false);

  // Local state
  const [localUser, setLocalUser] = useState(null);
  const [notificationsCount, setNotificationsCount] = useState(0);

  // Auth modals
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const FALLBACK = {
    name: "Please Sign In",
    email: "xxx@gmail.com",
    libraryId: "LBX-29475",
    membership: "Premium Plan",
    favorites: 0,
    wishlist: 0,
    notifications: 0,
  };

  const getUserProfileStorageKey = (user) => (user?.id ? `userProfile_${user.id}` : 'userProfile');

  const getStoredUserProfile = (user) => {
    const key = getUserProfileStorageKey(user);
    try {
      const current = JSON.parse(localStorage.getItem(key) || '{}');
      if (current && Object.keys(current).length > 0) return current;
    } catch (e) {}

    try {
      return JSON.parse(localStorage.getItem('userProfile') || '{}');
    } catch (e) {
      return {};
    }
  };

  const setStoredUserProfile = (user, data) => {
    const key = getUserProfileStorageKey(user);
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}

    if (!user?.id) {
      try {
        localStorage.setItem('userProfile', JSON.stringify(data));
      } catch (e) {}
    }
  };

  const getUserAvatarUrl = (user, profileRow = null) => {
    const stored = getStoredUserProfile(user);

    const candidates = [
      profileRow?.avatar_url,
      profileRow?.avatar,
      user?.user_metadata?.avatar_url,
      user?.user_metadata?.picture,
      user?.app_metadata?.avatar_url,
      user?.app_metadata?.picture,
      user?.avatar_url,
      user?.picture,
      stored?.avatar,
      stored?.avatar_url,
    ];

    return candidates.find((candidate) => !!candidate && typeof candidate === 'string' && candidate.trim().length > 0) || null;
  };

  const loadAvatar = async (url, retryCount = 0) => {
    if (!url) {
      console.log('⚠️ No URL provided to loadAvatar');
      return null;
    }
    
    console.log('📸 loadAvatar called with:', url.substring(0, 60) + '...');
    
    // For simplicity, just use the avatar URL directly
    // The backend will handle caching and proxy if needed
    setProfileImage(url);
    return url;
  };

  const markProfileActive = async (user) => {
    if (!user || !user.id) return;
    try {
      const nowIso = new Date().toISOString();
      // Non-blocking fire-and-forget profile update
      await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || null,
            is_active: true,
            last_active_at: nowIso,
            deactivated_at: null,
          },
          { returning: 'minimal' }
        );
    } catch (e) {
      console.warn('Failed to mark profile active', e);
    }
  };

  const markProfileSignedOut = async (user) => {
    if (!user || !user.id) return;
    try {
      const nowIso = new Date().toISOString();
      // Non-blocking fire-and-forget profile update
      await supabase
        .from('profiles')
        .update({
          is_active: false,
          deactivated_at: nowIso,
        })
        .eq('id', user.id);
    } catch (e) {
      console.warn('Failed to mark profile signed out', e);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Prevent body scroll when Actions Grid modal is open
  useEffect(() => {
    if (showActionsGrid) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showActionsGrid]);

  // Load data from storage
  const loadDataFromStorage = () => {
    try {
      const currentUser = authUser || JSON.parse(localStorage.getItem('somalux_current_session') || '{}')?.user || null;
      const stored = getStoredUserProfile(currentUser);
      if (stored && Object.keys(stored).length > 0) setLocalUser(stored);
      else setLocalUser(userCache.get("current_user") || null);
      try {
        const parsed = stored && Object.keys(stored).length > 0 ? stored : null;
        if (parsed && parsed.avatar) setProfileImage(parsed.avatar);
      } catch (e) {}
    } catch (e) {}

    try {
      const wl = JSON.parse(localStorage.getItem("bookWishlist") || "[]");
      if (!Array.isArray(wl)) {
        setNotificationsCount(Number(localStorage.getItem("notifications") || 0));
      }
    } catch (e) {}

    try {
      setNotificationsCount(Number(localStorage.getItem("notifications") || 0));
    } catch (e) {}
  };

  useEffect(() => {
    loadDataFromStorage();

    const handleStorage = () => loadDataFromStorage();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("wishlistChanged", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("wishlistChanged", handleStorage);
    };
  }, []);

  // Fetch subscription tier
  useEffect(() => {
    const fetchUserTier = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setCurrentUserTier('basic');
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching subscription tier:', error);
          setCurrentUserTier('basic');
          return;
        }

        setCurrentUserTier(profile?.subscription_tier || 'basic');
      } catch (err) {
        console.error('Error fetching user tier:', err);
        setCurrentUserTier('basic');
      }
    };

    if (authUser?.id) {
      fetchUserTier();
    }
  }, [authUser?.id]);

  // Auth initialization - fetch full profile from Supabase
  useEffect(() => {
    (async () => {
      console.log('🔐 [Profile] Initializing auth...');
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user || null;
      console.log('🔐 [Profile] Auth session:', user?.email ? `${user.email}` : 'No user');
      setAuthUser(user);

      if (user) {
        try {
          console.log('📥 [Profile] Fetching full profile from Supabase for:', user.email);
          const fullProfile = await getCurrentUserProfile();
          console.log('📥 [Profile] Full profile loaded:', {
            email: fullProfile?.email,
            avatar_url: fullProfile?.avatar_url ? `[URL present: ${fullProfile.avatar_url.substring(0, 50)}...]` : '[No avatar]',
            role: fullProfile?.role,
            full_name: fullProfile?.full_name
          });

          const avatarUrl = fullProfile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
          
          if (avatarUrl) {
            console.log('🖼️ [Profile] Setting avatar URL:', avatarUrl.substring(0, 60) + '...');
            setProfileImage(avatarUrl);
          } else {
            console.log('⚠️ [Profile] No avatar URL found');
          }

          const authUserData = {
            name: fullProfile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            email: user.email,
            libraryId: user.id?.substring(0, 8).toUpperCase() || 'LBX-XXXX',
            membership: 'Premium Plan',
            role: fullProfile?.role || 'user',
            avatar: avatarUrl,
            avatar_url: avatarUrl,
          };
          
          console.log('✅ [Profile] Setting local user data');
          setLocalUser(authUserData);
          setStoredUserProfile(user, authUserData);
          markProfileActive(user);

          // Load the avatar
          if (avatarUrl) {
            await loadAvatar(avatarUrl);
          }
        } catch (e) {
          console.error('❌ [Profile] Failed to load profile:', e);
          // Still set a fallback user
          const authUserData = {
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            email: user.email,
            libraryId: user.id?.substring(0, 8).toUpperCase() || 'LBX-XXXX',
            membership: 'Premium Plan',
            avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          };
          setLocalUser(authUserData);
          setStoredUserProfile(user, authUserData);
        }
      }
    })();

    let isMounted = true;
    const { data: { subscription } = {} } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      
      console.log('🔐 [Profile] Auth state changed:', _event);
      const user = session?.user || null;
      setAuthUser(user);
      
      if (user) {
        try {
          console.log('📥 [Profile] Auth state change - fetching full profile for:', user.email);
          const fullProfile = await getCurrentUserProfile();
          console.log('📥 [Profile] Profile from auth change:', {
            avatar_url: fullProfile?.avatar_url ? '[URL present]' : '[No avatar]',
            role: fullProfile?.role
          });

          const avatarUrl = fullProfile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
          
          if (avatarUrl) {
            console.log('🖼️ [Profile] Setting avatar from auth change');
            setProfileImage(avatarUrl);
          }

          const authUserData = {
            name: fullProfile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            email: user.email,
            libraryId: user.id?.substring(0, 8).toUpperCase() || 'LBX-XXXX',
            membership: 'Premium Plan',
            role: fullProfile?.role || 'user',
            avatar: avatarUrl,
            avatar_url: avatarUrl,
          };
          setLocalUser(authUserData);
          setStoredUserProfile(user, authUserData);

          if (avatarUrl || user.user_metadata?.avatar_url || user.user_metadata?.picture) {
            const finalAvatar = avatarUrl || user.user_metadata?.avatar_url || user.user_metadata?.picture;
            loadAvatar(finalAvatar).catch(e => console.warn('Avatar load failed:', e));

            (async () => {
              try {
                const { error } = await supabase
                  .from('profiles')
                  .upsert({
                    id: user.id,
                    email: user.email,
                    avatar_url: finalAvatar,
                    full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || null,
                    display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || null,
                    updated_at: new Date().toISOString(),
                  }, { onConflict: 'id' });
                if (!error) console.log('✅ Avatar synced to profiles table');
                else console.warn('⚠️ Failed to sync avatar:', error);
              } catch (e) {
                console.warn('⚠️ Avatar sync error:', e);
              }
            })();
          }

          // Non-blocking profile marking
          markProfileActive(user);
        } catch (e) {
          console.error('❌ [Profile] Auth state change error:', e);
          // Fallback user data
          const authUserData = {
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            email: user.email,
            libraryId: user.id?.substring(0, 8).toUpperCase() || 'LBX-XXXX',
            membership: 'Premium Plan',
            avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
          };
          setLocalUser(authUserData);
          setStoredUserProfile(user, authUserData);
        }
      } else {
        // User logged out - only clear UI state, DO NOT mark as signed out in database
        // (markProfileSignedOut should only be called when user explicitly clicks sign out button)
        setLocalUser(null);
        try {
          const keys = Object.keys(localStorage);
          keys.forEach((key) => {
            if (key === 'userProfile' || key.startsWith('userProfile_')) {
              localStorage.removeItem(key);
            }
          });
        } catch (e) {}
        setProfileImage(null);
      }
      window.dispatchEvent(new CustomEvent("authChanged", { detail: { user } }));
    });


    return () => {
      isMounted = false;
      try {
        subscription?.unsubscribe?.();
      } catch (e) {}
    };
  }, []);

  // Display values
  const displayedName = authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || localUser?.name || propUser?.name || FALLBACK.name;
  const displayedEmail = authUser?.email || localUser?.email || propUser?.email || FALLBACK.email;
  const displayedMembership = localUser?.membership || propUser?.membership || (authUser ? 'Premium Plan' : FALLBACK.membership);

  const favorites = localUser?.favorites || 0;
  const notifications = notificationsCount || localUser?.notifications || 0;

  const totalBadgeCount = (favorites || 0) + (notifications || 0);

  return (
    <>
      <div className="chrome-profile" ref={dropdownRef}>
      {/* Trigger */}
      <button className="profile-trigger" onClick={() => setIsOpen(!isOpen)}>
        {profileImage ? (
          <img
            src={profileImage}
            className="profile-avatar"
            alt="Profile"
            onError={(e) => {
              console.error('❌ Profile avatar failed to load:', {
                src: profileImage?.substring(0, 60),
                error: e.message
              });
              // Try fallback avatar using email hash
              if (authUser?.email && !profileImage.includes('dicebear')) {
                const fallbackUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${authUser.email}`;
                console.log('🔄 [Profile] Trying fallback avatar:', fallbackUrl);
                setProfileImage(fallbackUrl);
              } else {
                setProfileImage(null);
              }
            }}
            onLoad={() => {
              console.log('✅ Profile avatar loaded successfully:', profileImage?.substring(0, 60));
            }}
          />
        ) : (
          <ProfilePlaceholder size={34} />
        )}
        {totalBadgeCount > 0 && (
          <span className="notif-badge">{totalBadgeCount > 999 ? "999+" : totalBadgeCount}</span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="chrome-dropdown">
          {/* Profile Header */}
          <div style={{
            padding: '10px',
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              {/* Avatar & Info */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', flex: 1 }}>
                {/* Avatar */}
                <div style={{ flexShrink: 0, marginTop: '-18px', marginLeft: '-10px' }}>
                  <ProfileAvatar
                    profileImage={profileImage}
                    setProfileImage={setProfileImage}
                    authUser={authUser}
                    size={52}
                    showUploadButton={true}
                  />
                </div>

                {/* User Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ margin: '0 0 1px 0', fontSize: '12px', color: '#fff' }}>{displayedName}</h4>
                  <p style={{ margin: 0, fontSize: '10px', color: '#8696a0', wordBreak: 'break-word' }}>{displayedEmail}</p>
                  {currentUserTier !== 'basic' && (
                    <div style={{ marginTop: '2px', fontSize: '9px', color: '#00a884', fontWeight: '600' }}>
                      {displayedMembership}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions & Auth Section - Right below profile */}
            <div className="profile-auth-actions" style={{
              padding: '0',
              marginTop: '8px',
              display: 'flex',
              gap: '24px',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}>
              {/* Auth Button */}
              {!authUser && (
                <button
                  onClick={() => setShowAuthModal(true)}
                  style={{
                    padding: '4px 6px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#fff',
                    backgroundColor: '#00a884',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#008069';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#00a884';
                  }}
                >
                  Sign In
                </button>
              )}
            </div>
          </div>

          {/* Profile actions */}
          {authUser && (
            <div className="profile-actions-section" style={{
              padding: '10px 10px 10px',
              background: 'transparent',
              borderRadius: 0,
              borderTop: '0.5px solid rgba(42, 57, 66, 0.7)',
              boxShadow: 'none',
              marginTop: '10px'
            }}>
              <div className="profile-actions-grid" style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '16px',
                justifyContent: 'space-between'
              }}>
                {/* Left Column - 2 buttons */}
                <div className="profile-action-column" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  flex: 1
                }}>
                {/* Upload */}
                <button
                  onClick={() => {
                    setShowActionsGrid(false);
                    setIsOpen(false);
                    navigate('/user/upload');
                  }}
                  style={{
                    padding: '5px 9px',
                    background: 'transparent',
                    border: '1px solid #34B7F1',
                    color: '#34B7F1',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '10px',
                    fontWeight: '600',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    width: '100%',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(52, 183, 241, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  Upload
                </button>

                {/* Settings */}
                <button
                  onClick={() => {
                    setShowActionsGrid(false);
                    setIsOpen(false);
                    navigate('/settings');
                  }}
                  style={{
                    padding: '5px 9px',
                    background: 'transparent',
                    border: '1px solid #8696a0',
                    color: '#c9d3d8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: '600',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    width: '100%'
                  }}
                >
                  Settings
                </button>

                </div>

                {/* Right Column - 3 buttons */}
                <div className="profile-action-column" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  flex: 1
                }}>

                </div>
              </div>
            </div>
          )}

          {/* Main Content Area */}
        </div>
      )}

      {/* Auth Modals */}
      <AuthModals
        showAuthModal={showAuthModal}
        setShowAuthModal={setShowAuthModal}
        showSignOutModal={showSignOutModal}
        setShowSignOutModal={setShowSignOutModal}
        authUser={authUser}
        setAuthUser={setAuthUser}
        markProfileSignedOut={markProfileSignedOut}
      />

      </div>

    </>
  );

};