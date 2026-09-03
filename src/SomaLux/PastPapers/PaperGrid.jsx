import React, { useRef, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FiFileText, FiFilter, FiX, FiDownload, FiUpload, FiEye, FiBookmark, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { AiOutlineHeart, AiFillHeart } from 'react-icons/ai';
import { formatNumber } from './formatNumber';
import './PaperPanel.css';
import '../Books/Admin/admin.css';

const highlightSearchText = (text, searchText) => {
  const value = String(text || '');
  const query = String(searchText || '').trim();
  if (!query) return value;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return value.split(new RegExp(`(${escapedQuery})`, 'ig')).map((part, index) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={`${part}-${index}`} className="search-matchpast">{part}</mark>
      : part
  );
};

export const PaperGrid = React.memo(({
  displayedPapers,
  filteredPapers,
  currentPage,
  setCurrentPage,
  pageSize,
  showFilters,
  activeFilter,
  sortBy,
  searchTerm,
  toggleFilters,
  handleFilterChange,
  handleSortChange,
  setSearchTerm,
  user,
  onPaperSelect,
  onUploadClick,
  onAdminClick,
  paperLikes = {},
  paperLikesCounts = {},
  onToggleLike,
  paperBookmarks = [],
  paperBookmarksCounts = {},
  onToggleBookmark,
  faculties = [],
  facultyFilter = '',
  onFacultyClick
}) => {
  // Debounce search input to prevent excessive updates
  const searchInputRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const [localSearchValue, setLocalSearchValue] = useState(searchTerm);
  const [bubbles, setBubbles] = useState({});
  
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setLocalSearchValue(value);
    
    // Clear previous debounce
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    // Debounce the actual state update by 300ms
    searchDebounceRef.current = setTimeout(() => {
      setSearchTerm(value);
    }, 300);
  }, [setSearchTerm]);

  const createBubbles = useCallback((paperId) => {
    const newBubbles = [];
    const hearts = ['❤️', '💕', '💖', '💗', '💓', '💞', '💝'];
    
    for (let i = 0; i < 8; i++) {
      const randomOffset = (Math.random() - 0.5) * 140;
      const randomRotate = Math.random() * 360;
      newBubbles.push({
        id: Math.random(),
        heart: hearts[i % hearts.length],
        delay: i * 60,
        randomOffset: randomOffset,
        randomRotate: randomRotate
      });
    }
    
    setBubbles(prev => ({ ...prev, [paperId]: newBubbles }));
    
    // Clear bubbles after animation
    setTimeout(() => {
      setBubbles(prev => {
        const updated = { ...prev };
        delete updated[paperId];
        return updated;
      });
    }, 2600);
  }, []);

  const totalPages = Math.max(1, Math.ceil(filteredPapers.length / pageSize));

  return (
    <>
      {/* Search and Filter Controls */}
      <div className="controlspast">
        <div className="search-containerpast">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search papers by course, code or faculty..."
            value={localSearchValue}
            onChange={handleSearchChange}
            inputMode="search"
            enterKeyHint="search"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            className="search-inputpast"
            autoComplete="off"
          />
          {localSearchValue && (
            <button
              onClick={() => {
                setLocalSearchValue('');
                setSearchTerm('');
              }}
              className="clear-buttonpast"
            >
              <FiX size={16} />
            </button>
          )}
        </div>

        <div className="filter-wrapperpast">
          <button
            onClick={toggleFilters}
            className={`filter-buttonpast ${showFilters ? 'activepast' : ''}`}
            style={{ display: 'none' }}
          >
            <FiFilter /> {activeFilter !== 'all' && '• '}Filters
          </button>

          {((user?.role === 'admin' || user?.role === 'editor') || ['campuslives254@gmail.com', 'paltechsomalux@gmail.com', 'eliblearning@gmail.com'].includes(user?.email)) && (
            <button
              onClick={onAdminClick}
              className="filter-buttonpast"
              title="Open Admin Dashboard"
            >
              {user?.role === 'admin' || ['campuslives254@gmail.com', 'paltechsomalux@gmail.com', 'eliblearning@gmail.com'].includes(user?.email) ? 'Admin' : 'Editor'}
            </button>
          )}

          {user && (
            <button
              onClick={onUploadClick}
              className="filter-buttonpast"
              title="Upload a past paper"
            >
              <FiUpload size={16} /> Upload
            </button>
          )}

          {showFilters && (
            <div 
              className="filter-dropdownpast"
              style={{ display: 'none' }}
            >
              <div className="filter-sectionpast">
                <h4>Filter by:</h4>
                <div
                  className={`filter-optionpast ${activeFilter === 'all' ? 'activepast' : ''}`}
                  onClick={() => handleFilterChange('all')}
                >
                  All Papers
                </div>

                {faculties && faculties.length > 0 && (
                  <div
                    className={`filter-optionpast ${activeFilter === 'faculty' ? 'activepast' : ''}`}
                    onClick={() => onFacultyClick?.()}
                    style={{ cursor: 'pointer', fontWeight: 'bold', color: '#00a884' }}
                  >
                    📚 Faculty
                  </div>
                )}
              </div>
              <div className="filter-sectionpast">
                <h4>Sort by:</h4>
                <div
                  className={`filter-optionpast ${sortBy === 'default' ? 'activepast' : ''}`}
                  onClick={() => handleSortChange('default')}
                >
                  Default
                </div>
                <div
                  className={`filter-optionpast ${sortBy === 'title' ? 'activepast' : ''}`}
                  onClick={() => handleSortChange('title')}
                >
                  Title (A-Z)
                </div>
                <div
                  className={`filter-optionpast ${sortBy === 'course' ? 'activepast' : ''}`}
                  onClick={() => handleSortChange('course')}
                >
                  Course (A-Z)
                </div>
                <div
                  className={`filter-optionpast ${sortBy === 'year' ? 'activepast' : ''}`}
                  onClick={() => handleSortChange('year')}
                >
                  Year (Newest)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="gridpast">
            {displayedPapers.map((paper, index) => {
                if (index < 0) {
                  return (
                    <React.Fragment key={`ad-position-${index}`}>
                      {/* Grid Ad */}
                      <motion.div
                        key="grid-ad-pastpapers"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        layout
                      >
                        <div style={{ height: '100%' }}>
                        </div>
                      </motion.div>
                      
                      {/* Current Paper */}
                      <motion.div
                        key={paper.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        layout
                      >
                        <div
                          className="paper-cardpast"
                          onClick={() => onPaperSelect(paper)}
                        >
                    {/* Paper Cover - Always show placeholder */}
                    <div className="paper-snapshotpast">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <FiFileText size={24} />
                        <span style={{ fontSize: '0.75rem' }}>{paper.course ? (paper.courseCode ? `${paper.course} ${paper.courseCode}` : paper.course) : paper.courseCode || 'Paper'}</span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="card-contentpast">
                      <h3 className="paper-titlepast">
                        {highlightSearchText(paper.course ? `${paper.course}${paper.courseCode ? ` ${paper.courseCode}` : ''}` : paper.courseCode || paper.title, searchTerm)}
                      </h3>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.6em', color: '#8696a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minHeight: '14px' }}>
                        {paper.faculty && <span>{highlightSearchText(paper.faculty, searchTerm)}</span>}
                        {paper.year && <span>•</span>}
                        {paper.year && <span>{paper.year}</span>}
                        {paper.semester && <span>•</span>}
                        {paper.semester && <span>Sem {paper.semester}</span>}
                        {paper.exam_type && <span>•</span>}
                        {paper.exam_type && <span>{paper.exam_type}</span>}
                      </div>
                    </div>

                    {/* Stats Footer */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid #2a3942',
                      padding: '4px 4px',
                      gap: '2px'
                    }}>
                      <span style={{ fontSize: '0.55rem', color: '#8696a0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                        <FiEye size={11} /> {formatNumber(paper.views || 0)}
                      </span>
                      <span style={{ fontSize: '0.55rem', color: '#8696a0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                        <FiDownload size={11} /> {formatNumber(paper.downloads_count || 0)}
                      </span>
                      {user && (
                        <>
                          <div style={{ position: 'relative', display: 'inline-flex', overflow: 'visible', width: 'fit-content' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleLike?.(paper.id);
                                createBubbles(paper.id);
                              }}
                              className={`love-buttonpast ${paperLikes[paper.id] ? 'activepast' : ''}`}
                              title={paperLikes[paper.id] ? "Unlike" : "Like"}
                              style={{
                                fontSize: '0.55rem',
                                color: paperLikes[paper.id] ? '#ef4444' : '#8696a0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '2px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '0',
                                margin: '0',
                                lineHeight: '1',
                                fontFamily: 'inherit',
                                transition: 'all 0.2s',
                                position: 'relative',
                                isolation: 'isolate'
                              }}
                            >
                              {paperLikes[paper.id] ? <AiFillHeart size={11} /> : <AiOutlineHeart size={11} />}
                              {bubbles[paper.id] && bubbles[paper.id].map((bubble) => (
                                <div
                                  key={bubble.id}
                                  className="love-bubble heart"
                                  style={{
                                    animationDelay: `${bubble.delay}ms`,
                                    '--random-x': `${bubble.randomOffset}px`,
                                    '--random-rotate': `${bubble.randomRotate}deg`
                                  }}
                                >
                                  {bubble.heart}
                                </div>
                              ))}
                            </button>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleBookmark?.(paper.id);
                            }}
                            className={`bookmark-buttonpast ${paperBookmarks.includes(paper.id) ? 'activepast' : ''}`}
                            title={paperBookmarks.includes(paper.id) ? "Remove bookmark" : "Bookmark"}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                              color: paperBookmarks.includes(paper.id) ? '#00a884' : '#8696a0',
                              padding: '2px 2px',
                              fontSize: '0.8rem',
                              transition: 'all 0.2s'
                            }}
                          >
                            <FiBookmark size={10} fill={paperBookmarks.includes(paper.id) ? '#00a884' : 'none'} />
                          </button>
                        </>
                      )}
                    </div>
                        </div>
                      </motion.div>
                    </React.Fragment>
                  );
                }
                
                // Render regular paper card
                return (
                  <motion.div
                    key={paper.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    layout
                  >
                    <div
                      className="paper-cardpast"
                      onClick={() => onPaperSelect(paper)}
                    >
                      {/* Paper Cover - Always show placeholder */}
                      <div className="paper-snapshotpast">
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <FiFileText size={24} />
                          <span style={{ fontSize: '0.75rem' }}>{paper.course ? (paper.courseCode ? `${paper.course} ${paper.courseCode}` : paper.course) : paper.courseCode || 'Paper'}</span>
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="card-contentpast">
                        <h3 className="paper-titlepast">
                          {highlightSearchText(paper.course ? `${paper.course}${paper.courseCode ? ` ${paper.courseCode}` : ''}` : paper.courseCode || paper.title, searchTerm)}
                        </h3>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.6em', color: '#8696a0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minHeight: '14px' }}>
                          {paper.faculty && <span>{highlightSearchText(paper.faculty, searchTerm)}</span>}
                          {paper.year && <span>•</span>}
                          {paper.year && <span>{paper.year}</span>}
                          {paper.semester && <span>•</span>}
                          {paper.semester && <span>Sem {paper.semester}</span>}
                          {paper.exam_type && <span>•</span>}
                          {paper.exam_type && <span>{paper.exam_type}</span>}
                        </div>
                      </div>

                      {/* Stats Footer */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: '1px solid #2a3942',
                        padding: '4px 4px',
                        gap: '2px'
                      }}>
                        <span style={{ fontSize: '0.55rem', color: '#8696a0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                          <FiEye size={11} /> {formatNumber(paper.views || 0)}
                        </span>
                        <span style={{ fontSize: '0.55rem', color: '#8696a0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                          <FiDownload size={11} /> {formatNumber(paper.downloads_count || 0)}
                        </span>
                        {user && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleLike?.(paper.id);
                                createBubbles(paper.id);
                              }}
                              className={`love-buttonpast ${paperLikes[paper.id] ? 'activepast' : ''}`}
                              title={paperLikes[paper.id] ? "Unlike" : "Like"}
                              style={{
                                fontSize: '0.55rem',
                                color: paperLikes[paper.id] ? '#FF1493' : '#8696a0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '2px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '0',
                                margin: '0',
                                lineHeight: '1',
                                fontFamily: 'inherit',
                                transition: 'all 0.2s',
                                position: 'relative',
                                isolation: 'isolate'
                              }}
                            >
                              {paperLikes[paper.id] ? <AiFillHeart size={11} /> : <AiOutlineHeart size={11} />}
                              {bubbles[paper.id] && bubbles[paper.id].map((bubble) => (
                                <div
                                  key={bubble.id}
                                  className="love-bubble heart"
                                  style={{
                                    animationDelay: `${bubble.delay}ms`,
                                    '--random-x': `${bubble.randomOffset}px`,
                                    '--random-rotate': `${bubble.randomRotate}deg`
                                  }}
                                >
                                  {bubble.heart}
                                </div>
                              ))}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleBookmark?.(paper.id);
                              }}
                              className={`bookmark-buttonpast ${paperBookmarks.includes(paper.id) ? 'activepast' : ''}`}
                              title={paperBookmarks.includes(paper.id) ? "Remove bookmark" : "Bookmark"}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                                color: paperBookmarks.includes(paper.id) ? '#00a884' : '#8696a0',
                                padding: '2px 2px',
                                fontSize: '0.8rem',
                                transition: 'all 0.2s'
                              }}
                            >
                              <FiBookmark size={10} fill={paperBookmarks.includes(paper.id) ? '#00a884' : 'none'} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
          </div>

          {/* Pagination Controls */}
          <div
            className="actions"
            style={{
              marginTop: 10,
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px'
            }}
          >
            <button className="btn" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
              ← Prev
            </button>

            <span
              style={{
                color: '#cfd8dc',
                fontSize: 12
              }}
            >
              Page {currentPage} of {totalPages}
            </span>

            <button className="btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
              Next →
            </button>
          </div>
    </>
  );
});

export default PaperGrid;
