import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronLeft } from 'react-icons/fi';
import { FaSearch } from 'react-icons/fa';
import './PaperPanel.css';

const formatUniversityName = (name) => String(name || '')
  .trim()
  .toLowerCase()
  .split(/\s+/)
  .map(word => word.split('-').map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part).join('-'))
  .join(' ');

const formatFacultyName = formatUniversityName;

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
  universityFilter,
  onFacultySelect,
  onBack
}) => {
  const [facultySearchTerm, setFacultySearchTerm] = useState('');
  const [showFacultySearch, setShowFacultySearch] = useState(false);
  const facultySearchRef = useRef(null);
  const facultySearchToggleRef = useRef(null);

  useEffect(() => {
    if (!showFacultySearch) return undefined;

    const handleOutsideClick = (event) => {
      const clickedInput = facultySearchRef.current?.contains(event.target);
      const clickedToggle = facultySearchToggleRef.current?.contains(event.target);
      if (!clickedInput && !clickedToggle) {
        setShowFacultySearch(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showFacultySearch]);

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
        <div className="faculty-header-past">
          <button 
            onClick={onBack}
            className="back-button-past"
            aria-label="Back to papers"
            title="Back to papers"
          >
            <FiChevronLeft size={22} strokeWidth={3} />
          </button>
          <div className="faculty-header-copy-past">
            <h1>{formatUniversityName(universityFilter)} Faculties</h1>
          </div>
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
      <div className="faculty-header-past">
        <button 
          onClick={onBack}
          className="back-button-past"
          aria-label="Back to papers"
          title="Back to papers"
        >
          <FiChevronLeft size={22} strokeWidth={3} />
        </button>
        <div className="faculty-header-copy-past">
          <h1>{formatUniversityName(universityFilter)} Faculties</h1>
        </div>
        <button
          type="button"
          ref={facultySearchToggleRef}
          className="faculty-search-toggle-past"
          onClick={() => setShowFacultySearch(current => !current)}
          onDoubleClick={() => setShowFacultySearch(false)}
          aria-label="Search faculties"
          title="Search faculties"
        >
          <FaSearch size={17} />
        </button>
      </div>

      {/* Faculty Search */}
      {showFacultySearch && (
        <div
          ref={facultySearchRef}
          className="faculty-search-past"
          onDoubleClick={() => setShowFacultySearch(false)}
        >
          <div className="faculty-search-input-past">
            <FaSearch className="faculty-search-icon-past" />
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
              autoFocus
            />
            {facultySearchTerm && (
              <button
                type="button"
                onClick={() => setFacultySearchTerm('')}
                aria-label="Clear faculty search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Faculties Grid */}
      <div className="gridpast">
        <AnimatePresence>
          {filteredFaculties.map((faculty) => {
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
                      {highlightSearchText(formatFacultyName(faculty), facultySearchTerm)}
                    </h3>

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
