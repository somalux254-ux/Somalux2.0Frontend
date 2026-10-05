import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMapPin, FiX } from 'react-icons/fi';
import { FaSearch } from 'react-icons/fa';
import './PaperPanel.css';

const formatUniversityName = (name) => String(name || '')
  .trim()
  .toLowerCase()
  .split(/\s+/)
  .map(word => word.split('-').map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part).join('-'))
  .join(' ');

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
  <motion.button
    type="button"
    className="paper-cardpast university-cardpast"
    style={{ 
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      appearance: 'none',
      border: 0,
      padding: 0,
      color: 'inherit',
      font: 'inherit',
      textAlign: 'left',
      touchAction: 'manipulation'
    }}
    exit={{ opacity: 0 }}
    onClick={() => onUniversitySelect(uni)}
  >
    {uni.cover_image_url && (
      <img
        src={uni.cover_image_url}
        alt={formatUniversityName(uni.name)}
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
        {highlightSearchText(formatUniversityName(uni.name), searchTerm)}
      </h3>
      <p style={{ margin: '2px 0 0 0', fontSize: '0.65rem', color: '#8696a0' }}>
        {highlightSearchText(uni.location, searchTerm)}
      </p>
    </div>
  </motion.button>
), (prevProps, nextProps) => {
  // Custom comparison for optimization
  return (
    prevProps.uni.id === nextProps.uni.id &&
    prevProps.onUniversitySelect === nextProps.onUniversitySelect &&
    prevProps.searchTerm === nextProps.searchTerm
  );
});

export const UniversityGrid = React.memo(({ universities, universitySearchTerm, setUniversitySearchTerm, onUniversitySelect, onAuthRequired, user }) => {
  const [debouncedSearchTerm, setDebouncedSearchTerm] = React.useState(universitySearchTerm);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(universitySearchTerm), 300);
    return () => clearTimeout(timer);
  }, [universitySearchTerm]);

  const normalizedSearchTerm = debouncedSearchTerm.trim().toLowerCase();
  const filteredUniversities = React.useMemo(() => (universities || []).filter((uni) =>
    !normalizedSearchTerm ||
    uni.name?.toLowerCase().includes(normalizedSearchTerm) ||
    uni.location?.toLowerCase().includes(normalizedSearchTerm)
  ), [universities, normalizedSearchTerm]);

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
              title="Clear search"
            >
              <FiX size={16} />
            </button>
          )}
        </div>
      </div>
      {filteredUniversities.length > 0 ? (
        <div className="gridpast university-gridpast">
          <AnimatePresence>
            {filteredUniversities.map((uni) => (
              <UniversityCard key={uni.id} uni={uni} searchTerm={debouncedSearchTerm} onUniversitySelect={onUniversitySelect} />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="empty-statepast">
          <FiMapPin size={48} />
          <h3>No universities found</h3>
          <p>Try adjusting your search</p>
          {universitySearchTerm && (
            <button className="reset-filterspast" onClick={() => setUniversitySearchTerm('')}>
              Clear Search
            </button>
          )}
        </div>
      )}
    </>
  );
});

export default UniversityGrid;
