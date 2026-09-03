import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiChevronLeft } from 'react-icons/fi';
import { AdminUIProvider } from '../../Books/Admin/AdminUIContext';
import { supabase } from '../../Books/supabaseClient';
import './UserUploadPage.css';

const Upload = React.lazy(() => import('../../Books/Admin/pages/Upload'));

const UserUploadPage = () => {
  const navigate = useNavigate();
  const { tabType } = useParams();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [activeTab, setActiveTab] = useState(tabType || 'books');
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Fetch current user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('👤 UserUploadPage - Auth user:', { id: user?.id, email: user?.email });
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, email, full_name, role')
            .eq('id', user.id)
            .single();
          console.log('👤 UserUploadPage - Profile fetched:', profile);
          setUserProfile(profile);
        }
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  const tabOptions = [
    { id: 'books', label: 'Books' },
    { id: 'campus', label: 'Campus' },
    { id: 'pastpapers', label: 'Past Papers' }
  ];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setActiveTab(tabType || 'books');
  }, [tabType]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = (e) => {
    touchEndX.current = e.changedTouches[0].screenX;
    handleSwipe();
  };

  const handleSwipe = () => {
    const difference = touchStartX.current - touchEndX.current;
    const isLeftSwipe = difference > 50;
    const isRightSwipe = difference < -50;

    if (isLeftSwipe || isRightSwipe) {
      const currentIndex = tabOptions.findIndex(tab => tab.id === activeTab);
      let newIndex;

      if (isLeftSwipe && currentIndex < tabOptions.length - 1) {
        newIndex = currentIndex + 1;
      } else if (isRightSwipe && currentIndex > 0) {
        newIndex = currentIndex - 1;
      } else {
        return;
      }

      const newTab = tabOptions[newIndex];
      setActiveTab(newTab.id);
      navigate(`/user/upload/${newTab.id}`);
    }
  };

  return (
    <div 
      className="upload-page-container"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="upload-page-header">
        <button
          onClick={() => navigate('/BookManagement')}
          className="upload-page-header-btn back-link"
        >
          <FiChevronLeft size={20} />
          <span>Back to books</span>
        </button>
        <h1 className="upload-page-header-title">
          Upload Content
        </h1>
      </div>

      {/* Mobile Tab Navigation */}
      {isMobile && (
        <div className="upload-page-mobile-tabs">
          {tabOptions.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                navigate(`/user/upload/${tab.id}`);
              }}
              className={`upload-page-mobile-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              <span className="upload-page-mobile-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Upload Content */}
      <React.Suspense fallback={
        <div className="upload-page-loading">
          <div className="upload-page-spinner"></div>
          <p className="upload-page-loading-text">
            Loading uploader...
          </p>
        </div>
      }>
        <AdminUIProvider>
          <Upload userProfile={userProfile} initialTab={activeTab} />
        </AdminUIProvider>
      </React.Suspense>
    </div>
  );
};

export default UserUploadPage;

