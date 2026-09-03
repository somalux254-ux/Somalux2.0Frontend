import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiBook, FiMapPin, FiFileText } from 'react-icons/fi';
import Books from './Books';
import UniversitiesManagement from './UniversitiesManagement';
import PastPapersManagement from './PastPapersManagement';

const tabStyles = `
  .content-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
    border-bottom: 1px solid #374151;
  }
  .content-tab {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: transparent;
    border: none;
    color: #8696a0;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s ease;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .content-tab:hover {
    color: #e9edef;
    background: rgba(0, 168, 132, 0.05);
  }
  .content-tab.active {
    color: #00a884;
    border-bottom-color: #00a884;
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
    <div>
      <div className="content-tabs">
        <button 
          className={`content-tab ${activeTab === 'books' ? 'active' : ''}`}
          onClick={() => setActiveTab('books')}
        >
          <FiBook size={20} />
          Books
        </button>
        <button 
          className={`content-tab ${activeTab === 'universities' ? 'active' : ''}`}
          onClick={() => setActiveTab('universities')}
        >
          <FiMapPin size={20} />
          Universities
        </button>
        <button 
          className={`content-tab ${activeTab === 'pastpapers' ? 'active' : ''}`}
          onClick={() => setActiveTab('pastpapers')}
        >
          <FiFileText size={20} />
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