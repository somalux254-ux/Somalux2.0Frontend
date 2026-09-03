import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiEye, FiChevronLeft } from 'react-icons/fi';
import { MdVerified } from 'react-icons/md';
import { AiOutlineHeart, AiFillHeart } from 'react-icons/ai';
import { FaSearch } from 'react-icons/fa';
import { formatNumber } from './formatNumber';
import './PaperPanel.css';

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

// Floating bubbles component for likes
const FloatingBubbles = ({ bubbles }) => (
  <div>
    {bubbles.map((bubble) => (
      <div
        key={bubble.id}
        className="paper-love-bubble heart"
        style={{
          '--random-x': `${bubble.randomOffset}px`,
          animationDelay: `${bubble.delay}ms`,
        }}
      >
        {bubble.heart}
      </div>
    ))}
  </div>
);

// Color palette moved outside component to prevent recreation
const COLOR_GRADIENTS = [
  { light: '#1a47a0', dark: '#2563eb' },      // Blue
  { light: '#7c2d12', dark: '#ea580c' },      // Orange
  { light: '#831843', dark: '#ec4899' },      // Pink
  { light: '#1e293b', dark: '#64748b' },      // Gray
  { light: '#15803d', dark: '#22c55e' },      // Green
  { light: '#5b21b6', dark: '#a855f7' },      // Purple
  { light: '#0369a1', dark: '#0ea5e9' },      // Cyan
  { light: '#92400e', dark: '#f59e0b' },      // Amber
  { light: '#be123c', dark: '#f43f5e' },      // Rose
  { light: '#164e63', dark: '#06b6d4' },      // Teal
];

const getColorGradient = (faculty) => {
  const hash = faculty.charCodeAt(0) + faculty.length;
  const index = hash % COLOR_GRADIENTS.length;
  return COLOR_GRADIENTS[index];
};

