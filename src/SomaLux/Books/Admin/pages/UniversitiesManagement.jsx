import React, { useEffect, useMemo, useState } from 'react';
import { FiSearch } from 'react-icons/fi';
import { fetchUniversities, createUniversitySubmission, deleteUniversity, updateUniversity } from '../campusApi';
import { autoFillUniversityData, getUniversityImages, deleteUniversityImage, searchUniversityNames } from '../universityPrefillApi';
import { getPastPaperCountByUniversity } from '../pastPapersApi';
import { useAdminUI } from '../AdminUIContext';
import { formatNumber } from '../../../PastPapers/formatNumber';

const highlightSearchText = (text, searchText) => {
  const value = String(text || '');
  const query = String(searchText || '').trim();
  if (!query) return value;

  const lowerValue = value.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts = [];
  let start = 0;
  let matchIndex = lowerValue.indexOf(lowerQuery, start);

  while (matchIndex !== -1) {
    if (matchIndex > start) parts.push(value.slice(start, matchIndex));
    parts.push(
      <span className="admin-search-match" key={`${matchIndex}-${query}`}>
        {value.slice(matchIndex, matchIndex + query.length)}
      </span>
    );
    start = matchIndex + query.length;
    matchIndex = lowerValue.indexOf(lowerQuery, start);
  }

  if (start === 0) return value;
  if (start < value.length) parts.push(value.slice(start));
  return parts;
};

const normalizeUniversityName = (name) => {
  const trimmedName = String(name || '').trim();
  if (!trimmedName || /\buniversity\b/i.test(trimmedName)) return trimmedName;
  return `${trimmedName} University`;
};

