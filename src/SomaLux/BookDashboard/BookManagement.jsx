import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookPanel } from "../Books/BookPanel";
import { PaperPanel } from "../PastPapers/Pastpapers";
import {Profile} from './Profile';   // ← imported here
import VerificationBadge from "../Books/Admin/components/VerificationBadge";
import { supabase } from "../Books/supabaseClient";
import './BookManagement.css';

export const BookManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentUserTier, setCurrentUserTier] = useState('basic');
  const [isChatSelected, setIsChatSelected] = useState(false);

  // Determine active tab from URL path
  const getActiveTabFromPath = () => {
    const path = location.pathname;
    // Extract the tab segment after /BookManagement/
    const match = path.match(/\/BookManagement\/([a-z]+)/);
    if (match) {
      const tabName = match[1];
      if (['pastpapers', 'chatme'].includes(tabName)) {
        return tabName;
      }
    }
    return 'books'; // default
  };

  const activeTab = getActiveTabFromPath();

  // Render only the active tab component to avoid rendering all at once
  const renderActiveComponent = () => {
    try {
      console.log('[BookManagement] Rendering tab:', activeTab);
      switch (activeTab) {
        case 'pastpapers':
          console.log('[BookManagement] About to render PaperPanel');
          return (
            <React.Suspense fallback={<div style={{ padding: '20px', color: '#888' }}>Loading Past Papers...</div>}>
              <PaperPanel />
            </React.Suspense>
          );
        case 'books':
        default:
          console.log('[BookManagement] About to render BookPanel');
          return (
            <React.Suspense fallback={<div style={{ padding: '20px', color: '#888' }}>Loading Books...</div>}>
              <BookPanel />
            </React.Suspense>
          );
      }
    } catch (error) {
      console.error('[BookManagement] Error in renderActiveComponent:', error);
      return (
        <div style={{ padding: '20px', color: '#ff6b6b', border: '1px solid #ff6b6b' }}>
          <h3>Error loading {activeTab} tab</h3>
          <p>{error.message}</p>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
            <summary>Stack trace:</summary>
            {error.stack}
          </details>
        </div>
      );
    }
  };

  // Tab definitions (without components to avoid rendering all)
  const tabs = [
    { id: 'books',      label: 'Books' },
    { id: 'pastpapers', label: 'ExamPapers' },
  ];

  // Navigate to tab by updating URL
  const navigateToTab = (tabId) => {
    const basePath = '/BookManagement';
    const tabPath = tabId === 'books' ? '' : `/${tabId}`;
    navigate(`${basePath}${tabPath}`, { replace: false });
  };

  useEffect(() => {
    document.body.classList.add('book-page-no-scrollbar');
    document.documentElement.style.scrollbarWidth = 'none';
    document.body.style.scrollbarWidth = 'none';
    document.documentElement.style.msOverflowStyle = 'none';
    document.body.style.msOverflowStyle = 'none';

    return () => {
      document.documentElement.classList.remove('book-page-no-scrollbar');
      document.body.classList.remove('book-page-no-scrollbar');
      document.documentElement.style.removeProperty('scrollbar-width');
      document.body.style.removeProperty('scrollbar-width');
      document.documentElement.style.removeProperty('-ms-overflow-style');
      document.body.style.removeProperty('-ms-overflow-style');
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch current user's subscription tier (non-blocking)
  useEffect(() => {
    let isMounted = true;

    const fetchUserTier = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!isMounted) return;
        
        if (!user) {
          setCurrentUserTier('basic');
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .single();

        if (!isMounted) return;
        
        if (error) {
          console.error('Error fetching subscription tier:', error);
          setCurrentUserTier('basic');
          return;
        }

        setCurrentUserTier(profile?.subscription_tier || 'basic');
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching user tier:', err);
          setCurrentUserTier('basic');
        }
      }
    };

    // Start fetching in background without awaiting
    fetchUserTier();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        if (session?.user) {
          fetchUserTier();
        } else {
          setCurrentUserTier('basic');
        }
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  // Check if chat is selected to hide header and tabs
  return (
    <div className={`book-management ${isScrolled ? 'scrolled' : ''}`}>
      {/* Header */}
      <div className="book-management-header">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingTop: '2px' }}>
            <h2 className="header-title">Somalux</h2>
            <div style={{ marginTop: '8px' }}>
              <VerificationBadge tier={currentUserTier} size="sm" showLabel={false} showTooltip={true} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Reusable Profile component */}
            <Profile />
          </div>
      </div>

      {/* Tab Bar */}
      <div className="tools-scroll-container-convert">
        <div className="tool-group-convert">
          {tabs.map(tab => (
            <button
              key={tab.id}
              data-tab-id={tab.id}
              className={`tool-button-convert ${activeTab === tab.id ? 'active-convert' : ''}`}
              onClick={() => navigateToTab(tab.id)}
            >
              <span>{tab.label}</span>
            </button>
          ))}
          </div>
      </div>

      {/* Main Content */}
      <div
        className="file-converter-content-convert"
        data-active-tab={activeTab}
      >
        {renderActiveComponent()}
      </div>
    </div>
  );
};