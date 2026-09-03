import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createBookSubmission, createBook } from '../api';
import { createPastPaper, createPastPaperSubmission, getUniversitiesForDropdown, getFacultiesByUniversity, getUnitNamesByUniversityAndFaculty, getYearsByUniversityFacultyAndUnitName, checkDuplicatePastPaper } from '../pastPapersApi';
import { FiUpload, FiFile, FiImage, FiBook, FiFileText, FiSearch, FiX, FiLoader } from 'react-icons/fi';
import { useAdminUI } from '../AdminUIContext';
import * as pdfjsLib from 'pdfjs-dist';

// Add styles for drag and drop effect and tabs
const dropzoneStyles = `
  .dropzone {
    border: 2px dashed #374151;
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  .dropzone:hover {
    border-color: #00a884;
    background: rgba(0, 168, 132, 0.05);
  }
  .dropzone.drag-over {
    border-color: #00a884;
    background: rgba(0, 168, 132, 0.1);
  }
  .upload-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    border-bottom: 2px solid #374151;
  }
  .upload-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: transparent;
    border: none;
    color: #8696a0;
    cursor: pointer;
    font-size: 16px;
    font-weight: 500;
    transition: all 0.3s ease;
    border-bottom: 3px solid transparent;
    margin-bottom: -2px;
  }
  .upload-tab:hover {
    color: #e9edef;
    background: rgba(0, 168, 132, 0.05);
  }
  .upload-tab.active {
    color: #00a884;
    border-bottom-color: #00a884;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spin {
    animation: spin 1s linear infinite;
  }
`;

