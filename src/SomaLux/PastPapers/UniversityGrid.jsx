import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMapPin, FiX } from 'react-icons/fi';
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

// Memoized university card component to prevent unnecessary re-renders
const UniversityCard = React.memo(({
  uni,
  searchTerm,
  onUniversitySelect,
}) => (
  <motion.div
    key={uni.id}
    className="paper-cardpast university-cardpast"
    style={{ 
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative'
    }}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3 }}
    layout
    whileHover={{ y: -5 }}
    onClick={() => onUniversitySelect(uni)}
  >
    {uni.cover_image_url && (
      <img
        src={uni.cover_image_url}
        alt={uni.name}
        loading="lazy"
        className="university-coverpast"
        style={{ 
          width: '100%', 
          objectFit: 'cover',
          borderBottom: '1px solid #2a3942'
        }}
      />
    )}

    <div className="card-contentpast" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ margin: 0, fontSize: '0.8rem', color: '#e9edef', fontWeight: '600' }}>
        {highlightSearchText(uni.name, searchTerm)}
      </h3>
      <p style={{ margin: '2px 0 0 0', fontSize: '0.65rem', color: '#8696a0' }}>
        {highlightSearchText(uni.location, searchTerm)}
      </p>
      
      <div style={{ 
        marginTop: 'auto', 
        paddingTop: '6px',
        borderTop: '1px solid #2a3942',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '4px'
      }}>
      </div>
    </div>
  </motion.div>
), (prevProps, nextProps) => {
  // Custom comparison for optimization
  return (
    prevProps.uni.id === nextProps.uni.id &&
    prevProps.onUniversitySelect === nextProps.onUniversitySelect &&
    prevProps.searchTerm === nextProps.searchTerm
  );
});

export const UniversityGrid = React.memo(({ universities, universitySearchTerm, setUniversitySearchTerm, onUniversitySelect, onAuthRequired, user }) => {
  const filteredUniversities = universities.filter(uni =>
    !universitySearchTerm ||
    uni.name?.toLowerCase().includes(universitySearchTerm.toLowerCase()) ||
    uni.location?.toLowerCase().includes(universitySearchTerm.toLowerCase())
  );

  if (filteredUniversities.length === 0) {
    return (
      <div className="empty-statepast">
        <FiMapPin size={48} />
        <h3>No universities found</h3>
        <p>Try adjusting your search</p>
        <button className="reset-filterspast" onClick={() => setUniversitySearchTerm('')}>
          Clear Search
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="controlspast university-search-rowpast">
        <div className="search-containerpast">
          <span className="search-iconpast" aria-hidden="true">
            <FaSearch size={14} />
          </span>
          <input
            type="text"
            placeholder="Search universities..."
            value={universitySearchTerm}
            onFocus={(e) => {
              if (!user) {
                e.currentTarget.blur();
                onAuthRequired?.('search');
              }
            }}
            onChange={(e) => {
              if (user) setUniversitySearchTerm(e.target.value);
            }}
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
          {universitySearchTerm && (
            <button
              onClick={() => setUniversitySearchTerm('')}
              className="clear-buttonpast"
              aria-label="Clear university search"
            >
              <FiX size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="gridpast">
        <AnimatePresence>
          {filteredUniversities.map((uni) => (
            <UniversityCard key={uni.id} uni={uni} searchTerm={universitySearchTerm} onUniversitySelect={onUniversitySelect} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
});

export default UniversityGrid;
