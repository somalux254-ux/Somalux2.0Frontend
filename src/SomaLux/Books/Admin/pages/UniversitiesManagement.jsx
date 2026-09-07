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
  const [newCover, setNewCover] = useState(null);
  const [paperCounts, setPaperCounts] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUniversity, setNewUniversity] = useState({ name: '', description: '', website_url: '', location: '', established: '', student_count: '' });
  const [newUniversityCover, setNewUniversityCover] = useState(null);
  const [publicCoverImage, setPublicCoverImage] = useState('');
  const [savingNewUniversity, setSavingNewUniversity] = useState(false);
  const [autoFillingUniversity, setAutoFillingUniversity] = useState(false);
  const [universitySuggestions, setUniversitySuggestions] = useState([]);
  const [loadingUniversitySuggestions, setLoadingUniversitySuggestions] = useState(false);

  const { confirm, showToast } = useAdminUI();

  const ADMIN_EMAILS = ['campuslives254@gmail.com', 'paltechsomalux@gmail.com', 'eliblearning@gmail.com'];
  const isAdmin = userProfile?.role === 'admin' || ADMIN_EMAILS.includes(userProfile?.email);
  const isEditor = userProfile?.role === 'editor' || ADMIN_EMAILS.includes(userProfile?.email);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count, pageSize]);

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
      const hasDetails = data && (data.description || data.website_url || data.location || data.established || data.student_count);

      if (!hasDetails) {
        showToast({ type: 'info', message: 'No additional public details were found.' });
        return;
      }

      setNewUniversity((current) => ({
        ...current,
        name: data.name || current.name,
        description: data.description || current.description,
        website_url: data.website_url || current.website_url,
        location: data.location || current.location,
        established: data.established ?? current.established,
        student_count: data.student_count ?? current.student_count,
      }));
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
      website_url: suggestion.website_url || current.website_url,
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
    setNewCover(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
    setNewCover(null);
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
      updates.student_count = null;
    } else {
      updates.student_count = Number(updates.student_count);
    }

    try {
      await updateUniversity(row.id, { updates, newCoverFile: newCover });
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
    if (!newUniversity.name.trim()) {
      showToast({ type: 'error', message: 'University name is required.' });
      return;
    }

    setSavingNewUniversity(true);
    try {
      await createUniversitySubmission({
        metadata: {
          ...newUniversity,
          established: newUniversity.established ? Number(newUniversity.established) : null,
          student_count: newUniversity.student_count ? Number(newUniversity.student_count) : 0
        },
        coverFile: newUniversityCover,
        coverImageUrl: publicCoverImage
      });
      setNewUniversity({ name: '', description: '', website_url: '', location: '', established: '', student_count: '' });
      setNewUniversityCover(null);
      setPublicCoverImage('');
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
          <button className="btn primary" onClick={() => setShowAddForm(value => !value)}>{showAddForm ? 'Cancel' : 'Add New University'}</button>
        </div>

        {showAddForm && (
          <div className="panel university-add-panel" style={{ marginBottom: 8 }}>
            <div className="grid-2 university-add-form-grid">
              <div>
                <label className="label">Name</label>
                <div className="university-name-input-row">
                  <input className="input" value={newUniversity.name} onChange={(e) => setNewUniversity({ ...newUniversity, name: e.target.value })} placeholder="University name" />
                  <button type="button" className="btn university-autofill-button" onClick={handleAutoFillUniversity} disabled={autoFillingUniversity}>
                    {autoFillingUniversity ? 'Filling...' : 'Auto-fill'}
                  </button>
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
                <label className="label">Student Count</label>
                <input className="input" type="number" value={newUniversity.student_count} onChange={(e) => setNewUniversity({ ...newUniversity, student_count: e.target.value })} placeholder="0" />
              </div>
              <div>
                <label className="label">Cover Image</label>
                <input className="input" type="file" accept="image/*" onChange={(e) => { setNewUniversityCover(e.target.files?.[0] || null); setPublicCoverImage(''); }} />
                {publicCoverImage && (
                  <div className="university-public-image-option">
                    <img src={publicCoverImage} alt="Public university preview" />
                    <div>
                      <span>Public image selected</span>
                      <button type="button" className="btn" onClick={() => setPublicCoverImage('')}>Clear</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <label className="label" style={{ marginTop: 8 }}>Description</label>
            <textarea className="input" rows={3} value={newUniversity.description} onChange={(e) => setNewUniversity({ ...newUniversity, description: e.target.value })} placeholder="Short description" />
            <div className="actions" style={{ marginTop: 8 }}>
              <button className="btn primary" onClick={handleCreate} disabled={savingNewUniversity}>{savingNewUniversity ? 'Saving...' : 'Save University'}</button>
            </div>
          </div>
        )}

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
                  <td>{row.cover_image_url ? <img src={row.cover_image_url} alt="cover" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }} /> : <span className="badge">No cover</span>}</td>
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
      </div>
    </div>
  );
};

export default UniversitiesManagement;
