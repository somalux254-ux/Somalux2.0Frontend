import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Books from './Books';
import UniversitiesManagement from './UniversitiesManagement';
import PastPapersManagement from './PastPapersManagement';

const tabStyles = `
  .content-tabs {
    display: flex;
    width: 100%;
    margin-bottom: 8px;
  }
  .content-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    background: transparent !important;
    border: none;
    color: #8696a0;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    -webkit-tap-highlight-color: transparent;
    outline: none;
    background-color: transparent !important;
  }
  .content-tab.active {
    color: #00a884;
    background: transparent !important;
    background-color: transparent !important;
  }
  .content-page-tabs .content-tab:hover,
  .content-page-tabs .content-tab:active,
  .content-page-tabs .content-tab:focus,
  .content-page-tabs .content-tab:focus-visible,
  .content-page-tabs .content-tab.active {
    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
    outline: none !important;
  }
`;

const ContentManagement = ({ userProfile }) => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('books');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'pastpapers') {
      setActiveTab('pastpapers');
    } else if (tabParam === 'universities') {
      setActiveTab('universities');
    } else {
      setActiveTab('books');
    }
  }, [searchParams]);

  React.useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.innerHTML = tabStyles;
    document.head.appendChild(styleTag);
    return () => styleTag.remove();
  }, []);

  return (
    <div className="content-page">
      <div className="content-tabs content-page-tabs">
        <button 
          className={`content-tab ${activeTab === 'books' ? 'active' : ''}`}
          onClick={() => setActiveTab('books')}
        >
          Books
        </button>
        <button 
          className={`content-tab ${activeTab === 'universities' ? 'active' : ''}`}
          onClick={() => setActiveTab('universities')}
        >
          Universities
        </button>
        <button 
          className={`content-tab ${activeTab === 'pastpapers' ? 'active' : ''}`}
          onClick={() => setActiveTab('pastpapers')}
        >
          Past Papers
        </button>
      </div>

      {activeTab === 'books' && <Books userProfile={userProfile} />}
      {activeTab === 'universities' && <UniversitiesManagement userProfile={userProfile} />}
      {activeTab === 'pastpapers' && <PastPapersManagement userProfile={userProfile} />}
    </div>
  );
};

export default ContentManagement;