import React, { useEffect, useMemo, useState } from 'react';
import { fetchUniversities, createUniversitySubmission, deleteUniversity, updateUniversity } from '../campusApi';
import { getUniversityImages, deleteUniversityImage } from '../universityPrefillApi';
import { getPastPaperCountByUniversity } from '../pastPapersApi';
import { useAdminUI } from '../AdminUIContext';
import { formatNumber } from '../../../PastPapers/formatNumber';

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
  const [savingNewUniversity, setSavingNewUniversity] = useState(false);

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

  const canEdit = (row) => {
    if (isAdmin) return true;
    if (isEditor) return true;
    return false;
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
        coverFile: newUniversityCover
      });
      setNewUniversity({ name: '', description: '', website_url: '', location: '', established: '', student_count: '' });
      setNewUniversityCover(null);
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
        <div className="panel-title">Universities Management</div>

        {/* Stats Summary */}
        {!loading && rows.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '12px' }}>
            <div style={{ background: '#1a2332', border: '1px solid #2a3f56', borderRadius: '6px', padding: '8px 12px', color: '#8696a0', fontSize: '0.85rem' }}>
              <div style={{ color: '#34B7F1', fontSize: '1.2rem', fontWeight: '600' }}>{formatNumber(rows.reduce((sum, r) => sum + (r.views || 0), 0))}</div>
              <div>Total Views</div>
            </div>
            <div style={{ background: '#1a2332', border: '1px solid #2a3f56', borderRadius: '6px', padding: '8px 12px', color: '#8696a0', fontSize: '0.85rem' }}>
              <div style={{ color: '#FFCC00', fontSize: '1.2rem', fontWeight: '600' }}>{rows.length}/{count}</div>
              <div>Page Universities</div>
            </div>
          </div>
        )}

        <div className="panel" style={{ marginBottom: 6 }}>
          <label className="label">Search</label>
          <input className="input" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Search by name or location..." />
        </div>

        <div className="actions" style={{ marginBottom: 6, marginLeft: '20px' }}>
          <button className="btn primary" onClick={() => setShowAddForm(value => !value)}>{showAddForm ? 'Cancel' : 'Add New University'}</button>
        </div>

        {showAddForm && (
          <div className="panel" style={{ marginBottom: 8 }}>
            <div className="panel-title">Add University</div>
            <div className="grid-2">
              <div>
                <label className="label">Name</label>
                <input className="input" value={newUniversity.name} onChange={(e) => setNewUniversity({ ...newUniversity, name: e.target.value })} placeholder="University name" />
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
                <input className="input" type="file" accept="image/*" onChange={(e) => setNewUniversityCover(e.target.files?.[0] || null)} />
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
          <table className="table" style={{ minWidth: '1200px' }}>
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Cover</th>
                <th style={{ width: '250px', cursor: 'pointer' }} onClick={() => toggleSort('name')}>Name {sort.col === 'name' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ width: '300px' }}>Description</th>
                <th style={{ width: '150px' }}>Location</th>
                <th style={{ width: '100px', cursor: 'pointer' }} onClick={() => toggleSort('established')}>Est. {sort.col === 'established' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ width: '100px' }}>Students</th>
                <th style={{ width: '80px', background: 'rgba(102, 187, 106, 0.1)', borderBottom: '2px solid #66BB6A' }}>Papers</th>
                <th style={{ width: '180px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: '#8696a0' }}>Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: '#8696a0' }}>No data</td></tr>
              ) : rows.map(row => (
                <tr key={row.id}>
                  <td>{row.cover_image_url ? <img src={row.cover_image_url} alt="cover" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }} /> : <span className="badge">No cover</span>}</td>
                  <td>
                    {editingId === row.id ? (
                      <input className="input" value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
                    ) : row.name}
                  </td>
                  <td>
                    {editingId === row.id ? (
                      <textarea className="input" rows={2} value={editDraft.description} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} />
                    ) : (row.description?.slice(0, 100) || '—')}
                  </td>
                  <td>
                    {editingId === row.id ? (
                      <input className="input" value={editDraft.location} onChange={(e) => setEditDraft({ ...editDraft, location: e.target.value })} />
                    ) : (row.location || '—')}
                  </td>
                  <td>
                    {editingId === row.id ? (
                      <input className="input" type="number" value={editDraft.established} onChange={(e) => setEditDraft({ ...editDraft, established: e.target.value })} />
                    ) : (row.established || '—')}
                  </td>
                  <td>{row.student_count?.toLocaleString() || '—'}</td>
                  <td style={{ fontWeight: '500', color: '#00a884' }}>{formatNumber(row.views || 0)}</td>
                  <td style={{ fontWeight: '500', color: '#66BB6A' }}>{formatNumber(paperCounts[row.id] || 0)}</td>
                  <td>
                    {editingId === row.id ? (
                      <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
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