const UniversitiesManagement = ({ userProfile }) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ col: 'created_at', dir: 'desc' });
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [newCoverFiles, setNewCoverFiles] = useState([]);
  const [paperCounts, setPaperCounts] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUniversity, setNewUniversity] = useState({ name: '', description: '', website_url: '', location: '', established: '', student_count: '' });
  const [newUniversityCovers, setNewUniversityCovers] = useState([]);
  const [newUniversityCoverPreviews, setNewUniversityCoverPreviews] = useState([]);
  const [publicCoverImage, setPublicCoverImage] = useState('');
  const [publicCoverImages, setPublicCoverImages] = useState([]);
  const [failedPreviewImages, setFailedPreviewImages] = useState(() => new Set());
  const [previewImage, setPreviewImage] = useState(null);
  const [savingNewUniversity, setSavingNewUniversity] = useState(false);
  const [autoFillingUniversity, setAutoFillingUniversity] = useState(false);
  const [universitySuggestions, setUniversitySuggestions] = useState([]);
  const [loadingUniversitySuggestions, setLoadingUniversitySuggestions] = useState(false);

  useEffect(() => {
    const previews = newUniversityCovers.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setNewUniversityCoverPreviews(previews);

    return () => previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [newUniversityCovers]);

  const { confirm, showToast } = useAdminUI();

  const ADMIN_EMAILS = ['campuslives254@gmail.com', 'paltechsomalux@gmail.com', 'eliblearning@gmail.com'];
  const isAdmin = userProfile?.role === 'admin' || ADMIN_EMAILS.includes(userProfile?.email);
  const isEditor = userProfile?.role === 'editor' || ADMIN_EMAILS.includes(userProfile?.email);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count, pageSize]);

  const handlePreviewImageError = (imageUrl) => {
    setFailedPreviewImages((current) => new Set([...current, imageUrl]));
    setPublicCoverImages((current) => current.filter((candidate) => candidate !== imageUrl));
    if (previewImage === imageUrl) setPreviewImage(null);
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data, count: total } = await fetchUniversities({ page, pageSize, search, sort });
      setRows(data);
      setCount(total);
      
      // Fetch paper counts for each university in batches (non-blocking)
      const counts = {};
      const BATCH_SIZE = 3;
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        const countPromises = batch.map(uni =>
          getPastPaperCountByUniversity(uni.id)
            .then(count => ({ id: uni.id, count }))
            .catch(() => ({ id: uni.id, count: 0 }))
        );
        const results = await Promise.all(countPromises);
        results.forEach(({ id, count }) => {
          counts[id] = count;
        });
        // Update counts progressively
        setPaperCounts(prevCounts => ({ ...prevCounts, ...counts }));
      }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (userProfile) load();
  }, [page, search, sort.col, sort.dir, userProfile]);

  useEffect(() => {
    const query = newUniversity.name.trim();
    if (!showAddForm || query.length < 2) {
      setUniversitySuggestions([]);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingUniversitySuggestions(true);
      try {
        const suggestions = await searchUniversityNames(query, 6);
        if (!cancelled) setUniversitySuggestions(suggestions || []);
      } catch (error) {
        if (!cancelled) setUniversitySuggestions([]);
        console.warn('University autocomplete failed:', error?.message || error);
      } finally {
        if (!cancelled) setLoadingUniversitySuggestions(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [newUniversity.name, showAddForm]);

  const canEdit = (row) => {
    if (isAdmin) return true;
    if (isEditor) return true;
    return false;
  };

  const handleAutoFillUniversity = async () => {
    const universityName = newUniversity.name.trim();
    if (!universityName) {
      showToast({ type: 'error', message: 'Enter a university name first.' });
      return;
    }

    setAutoFillingUniversity(true);
    try {
      const data = await autoFillUniversityData(universityName);
      const hasDetails = data && (
        data.description ||
        data.website_url ||
        data.location ||
        data.established ||
        data.student_count ||
        data.cover_images?.length
      );

      if (!hasDetails) {
        showToast({ type: 'info', message: 'No additional public details were found.' });
        return;
      }

      setNewUniversity((current) => ({
        ...current,
        name: data.name || current.name,
        description: data.description || current.description,
        website_url: data.website_url || (current.website_url.includes('wikipedia.org') ? '' : current.website_url),
        location: data.location || current.location,
        established: data.established ?? current.established,
        student_count: data.student_count ?? current.student_count,
      }));
      setPublicCoverImages(data.cover_images || []);
      setFailedPreviewImages(new Set());
      setPublicCoverImage(data.cover_images?.[0] || '');
      showToast({ type: 'success', message: 'University details filled from public sources.' });
    } catch (error) {
      showToast({ type: 'error', message: error?.message || 'Could not fetch university details.' });
    } finally {
      setAutoFillingUniversity(false);
    }
  };

  const selectUniversitySuggestion = (suggestion) => {
    setNewUniversity((current) => ({
      ...current,
      name: suggestion.name || current.name,
      description: suggestion.description || current.description,
      website_url: suggestion.website_url && !suggestion.website_url.includes('wikipedia.org')
        ? suggestion.website_url
        : '',
    }));
    setUniversitySuggestions([]);
  };

  const startEdit = (row) => {
    if (!canEdit(row)) {
      showToast({ type: 'error', message: 'You do not have permission to edit this university.' });
      return;
    }
    setEditingId(row.id);
    setEditDraft({
      name: row.name || '',
      description: row.description || '',
      website_url: row.website_url || '',
      location: row.location || '',
      established: row.established || '',
      student_count: row.student_count || ''
    });
    setNewCoverFiles([]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
    setNewCoverFiles([]);
  };

  const saveEdit = async (row) => {
    if (!canEdit(row)) {
      showToast({ type: 'error', message: 'You do not have permission to edit this university.' });
      return;
    }
    const updates = { ...editDraft };

    // Normalize numeric fields so we don't send "" to integer columns
    if (updates.established === '' || updates.established === undefined) {
      updates.established = null;
    } else {
      updates.established = Number(updates.established);
    }

    if (updates.student_count === '' || updates.student_count === undefined) {
      updates.student_count = 0;
    } else {
      updates.student_count = Number(updates.student_count);
    }

    try {
      await updateUniversity(row.id, { updates, newCoverFiles });
      cancelEdit();
      await load();
      showToast({ type: 'success', message: 'University updated successfully.' });
    } catch (e) {
      console.error('Failed to update university:', e);
      showToast({ type: 'error', message: e?.message || 'Failed to update university.' });
    }
  };

  const handleDelete = async (row) => {
    if (!canEdit(row)) {
      showToast({ type: 'error', message: 'You can only delete universities you uploaded.' });
      return;
    }

    const ok = await confirm({
      title: 'Delete university?',
      message: `Delete "${row.name}" and its related data? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await deleteUniversity({ id: row.id, cover_image_url: row.cover_image_url });
      await load();
      showToast({ type: 'success', message: 'University deleted.' });
    } catch (err) {
      console.error('Failed to delete university:', err);
      showToast({ type: 'error', message: err?.message || 'Failed to delete university.' });
    }
  };

  const toggleSort = (col) => {
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }));
  };

  const handleCreate = async () => {
    const universityName = normalizeUniversityName(newUniversity.name);
    if (!universityName) {
      showToast({ type: 'error', message: 'University name is required.' });
      return;
    }

    setSavingNewUniversity(true);
    try {
      await createUniversitySubmission({
        metadata: {
          ...newUniversity,
          name: universityName,
          established: newUniversity.established ? Number(newUniversity.established) : null,
          student_count: newUniversity.student_count ? Number(newUniversity.student_count) : 0
        },
        coverFiles: newUniversityCovers,
        coverImageUrl: publicCoverImage
      });
      setNewUniversity({ name: '', description: '', website_url: '', location: '', established: '', student_count: '' });
      setNewUniversityCovers([]);
      setPublicCoverImage('');
      setPublicCoverImages([]);
      setShowAddForm(false);
      await load();
      showToast({ type: 'success', message: 'University added successfully.' });
    } catch (error) {
      showToast({ type: 'error', message: error?.message || 'Failed to add university.' });
    } finally {
      setSavingNewUniversity(false);
    }
  };

  return (
    <div>
      <div className="panel">
        <div className="users-controls books-search-controls">
          <div className="books-search-field">
            <FiSearch style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#8696a0', fontSize: '14px' }} />
            <input
              type="search"
              enterKeyHint="search"
              placeholder="Search by name or location..."
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              className="input books-search-input"
            />
          </div>
        </div>

        <div className="actions university-form-toggle-actions" style={{ marginBottom: 6, marginLeft: '20px' }}>
          <button className="btn primary" onClick={() => setShowAddForm(value => !value)}>{showAddForm ? 'Cancel' : 'Add University'}</button>
        </div>

        {showAddForm && (
          <div className="panel university-add-panel" style={{ marginBottom: 8 }}>
            <div className="grid-2 university-add-form-grid">
              <div>
                <label className="label">Name</label>
                <div className="university-name-input-row">
                  <input className="input" value={newUniversity.name} onChange={(e) => setNewUniversity({ ...newUniversity, name: e.target.value })} onBlur={() => setNewUniversity((current) => ({ ...current, name: normalizeUniversityName(current.name) }))} placeholder="University name" />
                  {(universitySuggestions.length > 0 || loadingUniversitySuggestions) && (
                    <div className="university-suggestions" role="listbox">
                      {loadingUniversitySuggestions && <div className="university-suggestion-status">Searching...</div>}
                      {universitySuggestions.map((suggestion) => (
                        <button
                          type="button"
                          className="university-suggestion"
                          key={suggestion.name}
                          onClick={() => selectUniversitySuggestion(suggestion)}
                        >
                          <strong>{suggestion.name}</strong>
                          {suggestion.location && <span>{suggestion.location}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="label">Location</label>
                <input className="input" value={newUniversity.location} onChange={(e) => setNewUniversity({ ...newUniversity, location: e.target.value })} placeholder="City or country" />
              </div>
              <div>
                <label className="label">Website</label>
                <input className="input" value={newUniversity.website_url} onChange={(e) => setNewUniversity({ ...newUniversity, website_url: e.target.value })} placeholder="https://" />
              </div>
              <div>
                <label className="label">Established</label>
                <input className="input" type="number" value={newUniversity.established} onChange={(e) => setNewUniversity({ ...newUniversity, established: e.target.value })} placeholder="Year" />
              </div>
              <div>
                <label className="label">Cover Image</label>
                <input className="input" type="file" accept="image/*" multiple onChange={(e) => { setNewUniversityCovers(Array.from(e.target.files || [])); setPublicCoverImage(''); setPublicCoverImages([]); }} />
                {newUniversityCoverPreviews.length > 0 && (
                  <div className="university-image-preview-grid">
                    {newUniversityCoverPreviews.map((preview, index) => (
                      <div className="university-image-preview" key={`${preview.name}-${index}`} role="button" tabIndex={0} onClick={() => setPreviewImage(preview.url)} onKeyDown={(event) => event.key === 'Enter' && setPreviewImage(preview.url)}>
                        <img src={preview.url} alt={preview.name} />
                        {index === 0 && <span>Primary</span>}
                      </div>
                    ))}
                  </div>
                )}
                {publicCoverImages.filter((imageUrl) => !failedPreviewImages.has(imageUrl)).length > 0 && newUniversityCovers.length === 0 && (
                  <div className="university-image-preview-grid">
                    {publicCoverImages.filter((imageUrl) => !failedPreviewImages.has(imageUrl)).map((imageUrl, index) => (
                      <div className="university-image-preview" key={`${imageUrl}-${index}`} role="button" tabIndex={0} onClick={() => setPreviewImage(imageUrl)} onKeyDown={(event) => event.key === 'Enter' && setPreviewImage(imageUrl)}>
                        <img src={imageUrl} alt={`Official university image ${index + 1}`} onError={() => handlePreviewImageError(imageUrl)} />
                        {index === 0 && <span>Primary</span>}
                      </div>
                    ))}
                    <button type="button" className="btn university-clear-images" onClick={() => { setPublicCoverImage(''); setPublicCoverImages([]); }}>Clear fetched images</button>
                  </div>
                )}
              </div>
            </div>
            <label className="label" style={{ marginTop: 8 }}>Description</label>
            <textarea className="input" rows={3} value={newUniversity.description} onChange={(e) => setNewUniversity({ ...newUniversity, description: e.target.value })} placeholder="Short description" />
            <div className="actions university-form-actions" style={{ marginTop: 8 }}>
              <button type="button" className="btn university-autofill-button" onClick={handleAutoFillUniversity} disabled={autoFillingUniversity}>
                {autoFillingUniversity ? 'Filling...' : 'Auto-fill'}
              </button>
              <button className="btn primary" onClick={handleCreate} disabled={savingNewUniversity}>{savingNewUniversity ? 'Saving...' : 'Save University'}</button>
            </div>
          </div>
        )}

        {!showAddForm && <>
        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table universities-management-table" style={{ minWidth: '1200px' }}>
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Cover</th>
                <th style={{ width: '250px', cursor: 'pointer' }} onClick={() => toggleSort('name')}>Name {sort.col === 'name' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ width: '300px' }}>Description</th>
                <th style={{ width: '150px' }}>Location</th>
                <th style={{ width: '100px', cursor: 'pointer' }} onClick={() => toggleSort('established')}>Est. {sort.col === 'established' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ width: '100px' }}>Students</th>
                <th style={{ width: '80px' }}>Papers</th>
                <th className="universities-actions-header" style={{ width: '180px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#8696a0' }}>Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#8696a0' }}>No data</td></tr>
              ) : rows.map(row => (
                <tr key={row.id}>
                  <td>
                    {row.cover_image_url ? <img src={row.cover_image_url} alt="cover" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }} /> : <span className="badge">No cover</span>}
                    {editingId === row.id && (
                      <div className="university-edit-cover-picker">
                        <input
                          id={`university-cover-input-${row.id}`}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => setNewCoverFiles(Array.from(e.target.files || []))}
                        />
                        <label className="btn" htmlFor={`university-cover-input-${row.id}`}>
                          {newCoverFiles.length ? `${newCoverFiles.length} image${newCoverFiles.length === 1 ? '' : 's'} selected` : 'Choose Images'}
                        </label>
                      </div>
                    )}
                  </td>
                  <td className="universities-actions-cell">
                    {editingId === row.id ? (
                      <input className="input" value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
                    ) : highlightSearchText(row.name, search)}
                  </td>
                  <td>
                    {editingId === row.id ? (
                      <textarea className="input" rows={2} value={editDraft.description} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} />
                    ) : (row.description?.slice(0, 100) || '—')}
                  </td>
                  <td>
                    {editingId === row.id ? (
                      <input className="input" value={editDraft.location} onChange={(e) => setEditDraft({ ...editDraft, location: e.target.value })} />
                    ) : highlightSearchText(row.location || '—', search)}
                  </td>
                  <td>
                    {editingId === row.id ? (
                      <input className="input" type="number" value={editDraft.established} onChange={(e) => setEditDraft({ ...editDraft, established: e.target.value })} />
                    ) : (row.established || '—')}
                  </td>
                  <td>{row.student_count?.toLocaleString() || '—'}</td>
                  <td>{formatNumber(paperCounts[row.id] || 0)}</td>
                  <td>
                    {editingId === row.id ? (
                      <div className="universities-edit-actions">
                        <button className="btn primary" onClick={() => saveEdit(row)}>Save</button>
                        <button className="btn" onClick={cancelEdit}>Cancel</button>
                      </div>
                    ) : (
                      <div className="actions">
                        <button className="btn" onClick={() => startEdit(row)} disabled={!canEdit(row)}>Edit</button>
                        <button className="btn" onClick={() => handleDelete(row)} disabled={!canEdit(row)}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="actions" style={{ marginTop: 6 }}>
          <button className="btn" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
          <span style={{ color: '#cfd8dc' }}>Page {page} of {totalPages}</span>
          <button className="btn" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
        </div>
        </>}

        {previewImage && (
          <div className="university-image-lightbox" role="dialog" aria-modal="true" aria-label="University image preview" onClick={() => setPreviewImage(null)}>
            <button type="button" className="university-image-lightbox-close" onClick={() => setPreviewImage(null)} aria-label="Close image preview">×</button>
            <img src={previewImage} alt="Full university image preview" onError={() => setPreviewImage(null)} onClick={(event) => event.stopPropagation()} />
          </div>
        )}
      </div>
    </div>
  );
};

export default UniversitiesManagement;