export const FacultyGridDisplay = React.memo(({
  faculties,
  papers,
  universityFilter,
  onFacultySelect,
  onBack,
  facultyViews = {},
  onToggleLike,
  facultyLikes = {},
  facultyLikesCounts = {},
  user
}) => {
  const [facultySearchTerm, setFacultySearchTerm] = useState('');
  const [bubbleMap, setBubbleMap] = useState({});

  const handleFacultyLike = useCallback((faculty) => {
    const hearts = ['❤️', '💕', '💖', '💗', '💓', '💞', '💝', '💟'];
    const newBubbles = Array.from({ length: 10 }, (_, i) => ({
      id: `${faculty}-${Date.now()}-${i}`,
      heart: hearts[Math.floor(Math.random() * hearts.length)],
      delay: i * 60,
      randomOffset: (Math.random() - 0.5) * 140,
    }));

    setBubbleMap(prev => ({
      ...prev,
      [faculty]: newBubbles,
    }));

    // Call the actual toggle like function
    onToggleLike?.(faculty);

    // Clear bubbles after animation completes
    setTimeout(() => {
      setBubbleMap(prev => ({
        ...prev,
        [faculty]: [],
      }));
    }, 4200);
  }, [onToggleLike]);

  // Count papers per faculty for selected university
  const facultyPaperCounts = useMemo(() => {
    const counts = {};
    if (universityFilter && Array.isArray(faculties)) {
      faculties.forEach(faculty => {
        counts[faculty] = papers.filter(p => 
          p.university?.toLowerCase() === universityFilter.toLowerCase() &&
          p.faculty?.toLowerCase() === faculty.toLowerCase()
        ).length;
      });
    }
    return counts;
  }, [faculties, papers, universityFilter]);

  const filteredFaculties = useMemo(() => {
    if (!Array.isArray(faculties)) return [];
    return faculties.filter(faculty => 
      !facultySearchTerm || 
      faculty?.toLowerCase().includes(facultySearchTerm.toLowerCase())
    );
  }, [faculties, facultySearchTerm]);

  if (filteredFaculties.length === 0) {
    return (
      <div className="containerpast" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(134, 150, 160, 0.2)' }}>
          <button 
            onClick={onBack}
            className="back-button-past"
            title="Back to papers"
          >
            <FiChevronLeft size={18} /> Back
          </button>
          <span style={{ color: '#8696a0' }}>|</span>
        </div>

        <div style={{ textAlign: 'center', marginTop: '48px' }}>
          <h2 style={{ color: '#e9edef', marginBottom: '8px' }}>No faculties found</h2>
          <p style={{ color: '#8696a0', marginBottom: '20px' }}>Try adjusting your search</p>
          <button 
            className="reset-filterspast"
            onClick={() => setFacultySearchTerm('')}
          >
            Clear Search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="containerpast" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Back Button Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(134, 150, 160, 0.2)' }}>
        <button 
          onClick={onBack}
          className="back-button-past"
          title="Back to papers"
        >
          <FiChevronLeft size={18} /> Back
        </button>
        <span style={{ color: '#8696a0' }}>|</span>
        <h1 style={{ color: '#e9edef', margin: 0, fontSize: '1.3rem' }}>Faculties in {universityFilter}</h1>
      </div>

      {/* Faculty Search */}
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: '24px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', maxWidth: '500px' }}>
          <FaSearch style={{ position: 'absolute', left: '12px', color: '#8696a0' }} />
          <input
            type="text"
            placeholder="Search faculties..."
            value={facultySearchTerm}
            onChange={(e) => setFacultySearchTerm(e.target.value)}
            inputMode="search"
            enterKeyHint="search"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            style={{ 
              padding: '8px 32px 8px 40px', 
              width: '100%', 
              border: '1px solid #2a3942', 
              borderRadius: '4px', 
              fontSize: '0.9em', 
              boxSizing: 'border-box', 
              background: '#111b21', 
              color: '#e9edef', 
              outline: 'none' 
            }}
          />
          {facultySearchTerm && (
            <button 
              onClick={() => setFacultySearchTerm('')}
              style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', color: '#8696a0', cursor: 'pointer', fontSize: '1em' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Faculties Grid */}
      <div className="gridpast">
        <AnimatePresence>
          {filteredFaculties.map((faculty, index) => {
            const paperCount = facultyPaperCounts[faculty] || 0;
            const viewCount = facultyViews?.[faculty] || 0;
            const isLiked = facultyLikes?.[faculty];
            const { light, dark } = getColorGradient(faculty);

            return (
              <motion.div
                key={faculty}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.05 }}
                layout
              >
                <div
                  className="paper-cardpast"
                  onClick={() => onFacultySelect(faculty)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Faculty Card Header with Icon */}
                  <div className="card-header-pastpast" style={{ position: 'relative', height: '120px', background: `linear-gradient(135deg, ${light} 0%, ${dark} 100%)`, borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <div style={{ fontSize: '48px', fontWeight: '700', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                      {faculty.substring(0, 1).toUpperCase()}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="card-contentpast" style={{ padding: '12px', flex: '1', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#e9edef', fontWeight: '600', lineHeight: '1.3', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {highlightSearchText(faculty, facultySearchTerm)}
                    </h3>

                    {/* Stats Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#8696a0', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #202c33' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FiEye size={12} />
                        <span>{formatNumber(viewCount)}</span>
                      </div>
                      {user && user.subscription_tier && (user.subscription_tier === 'premium' || user.subscription_tier === 'premium_pro') ? (
                        <div style={{ color: '#00a884', fontWeight: '600' }}>
                          {paperCount} papers
                        </div>
                      ) : user ? (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          style={{ color: '#1DA1F2', display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }} 
                          title="Premium feature"
                        >
                          <MdVerified size={12} />
                        </div>
                      ) : (
                        <div style={{ color: '#00a884', fontWeight: '600' }}>
                          {paperCount} papers
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFacultyLike(faculty);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: isLiked ? '#e63946' : '#8696a0',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          padding: 0,
                          position: 'relative',
                        }}
                        title={isLiked ? 'Unlike' : 'Like'}
                      >
                        {isLiked ? <AiFillHeart size={14} /> : <AiOutlineHeart size={14} />}
                        <FloatingBubbles bubbles={bubbleMap[faculty] || []} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
});

export default FacultyGridDisplay;