const Upload = ({ userProfile, initialTab = 'books' }) => {
  // Add style tag to document
  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.innerHTML = dropzoneStyles;
    document.head.appendChild(styleTag);
    return () => styleTag.remove();
  }, []);

  const [activeTab, setActiveTab] = useState(initialTab); // 'books', 'pastpapers'
  const navigate = useNavigate();
  const { showToast } = useAdminUI();

  // Update active tab when initialTab prop changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  
  // Books state
  const [pdf, setPdf] = useState(null);
  const [cover, setCover] = useState(null);
  const [bookForm, setBookForm] = useState({ 
    title: '', author: '', description: '',
    year: '', language: '', isbn: '', pages: '', publisher: '' 
  });

  // Past Papers state
  const [paperPdf, setPaperPdf] = useState(null);
  const [universities, setUniversities] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [unitNames, setUnitNames] = useState([]);
  const [years, setYears] = useState([]);
  const [paperForm, setPaperForm] = useState({ 
    university_id: '', faculty: '', unit_code: '', 
    unit_name: '', year: '', semester: '', exam_type: '' 
  });
  
  // Custom value states for Faculty, Unit Name, and Year
  const [useCustomFaculty, setUseCustomFaculty] = useState(false);
  const [customFaculty, setCustomFaculty] = useState('');
  const [useCustomUnitName, setUseCustomUnitName] = useState(false);
  const [customUnitName, setCustomUnitName] = useState('');
  const [useCustomYear, setUseCustomYear] = useState(false);
  const [customYear, setCustomYear] = useState('');
  
  // Success state for past paper upload
  const [lastUploadedPaper, setLastUploadedPaper] = useState(null);

  const [busy, setBusy] = useState(false);
  const [extractingCover, setExtractingCover] = useState(false);

  useEffect(() => { 
    (async () => { 
      try { 
        setUniversities(await getUniversitiesForDropdown());
      } catch {} 
    })(); 
  }, []);

  // Auto-extract cover from PDF when PDF is selected
  useEffect(() => {
    if (!pdf) return;

    const extractCoverFromPDF = async () => {
      setExtractingCover(true);
      try {
        // Set worker if not already set - use local worker file
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        }

        const arrayBuffer = await pdf.arrayBuffer();
        
        // Add a small delay to ensure worker is initialized
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        if (pdfDoc && pdfDoc.numPages > 0) {
          try {
            const page = await pdfDoc.getPage(1);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            const context = canvas.getContext('2d');
            if (context) {
              await page.render({ canvasContext: context, viewport }).promise;
              
              // Convert canvas to blob and create a file
              canvas.toBlob((blob) => {
                if (blob) {
                  const coverFile = new File([blob], `${pdf.name.replace('.pdf', '')}_cover.png`, { type: 'image/png' });
                  setCover(coverFile);
                  showToast({ type: 'success', message: 'Cover image extracted from PDF!' });
                }
              }, 'image/png', 0.95);
            }
          } catch (pageError) {
            console.warn('Could not render PDF page:', pageError);
            showToast({ type: 'info', message: 'Could not auto-extract cover. You can upload one manually.' });
          }
        }

        // Also extract author and title metadata
        try {
          let author = '';
          let title = '';
          
          // Try to get PDF metadata
          try {
            const metadata = await pdfDoc.getMetadata().catch(() => null);
            if (metadata && metadata.info) {
              author = (metadata.info.Author || metadata.info.author || '').trim();
              title = (metadata.info.Title || metadata.info.title || '').trim();
            }
          } catch (e) {
            console.warn('Could not extract PDF metadata:', e);
          }
          
          // If we couldn't get author from metadata, try to extract from text
          if (!author && pdfDoc.numPages > 0) {
            try {
              // Get first 5 pages for comprehensive extraction
              let pageText = '';
              const pagesToCheck = Math.min(5, pdfDoc.numPages);
              
              for (let i = 1; i <= pagesToCheck; i++) {
                try {
                  const page = await pdfDoc.getPage(i);
                  const textContent = await page.getTextContent();
                  pageText += ' ' + textContent.items.map(item => item.str).join(' ');
                } catch (e) {
                  console.warn(`Could not extract text from page ${i}`);
                }
              }
              
              // Normalize whitespace
              pageText = pageText.replace(/\s+/g, ' ').trim();
              
              // Split into lines for better pattern matching
              const lines = pageText.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
              
              // Helper function to validate author names
              const isValidAuthorName = (name) => {
                if (!name) return false;
                if (name.length < 3) return false;
                if (/^\d+$/.test(name)) return false;
                if (!/^[A-Z]/.test(name)) return false;
                if ((name.match(/[,;]/g) || []).length > 2) return false;
                return true;
              };
              
              // Helper function to clean author names
              const cleanAuthorName = (name) => {
                if (!name) return '';
                name = name.replace(/\s+/g, ' ').trim();
                name = name.replace(/[.,;:!?]+$/, '').trim();
                if (name.includes(',')) {
                  const parts = name.split(',').map(p => p.trim());
                  if (parts.length === 2) {
                    name = `${parts[1]} ${parts[0]}`.trim();
                  }
                }
                if (name.length > 100) {
                  name = name.split(/[,;]/)[0].trim();
                }
                return name;
              };
              
              // Pattern 1: Explicit "Author:" or "Authors:" label
              if (!author) {
                const match = pageText.match(/\bauthors?:\s*([A-Z][A-Za-z\s\-'.&,]+?)(?=\n|;|©|\d{4}|ISBN|Edition|$)/i);
                if (match && isValidAuthorName(match[1])) {
                  author = cleanAuthorName(match[1]);
                }
              }
              
              // Pattern 2: "by Author Name" format
              if (!author) {
                const match = pageText.match(/\bby\s+([A-Z][A-Za-z\s\-'.&,]+?)(?=\n|\.|;|,\s*\d{4}|©|ISBN|$)/i);
                if (match && isValidAuthorName(match[1])) {
                  author = cleanAuthorName(match[1]);
                }
              }
              
              // Pattern 3: Look in title pages (usually lines near top)
              if (!author && lines.length > 0) {
                for (let i = 0; i < Math.min(20, lines.length); i++) {
                  const line = lines[i];
                  const nameMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})$/);
                  if (nameMatch && isValidAuthorName(nameMatch[1]) && nameMatch[1].length > 4) {
                    if (!/^(Chapter|Introduction|Foreword|Preface|Contents|Index|Appendix|Bibliography)$/i.test(nameMatch[1])) {
                      author = cleanAuthorName(nameMatch[1]);
                      break;
                    }
                  }
                }
              }
              
              // Pattern 4: "Written by", "Authored by", "Compiled by", etc.
              if (!author) {
                const match = pageText.match(/(?:written|authored|compiled|created|edited)\s+by\s+([A-Z][A-Za-z\s\-'.&,]+?)(?=\n|;|,\s*\d{4}|©|$)/i);
                if (match && isValidAuthorName(match[1])) {
                  author = cleanAuthorName(match[1]);
                }
              }
              
              // Pattern 5: Name before year or edition indicators
              if (!author) {
                const match = pageText.match(/([A-Z][A-Za-z\s\-'.&]+?)\s+(?:Edition|©\s*\d{4}|\d{4}|ISBN)/);
                if (match && isValidAuthorName(match[1])) {
                  author = cleanAuthorName(match[1]);
                }
              }
              
              // Pattern 6: University/Organization authors
              if (!author) {
                const match = pageText.match(/([A-Z][A-Za-z\s\-'.&]*(?:University|Institute|College|Department|Laboratory|Press))/);
                if (match && isValidAuthorName(match[1])) {
                  author = cleanAuthorName(match[1]);
                }
              }
              
              // Pattern 7: Multiple author format
              if (!author) {
                const match = pageText.match(/([A-Z][A-Za-z\s\-'.]+?)\s+(?:and|,)\s+([A-Z][A-Za-z\s\-'.]+?)(?=\n|;|,\s*\d{4}|©|$)/);
                if (match && isValidAuthorName(match[1])) {
                  author = cleanAuthorName(match[1]);
                }
              }
              
              // Pattern 8: ALL CAPS names (older books)
              if (!author) {
                const allCapsLines = lines.filter(l => /^[A-Z\s\-'.&]+$/.test(l) && l.length > 3);
                for (const line of allCapsLines) {
                  if (isValidAuthorName(line)) {
                    const name = line.split(/\s+/).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
                    if (isValidAuthorName(name)) {
                      author = cleanAuthorName(name);
                      break;
                    }
                  }
                }
              }
            } catch (e) {
              console.warn('Could not extract text from PDF:', e);
            }
          }
          
          // Update form with extracted data if not already filled
          if (author || title) {
            setBookForm(prev => ({
              ...prev,
              author: author || prev.author,
              title: title || prev.title || (pdf?.name?.replace(/\.[^/.]+$/, '') || '')
            }));
          } else if (!bookForm.title) {
            // At least set title from filename
            setBookForm(prev => ({
              ...prev,
              title: pdf?.name?.replace(/\.[^/.]+$/, '') || ''
            }));
          }
        } catch (e) {
          console.warn('Error extracting PDF metadata:', e);
        }
      } catch (error) {
        console.error('Error extracting cover from PDF:', error);
        // Don't show error toast - this is optional, user can upload manual cover
        showToast({ type: 'info', message: 'Could not auto-extract cover. You can upload one manually.' });
      } finally {
        setExtractingCover(false);
      }
    };

    extractCoverFromPDF();
  }, [pdf, showToast]);

  const onBookChange = (k) => (e) => setBookForm((f) => ({ ...f, [k]: e.target.value }));
  const onPaperChange = (k) => async (e) => {
    const value = e.target.value;
    setPaperForm((f) => ({ ...f, [k]: value }));
    
    // When university changes, fetch faculties for that university
    if (k === 'university_id' && value) {
      try {
        const facultiesData = await getFacultiesByUniversity(value);
        setFaculties(facultiesData);
        // Reset faculty, unit name, and year selection when university changes
        setPaperForm((f) => ({ ...f, faculty: '', unit_name: '', year: '' }));
        setUnitNames([]);
        setYears([]);
      } catch (error) {
        console.error('Error fetching faculties:', error);
        setFaculties([]);
      }
    }
    
    // When faculty changes, fetch unit names for that faculty and university
    if (k === 'faculty' && value && paperForm.university_id) {
      try {
        const unitNamesData = await getUnitNamesByUniversityAndFaculty(paperForm.university_id, value);
        setUnitNames(unitNamesData);
        // Reset unit name and year selection when faculty changes
        setPaperForm((f) => ({ ...f, unit_name: '', year: '' }));
        setYears([]);
      } catch (error) {
        console.error('Error fetching unit names:', error);
        setUnitNames([]);
      }
    }
    
    // When unit name changes, fetch years for that unit, faculty, and university
    if (k === 'unit_name' && value && paperForm.university_id && paperForm.faculty) {
      try {
        const yearsData = await getYearsByUniversityFacultyAndUnitName(paperForm.university_id, paperForm.faculty, value);
        setYears(yearsData);
        // Reset year selection when unit name changes
        setPaperForm((f) => ({ ...f, year: '' }));
      } catch (error) {
        console.error('Error fetching years:', error);
        setYears([]);
      }
    }
  };

  const submitBook = async () => {
    if (!pdf) { showToast({ type: 'error', message: 'Please choose a PDF file.' }); return; }
    setBusy(true);
    try {
      const metadata = {
        title: bookForm.title || (pdf?.name?.replace(/\.[^/.]+$/, '') || ''),
        author: bookForm.author || 'Unknown',
        description: bookForm.description || '',
        year: bookForm.year ? Number(bookForm.year) : null,
        language: bookForm.language || '',
        isbn: bookForm.isbn || '',
        pages: bookForm.pages ? Number(bookForm.pages) : 0,
        publisher: bookForm.publisher || '',
        uploaded_by: userProfile?.id || null
      };
      
      console.log('📤 Submitting book with metadata:', metadata);
      
      // Check if user is admin or editor - if so, directly upload; otherwise submit for approval
      const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'editor';
      
      if (isAdmin) {
        await createBook({ metadata, pdfFile: pdf, coverFile: cover });
        showToast({ type: 'success', message: 'Book uploaded successfully!' });
      } else {
        await createBookSubmission({ metadata, pdfFile: pdf, coverFile: cover });
        showToast({ type: 'success', message: 'Book submitted for approval. Admin will review it shortly.' });
      }
      
      // Reset form
      setPdf(null);
      setCover(null);
      setBookForm({ title: '', author: '', description: '', year: '', language: '', isbn: '', pages: '', publisher: '' });
      navigate('/user/upload');
    } catch (e) {
      console.error('Book upload failed:', e);
      showToast({ type: 'error', message: e?.message || 'Upload failed.' });
    } finally { setBusy(false); }
  };

  const submitPastPaper = async () => {
    if (!paperPdf) { showToast({ type: 'error', message: 'Please choose a PDF file.' }); return; }
    if (!paperForm.university_id) { showToast({ type: 'error', message: 'Please select a university.' }); return; }
    
    // Validate faculty - either from dropdown or custom input
    const faculty = useCustomFaculty ? customFaculty : paperForm.faculty;
    if (!faculty) { showToast({ type: 'error', message: 'Please enter faculty.' }); return; }
    
    if (!paperForm.unit_code) { showToast({ type: 'error', message: 'Please enter unit code.' }); return; }
    
    // Validate unit name - either from dropdown or custom input
    const unitName = useCustomUnitName ? customUnitName : paperForm.unit_name;
    if (!unitName) { showToast({ type: 'error', message: 'Please enter unit name.' }); return; }
    
    // Validate year - either from dropdown or custom input
    const year = useCustomYear ? customYear : paperForm.year;
    if (!year) { showToast({ type: 'error', message: 'Please enter year.' }); return; }
    
    setBusy(true);
    try {
      // Check for duplicate paper before uploading
      const duplicateCheck = await checkDuplicatePastPaper({
        universityId: paperForm.university_id,
        faculty: faculty,
        unitCode: paperForm.unit_code,
        unitName: unitName,
        year: year
      });

      if (duplicateCheck.exists) {
        showToast({ 
          type: 'warning', 
          message: `This past paper (${paperForm.unit_code} - ${unitName} for ${year}) already exists in the system.` 
        });
        setBusy(false);
        return;
      }

      // Show instant success feedback
      showToast({ type: 'success', message: 'Past paper submitted! Processing...' });
      
      const metadata = {
        title: `${paperForm.unit_code} - ${unitName}`,
        university_id: paperForm.university_id || null,
        faculty: faculty,
        unit_code: paperForm.unit_code,
        unit_name: unitName,
        year: year ? Number(year) : null,
        semester: paperForm.semester || '',
        exam_type: paperForm.exam_type || 'Main',
        uploaded_by: userProfile?.id || null
      };
      
      console.log('📤 Submitting past paper with metadata:', JSON.stringify(metadata, null, 2));
      console.log('📤 Current form state:', JSON.stringify(paperForm, null, 2));
      
      // Reset form for next upload
      setPaperForm({ university_id: '', faculty: '', unit_code: '', unit_name: '', year: '', semester: '', exam_type: '' });
      setCustomFaculty('');
      setCustomUnitName('');
      setCustomYear('');
      setUseCustomFaculty(false);
      setUseCustomUnitName(false);
      setUseCustomYear(false);
      setPaperPdf(null);
      setFaculties([]);
      setUnitNames([]);
      setYears([]);
      
      // Determine if admin or user - admins get instant display, users get approval workflow
      const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'editor';
      const uploadFunction = isAdmin ? createPastPaper : createPastPaperSubmission;
      
      // Fire upload in background without waiting
      uploadFunction({ metadata, pdfFile: paperPdf }).catch((e) => {
        console.error('Past paper upload failed:', e);
        showToast({ type: 'error', message: e?.message || 'Upload failed.' });
      });
    } catch (e) {
      console.error('Upload validation failed:', e);
      showToast({ type: 'error', message: e?.message || 'Upload validation failed.' });
    } finally { setBusy(false); }
  };

  // Render dropzone component
  const renderDropzone = (file, setFile, accept, fileType, icon) => (
    <div
      className="dropzone"
      onDragOver={(e) => {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type.match(accept)) {
          setFile(droppedFile);
        }
      }}
      onClick={() => document.getElementById(`${fileType}-input`).click()}
      style={{
        border: '2px dashed #374151',
        borderRadius: '8px',
        padding: '20px',
        textAlign: 'center',
        cursor: 'pointer',
        background: file ? 'rgba(0, 168, 132, 0.1)' : 'transparent',
        transition: 'all 0.3s ease'
      }}
    >
      <input
        id={`${fileType}-input`}
        type="file"
        accept={accept}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        style={{ display: 'none' }}
      />
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#00a884' }}>
          {icon}
          <span>{file.name}</span>
        </div>
      ) : (
        <div>
          <FiUpload size={20} style={{ marginBottom: '4px', color: '#8696a0' }} />
          <div style={{ color: '#e9edef' }}>Drag and drop or click to browse</div>
          <div style={{ color: '#8696a0', fontSize: '0.85em', marginTop: '2px' }}>
            {accept === 'application/pdf' ? 'PDF files only' : 'Image files (JPG, PNG, GIF)'}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="panel">
      <div className="panel-title">Upload Content</div>
      
      {/* Tabs */}
      <div className="upload-tabs">
        <button 
          className={`upload-tab ${activeTab === 'books' ? 'active' : ''}`}
          onClick={() => setActiveTab('books')}
        >
          <FiBook size={20} />
          Books
        </button>
        <button 
          className={`upload-tab ${activeTab === 'pastpapers' ? 'active' : ''}`}
          onClick={() => setActiveTab('pastpapers')}
        >
          <FiFileText size={20} />
          Past Papers
        </button>
      </div>

      {/* Books Tab */}
      {activeTab === 'books' && (
        <div className="grid-2">
          <div className="panel">
            <label className="label">PDF File</label>
            {renderDropzone(pdf, setPdf, 'application/pdf', 'pdf', <FiFile size={24} />)}
            
            <label className="label" style={{ marginTop: 20 }}>
              Cover Image (optional)
              {extractingCover && <span style={{ marginLeft: '8px', color: '#00a884', fontSize: '0.9em' }}>(Extracting...)</span>}
            </label>
            {renderDropzone(cover, setCover, 'image/*', 'cover', <FiImage size={24} />)}
          </div>
          <div className="panel">
            <label className="label">Title</label>
            <input className="input" placeholder="Book title" value={bookForm.title} onChange={onBookChange('title')} />
            <label className="label" style={{ marginTop: 10 }}>Author</label>
            <input className="input" placeholder="Author" value={bookForm.author} onChange={onBookChange('author')} />
            <label className="label" style={{ marginTop: 10 }}>Description</label>
            <textarea className="input" rows={5} placeholder="Short description" value={bookForm.description} onChange={onBookChange('description')} />

            <div style={{ marginTop: 10 }}>
              <div>
                <label className="label">Year</label>
                <input className="input" placeholder="Year" value={bookForm.year} onChange={onBookChange('year')} />
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 10 }}>
              <div>
                <label className="label">Language</label>
                <input className="input" placeholder="English" value={bookForm.language} onChange={onBookChange('language')} />
              </div>
              <div>
                <label className="label">ISBN</label>
                <input className="input" placeholder="978-0-123456-78-9" value={bookForm.isbn} onChange={onBookChange('isbn')} />
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 10 }}>
              <div>
                <label className="label">Pages</label>
                <input className="input" type="number" placeholder="Number of pages" value={bookForm.pages} onChange={onBookChange('pages')} />
              </div>
              <div>
                <label className="label">Publisher</label>
                <input className="input" placeholder="Publisher name" value={bookForm.publisher} onChange={onBookChange('publisher')} />
              </div>
            </div>

            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn primary" disabled={busy} onClick={submitBook}>{busy ? 'Uploading...' : 'Upload Book'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Past Papers Tab */}
      {activeTab === 'pastpapers' && (
        <div className="grid-2">
          <div className="panel">
            <label className="label">Past Paper PDF *</label>
            {renderDropzone(paperPdf, setPaperPdf, 'application/pdf', 'paper-pdf', <FiFile size={24} />)}
          </div>
          <div className="panel">
            <label className="label">University *</label>
            <select className="select" value={paperForm.university_id} onChange={onPaperChange('university_id')}>
              <option value="">Select University</option>
              {universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>

            <label className="label" style={{ marginTop: 10 }}>Faculty *</label>
            {!useCustomFaculty ? (
              <select className="select" value={paperForm.faculty} onChange={onPaperChange('faculty')} disabled={!paperForm.university_id || faculties.length === 0}>
                <option value="">
                  {!paperForm.university_id ? 'Select a university first' : faculties.length === 0 ? 'No faculties available' : 'Select Faculty'}
                </option>
                {faculties.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            ) : (
              <input 
                className="input" 
                placeholder="e.g., Engineering, Business, Arts" 
                value={customFaculty} 
                onChange={(e) => setCustomFaculty(e.target.value)}
                style={{
                  backgroundColor: '#1f2c33',
                  color: '#ffffff',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  width: '100%',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#00a884'}
                onBlur={(e) => e.target.style.borderColor = '#333'}
              />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              <input 
                type="checkbox" 
                id="custom-faculty-toggle"
                checked={useCustomFaculty}
                onChange={(e) => setUseCustomFaculty(e.target.checked)}
                style={{ 
                  cursor: 'pointer',
                  width: '16px',
                  height: '16px',
                  accentColor: '#00a884'
                }}
              />
              <label htmlFor="custom-faculty-toggle" style={{ color: '#8696a0', fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}>
                Add
              </label>
            </div>

            <div className="grid-2" style={{ marginTop: 10 }}>
              <div>
                <label className="label">Unit Name *</label>
                {!useCustomUnitName ? (
                  <select className="select" value={paperForm.unit_name} onChange={onPaperChange('unit_name')} disabled={!paperForm.faculty && !useCustomFaculty || unitNames.length === 0}>
                    <option value="">
                      {(!paperForm.faculty && !useCustomFaculty) ? 'Select a faculty first' : unitNames.length === 0 ? 'No units available' : 'Select Unit Name'}
                    </option>
                    {unitNames.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                ) : (
                  <input 
                    className="input" 
                    placeholder="e.g., Introduction to Programming" 
                    value={customUnitName} 
                    onChange={(e) => setCustomUnitName(e.target.value)}
                    style={{
                      backgroundColor: '#1f2c33',
                      color: '#ffffff',
                      border: '1px solid #333',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      width: '100%',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#00a884'}
                    onBlur={(e) => e.target.style.borderColor = '#333'}
                  />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                  <input 
                    type="checkbox" 
                    id="custom-unit-toggle"
                    checked={useCustomUnitName}
                    onChange={(e) => setUseCustomUnitName(e.target.checked)}
                    style={{ 
                      cursor: 'pointer',
                      width: '16px',
                      height: '16px',
                      accentColor: '#00a884'
                    }}
                  />
                  <label htmlFor="custom-unit-toggle" style={{ color: '#8696a0', fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}>
                    Add
                  </label>
                </div>
              </div>
              <div>
                <label className="label">Unit Code *</label>
                <input 
                  className="input" 
                  placeholder="e.g., CS101" 
                  value={paperForm.unit_code} 
                  onChange={onPaperChange('unit_code')}
                  style={{
                    backgroundColor: '#1f2c33',
                    color: '#ffffff',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    width: '100%',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#00a884'}
                  onBlur={(e) => e.target.style.borderColor = '#333'}
                />
              </div>
            </div>

            <div className="grid-2" style={{ marginTop: 10 }}>
              <div>
                <label className="label">Year *</label>
                {!useCustomYear ? (
                  <select className="select" value={paperForm.year} onChange={onPaperChange('year')} disabled={!paperForm.unit_name && !useCustomUnitName || years.length === 0}>
                    <option value="">
                      {(!paperForm.unit_name && !useCustomUnitName) ? 'Select a unit first' : years.length === 0 ? 'No years available' : 'Select Year'}
                    </option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                ) : (
                  <input 
                    className="input" 
                    type="number" 
                    placeholder="e.g., 2023" 
                    value={customYear} 
                    onChange={(e) => setCustomYear(e.target.value)}
                    style={{
                      backgroundColor: '#1f2c33',
                      color: '#ffffff',
                      border: '1px solid #333',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      width: '100%',
                      outline: 'none',
                      transition: 'border-color 0.2s ease'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#00a884'}
                    onBlur={(e) => e.target.style.borderColor = '#333'}
                  />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                  <input 
                    type="checkbox" 
                    id="custom-year-toggle"
                    checked={useCustomYear}
                    onChange={(e) => setUseCustomYear(e.target.checked)}
                    style={{ 
                      cursor: 'pointer',
                      width: '16px',
                      height: '16px',
                      accentColor: '#00a884'
                    }}
                  />
                  <label htmlFor="custom-year-toggle" style={{ color: '#8696a0', fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}>
                    Add
                  </label>
                </div>
              </div>
              <div>
                <label className="label">Semester</label>
                <select className="select" value={paperForm.semester} onChange={onPaperChange('semester')}>
                  <option value="">Select Semester</option>
                  <option value="1">Semester 1</option>
                  <option value="2">Semester 2</option>
                  <option value="3">Semester 3</option>
                </select>
              </div>
            </div>

            <label className="label" style={{ marginTop: 10 }}>Exam Type</label>
            <select className="select" value={paperForm.exam_type} onChange={onPaperChange('exam_type')}>
              <option value="Main">Main Exam</option>
              <option value="Supplementary">Supplementary</option>
              <option value="CAT">CAT</option>
              <option value="Mock">Mock Exam</option>
            </select>

            <div className="actions" style={{ marginTop: 12 }}>
              <button className="btn primary" disabled={busy} onClick={submitPastPaper}>{busy ? 'Uploading...' : 'Upload Past Paper'}</button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default Upload;