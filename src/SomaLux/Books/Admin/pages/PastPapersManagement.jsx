import React, { useEffect, useMemo, useState } from 'react';
import { fetchPastPapers, deletePastPaper, updatePastPaper, getFaculties } from '../pastPapersApi';
import { useAdminUI } from '../AdminUIContext';

// Format timestamp to local time with timezone handling
const formatTimestamp = (isoString) => {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });
  } catch (e) {
    return isoString;
  }
};

const PastPapersManagement = ({ userProfile }) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [faculties, setFaculties] = useState([]);
  const [facultyFilter, setFacultyFilter] = useState(null);
  const [sort, setSort] = useState({ col: 'created_at', dir: 'desc' });
  const [editingId, setEditingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [allPaperIds, setAllPaperIds] = useState(new Set()); // Track ALL papers across all pages
  const [editDraft, setEditDraft] = useState({});
  const [newPdf, setNewPdf] = useState(null);
  const [useCustomFaculty, setUseCustomFaculty] = useState(false);
  const [customFaculty, setCustomFaculty] = useState('');
  const [isMultiEditMode, setIsMultiEditMode] = useState(false);
  const [showCheckboxes, setShowCheckboxes] = useState(false);

  const { confirm, showToast } = useAdminUI();

  const isAdmin = userProfile?.role === 'admin';
  const isEditor = userProfile?.role === 'editor';
  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count, pageSize]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, count: total } = await fetchPastPapers({ page, pageSize, search, faculty: facultyFilter, sort });
      setRows(data);
      setCount(total);
    } finally { setLoading(false); }
  };

  // Fetch all paper IDs matching current filters (no pagination)
  const fetchAllMatchingIds = async () => {
    try {
      const { data } = await fetchPastPapers({ page: 1, pageSize: 10000, search, faculty: facultyFilter, sort });
      return new Set(data.map(item => item.id));
    } catch (error) {
      console.error('Failed to fetch all matching papers:', error);
      return new Set();
    }
  };

  useEffect(() => {
    (async () => { try { setFaculties(await getFaculties()); } catch {} })();
  }, []);

  useEffect(() => {
    if (userProfile) load();
  }, [page, search, facultyFilter, sort.col, sort.dir, userProfile]);

  const canEdit = (row) => {
    if (isAdmin) return true;
    if (isEditor) return true;
    return false;
  };

  const startEdit = (row) => {
    if (!canEdit(row)) {
      showToast({ type: 'error', message: 'You do not have permission to edit this past paper.' });
      return;
    }
    setEditingId(row.id);
    setEditDraft({
      faculty: row.faculty || '', unit_code: row.unit_code || '', unit_name: row.unit_name || '',
      year: row.year || '', semester: row.semester || '', exam_type: row.exam_type || ''
    });
    setNewPdf(null);
    setUseCustomFaculty(false);
    setCustomFaculty('');
  };

  const cancelEdit = () => { 
    setEditingId(null); 
    setEditDraft({}); 
    setNewPdf(null); 
    setUseCustomFaculty(false);
    setCustomFaculty('');
  };

  // Multi-select handlers
  const toggleSelectRow = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === count && count > 0) {
      // Unselect all
      setSelectedIds(new Set());
    } else {
      // Select all matching papers across all pages
      fetchAllMatchingIds().then(allIds => {
        setSelectedIds(allIds);
      });
    }
  };

  const startMultiEdit = () => {
    if (selectedIds.size === 0) {
      showToast({ type: 'error', message: 'Please select at least one past paper to edit.' });
      return;
    }
    
    // For permission check, only validate papers we can see on current page
    // Users can proceed with multi-edit if they have permission on at least the current visible selections
    // Full permission check will happen in saveMultiEdit
    const visibleSelectedIds = Array.from(selectedIds).filter(id => rows.some(r => r.id === id));
    if (visibleSelectedIds.length > 0) {
      const canEditVisible = visibleSelectedIds.every(id => {
        const row = rows.find(r => r.id === id);
        return canEdit(row);
      });

      if (!canEditVisible) {
        showToast({ type: 'error', message: 'You do not have permission to edit some of the selected past papers.' });
        return;
      }
    }

    setIsMultiEditMode(true);
    setEditDraft({
      faculty: '', unit_code: '', unit_name: '', year: '', semester: '', exam_type: ''
    });
    setUseCustomFaculty(false);
    setCustomFaculty('');
  };

  const cancelMultiEdit = () => {
    setIsMultiEditMode(false);
    setEditDraft({});
    setUseCustomFaculty(false);
    setCustomFaculty('');
    setSelectedIds(new Set());
    setShowCheckboxes(false);
  };

  const saveMultiEdit = async () => {
    if (selectedIds.size === 0) {
      showToast({ type: 'error', message: 'No past papers selected.' });
      return;
    }

    // Get the values that were actually changed
    const updates = {};
    if (editDraft.faculty) updates.faculty = editDraft.faculty || (useCustomFaculty ? customFaculty : editDraft.faculty);
    if (editDraft.unit_code) updates.unit_code = editDraft.unit_code;
    if (editDraft.unit_name) updates.unit_name = editDraft.unit_name;
    if (editDraft.year) updates.year = editDraft.year;
    if (editDraft.semester) updates.semester = editDraft.semester;
    if (editDraft.exam_type) updates.exam_type = editDraft.exam_type;

    if (Object.keys(updates).length === 0) {
      showToast({ type: 'error', message: 'Please enter at least one field to update.' });
      return;
    }

    try {
      const faculty = useCustomFaculty ? customFaculty : editDraft.faculty;
      if (updates.faculty && !faculty) {
        showToast({ type: 'error', message: 'Please select or enter a faculty.' });
        return;
      }

      // Fetch all selected papers in parallel with current page (use cached data from current page if available)
      const papersToUpdate = Array.from(selectedIds).map(id => {
        const cachedRow = rows.find(r => r.id === id);
        return { id, cached: cachedRow };
      });

      // Only fetch papers not in current view
      const missingIds = papersToUpdate.filter(p => !p.cached).map(p => p.id);
      let missingPapersMap = new Map();
      
      if (missingIds.length > 0) {
        const { data: allSelectedPapers } = await fetchPastPapers({ 
          page: 1, 
          pageSize: 10000, 
          search, 
          faculty: facultyFilter, 
          sort 
        });
        missingPapersMap = new Map(allSelectedPapers.map(p => [p.id, p]));
      }

      // Update all in parallel (up to 5 concurrent requests)
      const updatePromises = [];
      const batchSize = 5;
      
      for (const { id, cached } of papersToUpdate) {
        const row = cached || missingPapersMap.get(id);
        if (!row) {
          console.warn(`Paper with ID ${id} not found`);
          continue;
        }
        
        updatePromises.push(
          updatePastPaper(id, { 
            updates: { ...updates, faculty: updates.faculty || faculty }, 
            newPdfFile: null, 
            oldFilePath: row.file_path 
          })
        );

        // Batch requests to avoid overwhelming the server
        if (updatePromises.length >= batchSize) {
          await Promise.all(updatePromises);
          updatePromises.length = 0;
        }
      }

      // Complete remaining requests
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }

      cancelMultiEdit();
      // Reload only current page data instead of all
      setLoading(true);
      const { data, count: total } = await fetchPastPapers({ page, pageSize, search, faculty: facultyFilter, sort });
      setRows(data);
      setCount(total);
      setLoading(false);
      
      showToast({ type: 'success', message: `${selectedIds.size} past paper(s) updated successfully.` });
    } catch (e) {
      console.error('Failed to update past papers:', e?.message || e);
      showToast({ type: 'error', message: e?.message || 'Failed to update past papers.' });
    }
  };

  const saveEdit = async (row) => {
    if (!canEdit(row)) {
      showToast({ type: 'error', message: 'You do not have permission to edit this past paper.' });
      return;
    }
    
    // Use custom faculty if selected, otherwise use the one from edit draft
    const faculty = useCustomFaculty ? customFaculty : editDraft.faculty;
    if (!faculty) {
      showToast({ type: 'error', message: 'Please select or enter a faculty.' });
      return;
    }
    
    const updates = { ...editDraft, faculty };

    try {
      await updatePastPaper(row.id, { updates, newPdfFile: newPdf, oldFilePath: row.file_path });
      cancelEdit();
      await load();
      showToast({ type: 'success', message: 'Past paper updated.' });
    } catch (e) {
      console.error('Failed to update past paper:', e?.message || e);
      showToast({ type: 'error', message: e?.message || 'Failed to update past paper.' });
    }
  };

  const handleDelete = async (row) => {
    if (!canEdit(row)) {
      showToast({ type: 'error', message: 'You can only delete past papers you uploaded.' });
      return;
    }

    const ok = await confirm({
      title: 'Delete past paper?',
      message: `Delete "${row.unit_code} - ${row.unit_name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await deletePastPaper({ id: row.id, file_path: row.file_path });
      await load();
      showToast({ type: 'success', message: 'Past paper deleted.' });
    } catch (e) {
      console.error('Failed to delete past paper:', e);
      showToast({ type: 'error', message: e?.message || 'Failed to delete past paper.' });
    }
  };

  const handleMultiDelete = async () => {
    if (selectedIds.size === 0) {
      showToast({ type: 'error', message: 'Please select at least one past paper to delete.' });
      return;
    }

    const papersToDelete = Array.from(selectedIds);

    const ok = await confirm({
      title: `Delete ${selectedIds.size} past paper${selectedIds.size !== 1 ? 's' : ''}?`,
      message: `You are about to delete ${selectedIds.size} past paper${selectedIds.size !== 1 ? 's' : ''} and their files. This action cannot be undone.`,
      confirmLabel: 'Delete All',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      // Get all paper data (including file paths)
      const papersData = [];
      for (const id of papersToDelete) {
        const cachedRow = rows.find(r => r.id === id);
        if (cachedRow) {
          papersData.push(cachedRow);
        }
      }

      // If some papers are not in current page view, fetch them
      const foundIds = new Set(papersData.map(p => p.id));
      const missingIds = Array.from(papersToDelete).filter(id => !foundIds.has(id));
      
      if (missingIds.length > 0) {
        const { data: allPapers } = await fetchPastPapers({ 
          page: 1, 
          pageSize: 10000, 
          search, 
          faculty: facultyFilter, 
          sort 
        });
        
        missingIds.forEach(id => {
          const paper = allPapers.find(p => p.id === id);
          if (paper) papersData.push(paper);
        });
      }

      // Verify all papers can be deleted (after fetching all data)
      const canDeleteAll = papersData.every(paper => canEdit(paper));
      if (!canDeleteAll) {
        showToast({ type: 'error', message: 'You do not have permission to delete some of the selected past papers.' });
        return;
      }

      // Delete papers sequentially with batch processing
      const deletePromises = [];
      const batchSize = 5;
      
      for (const paper of papersData) {
        deletePromises.push(
          deletePastPaper({ id: paper.id, file_path: paper.file_path })
        );

        if (deletePromises.length >= batchSize) {
          await Promise.all(deletePromises);
          deletePromises.length = 0;
        }
      }

      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
      }

      // Reset selection and reload
      setSelectedIds(new Set());
      setShowCheckboxes(false);
      setLoading(true);
      const { data, count: total } = await fetchPastPapers({ page, pageSize, search, faculty: facultyFilter, sort });
      setRows(data);
      setCount(total);
      setLoading(false);
      
      showToast({ type: 'success', message: `${papersData.length} past paper(s) deleted successfully.` });
    } catch (e) {
      console.error('Failed to delete past papers:', e?.message || e);
      showToast({ type: 'error', message: e?.message || 'Failed to delete past papers.' });
    }
  };

  const toggleSort = (col) => setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }));

  return (
    <div>
      <div className="panel">
        <div className="panel-title">Past Papers Management</div>

        {/* Stats Summary */}
        {!loading && rows.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '12px' }}>
            <div style={{ background: '#0b1216', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)', borderRadius: '6px', padding: '8px 12px', color: '#8696a0', fontSize: '0.85rem' }}>
              <div style={{ color: '#00a884', fontSize: '1.2rem', fontWeight: '600' }}>{rows.reduce((sum, r) => sum + (r.downloads_count || 0), 0)}</div>
              <div>Total Downloads</div>
            </div>
            <div style={{ background: '#0b1216', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)', borderRadius: '6px', padding: '8px 12px', color: '#8696a0', fontSize: '0.85rem' }}>
            </div>
            <div style={{ background: '#0b1216', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)', borderRadius: '6px', padding: '8px 12px', color: '#8696a0', fontSize: '0.85rem' }}>
              <div style={{ color: '#FFCC00', fontSize: '1.2rem', fontWeight: '600' }}>{rows.length}/{count}</div>
              <div>Page Papers</div>
            </div>
          </div>
        )}

        <div className="grid-2" style={{ marginBottom: 6 }}>
          <div className="panel">
            <label className="label">Search</label>
            <input className="input" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value.trim()); }} placeholder="e.g., MENT 130 or Introduction to..." />
          </div>
          <div className="panel">
            <label className="label">Faculty</label>
            <select className="select" value={facultyFilter || ''} onChange={(e) => { setPage(1); setFacultyFilter(e.target.value || null); }}>
              <option value="">All Faculties</option>
              <option value="Unknown">Unknown</option>
              {faculties.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div className="actions" style={{ marginBottom: 6, marginLeft: '20px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn primary" onClick={() => (window.location.href = '/books/admin/upload')}>Add New Past Paper</button>
            {!showCheckboxes && (
              <button 
                className="btn" 
                onClick={() => setShowCheckboxes(true)}
                style={{ background: '#00a884', color: '#e9edef' }}
              >
                📋 Bulk Edit
              </button>
            )}
            {showCheckboxes && !isMultiEditMode && (
              <button 
                className="btn" 
                onClick={() => {
                  setShowCheckboxes(false);
                  setSelectedIds(new Set());
                }}
                style={{ background: '#2a3f56', color: '#e9edef' }}
              >
                ✕ Cancel Selection
              </button>
            )}
          </div>
        </div>

        {/* Multi-Edit Mode Toolbar */}
        {isMultiEditMode && (
          <div style={{ 
            background: '#0b1216', 
            borderRadius: '6px', 
            padding: '12px',
            marginBottom: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
          }}>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#00a884' }}>
                Edit {selectedIds.size} Past Paper{selectedIds.size !== 1 ? 's' : ''}
              </h3>
              <button 
                className="btn" 
                onClick={cancelMultiEdit}
                style={{ background: '#2a3f56', color: '#e9edef' }}
              >
                Cancel
              </button>
            </div>

            <div className="grid-2" style={{ gap: '12px', marginBottom: '12px' }}>
              <div>
                <label className="label" style={{ fontSize: '13px' }}>Unit Name</label>
                <input 
                  className="input" 
                  placeholder="Leave blank to skip" 
                  value={editDraft.unit_name || ''} 
                  onChange={(e) => setEditDraft({ ...editDraft, unit_name: e.target.value })} 
                />
              </div>
              <div>
                <label className="label" style={{ fontSize: '13px' }}>Unit Code</label>
                <input 
                  className="input" 
                  placeholder="Leave blank to skip" 
                  value={editDraft.unit_code || ''} 
                  onChange={(e) => setEditDraft({ ...editDraft, unit_code: e.target.value })} 
                />
              </div>
              <div>
                <label className="label" style={{ fontSize: '13px' }}>Faculty</label>
                {!useCustomFaculty ? (
                  <select 
                    className="select" 
                    value={editDraft.faculty || ''} 
                    onChange={(e) => setEditDraft({ ...editDraft, faculty: e.target.value })}
                  >
                    <option value="">Leave blank to skip</option>
                    {faculties && faculties.length > 0 ? faculties.map(f => <option key={f} value={f}>{f}</option>) : <option value="">No faculties available</option>}
                  </select>
                ) : (
                  <input 
                    className="input" 
                    placeholder="e.g., Engineering" 
                    value={customFaculty} 
                    onChange={(e) => setCustomFaculty(e.target.value)}
                  />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '12px' }}>
                  <input 
                    type="checkbox" 
                    id="custom-faculty-multi"
                    checked={useCustomFaculty}
                    onChange={(e) => {
                      setUseCustomFaculty(e.target.checked);
                      if (!e.target.checked) {
                        setCustomFaculty('');
                      }
                    }}
                    style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                  />
                  <label htmlFor="custom-faculty-multi" style={{ color: '#8696a0', cursor: 'pointer' }}>
                    Add custom faculty
                  </label>
                </div>
              </div>
              <div>
                <label className="label" style={{ fontSize: '13px' }}>Year</label>
                <input 
                  className="input" 
                  type="number" 
                  placeholder="Leave blank to skip" 
                  value={editDraft.year || ''} 
                  onChange={(e) => setEditDraft({ ...editDraft, year: e.target.value })} 
                />
              </div>
              <div>
                <label className="label" style={{ fontSize: '13px' }}>Semester</label>
                <select 
                  className="select" 
                  value={editDraft.semester || ''} 
                  onChange={(e) => setEditDraft({ ...editDraft, semester: e.target.value })}
                >
                  <option value="">Leave blank to skip</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </div>
              <div>
                <label className="label" style={{ fontSize: '13px' }}>Exam Type</label>
                <select 
                  className="select" 
                  value={editDraft.exam_type || ''} 
                  onChange={(e) => setEditDraft({ ...editDraft, exam_type: e.target.value })}
                >
                  <option value="">Leave blank to skip</option>
                  <option value="Main">Main</option>
                  <option value="Supplementary">Supplementary</option>
                  <option value="CAT">CAT</option>
                  <option value="Mock">Mock</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button 
                className="btn primary" 
                onClick={saveMultiEdit}
                style={{ background: '#00a884' }}
              >
                Save Changes to All {selectedIds.size} Item{selectedIds.size !== 1 ? 's' : ''}
              </button>
              <button 
                className="btn" 
                onClick={handleMultiDelete}
                style={{ background: '#ff4444', color: '#fff' }}
                title="Delete selected past papers"
              >
                🗑️ Delete All {selectedIds.size}
              </button>
              <button 
                className="btn" 
                onClick={cancelMultiEdit}
                style={{ background: '#2a3f56', color: '#e9edef' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Selection Toolbar */}
        {selectedIds.size > 0 && !isMultiEditMode && (
          <div style={{ 
            background: '#0b1216', 
            borderRadius: '6px', 
            padding: '12px',
            marginBottom: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
          }}>
            <span style={{ color: '#8696a0' }}>
              {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button 
                className="btn primary" 
                onClick={startMultiEdit}
                style={{ background: '#00a884' }}
              >
                Edit Selected ({selectedIds.size})
              </button>
              <button 
                className="btn" 
                onClick={() => setSelectedIds(new Set())}
                style={{ background: '#2a3f56', color: '#e9edef' }}
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: '1200px' }}>
            <thead>
              <tr>
                {showCheckboxes && (
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === count && count > 0}
                      onChange={toggleSelectAll}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      title={selectedIds.size === count && count > 0 ? 'Unselect all' : 'Select all across all pages'}
                    />
                  </th>
                )}
                <th style={{ width: '250px' }}>Unit Name</th>
                <th style={{ width: '150px', cursor: 'pointer' }} onClick={() => toggleSort('unit_code')}>Unit Code {sort.col === 'unit_code' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ width: '150px' }}>Faculty</th>
                <th style={{ width: '100px', cursor: 'pointer' }} onClick={() => toggleSort('year')}>Year {sort.col === 'year' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ width: '100px' }}>Semester</th>
                <th style={{ width: '120px' }}>Exam Type</th>
                <th style={{ width: '100px', cursor: 'pointer' }} onClick={() => toggleSort('downloads_count')}>Downloads {sort.col === 'downloads_count' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ width: '180px', cursor: 'pointer' }} onClick={() => toggleSort('created_at')}>Uploaded {sort.col === 'created_at' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ width: '150px' }}>Uploaded By</th>
                <th style={{ width: '200px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={showCheckboxes ? 13 : 12} style={{ textAlign: 'center', color: '#8696a0' }}>Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={showCheckboxes ? 13 : 12} style={{ textAlign: 'center', color: '#8696a0' }}>No data</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} style={{ background: selectedIds.has(row.id) ? 'rgba(0, 168, 132, 0.1)' : 'transparent' }}>
                  {showCheckboxes && (
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelectRow(row.id)}
                        disabled={isMultiEditMode}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </td>
                  )}
                  <td style={{ color: row.unit_name ? '#e9edef' : '#8696a0' }}>{editingId === row.id ? <input className="input" value={editDraft.unit_name} onChange={(e) => setEditDraft({ ...editDraft, unit_name: e.target.value })} /> : (row.unit_name || '—')}</td>
                  <td style={{ color: row.unit_code ? '#e9edef' : '#8696a0' }}>{editingId === row.id ? <input className="input" value={editDraft.unit_code} onChange={(e) => setEditDraft({ ...editDraft, unit_code: e.target.value })} /> : (row.unit_code || '—')}</td>
                  <td style={{ color: row.faculty ? '#e9edef' : '#8696a0' }}>
                    {editingId === row.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {!useCustomFaculty ? (
                          <>
                            <select 
                              className="select" 
                              value={editDraft.faculty} 
                              onChange={(e) => setEditDraft({ ...editDraft, faculty: e.target.value })}
                              style={{ marginBottom: '4px' }}
                            >
                              <option value="">Select Faculty</option>
                              {faculties && faculties.length > 0 ? faculties.map(f => <option key={f} value={f}>{f}</option>) : <option value="">No faculties available</option>}
                            </select>
                          </>
                        ) : (
                          <input 
                            className="input" 
                            placeholder="e.g., Engineering, Business" 
                            value={customFaculty} 
                            onChange={(e) => setCustomFaculty(e.target.value)}
                          />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                          <input 
                            type="checkbox" 
                            id={`custom-faculty-${row.id}`}
                            checked={useCustomFaculty}
                            onChange={(e) => {
                              setUseCustomFaculty(e.target.checked);
                              if (!e.target.checked) {
                                setCustomFaculty('');
                              }
                            }}
                            style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                          />
                          <label htmlFor={`custom-faculty-${row.id}`} style={{ color: '#8696a0', cursor: 'pointer', fontSize: '11px' }}>
                            Add
                          </label>
                        </div>
                      </div>
                    ) : (row.faculty || '—')}
                  </td>
                  <td style={{ color: row.year ? '#e9edef' : '#8696a0' }}>{editingId === row.id ? <input className="input" type="number" value={editDraft.year} onChange={(e) => setEditDraft({ ...editDraft, year: e.target.value })} /> : (row.year || '—')}</td>
                  <td>{editingId === row.id ? <select className="select" value={editDraft.semester} onChange={(e) => setEditDraft({ ...editDraft, semester: e.target.value })}><option value="">—</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select> : (row.semester || '—')}</td>
                  <td>{editingId === row.id ? <select className="select" value={editDraft.exam_type} onChange={(e) => setEditDraft({ ...editDraft, exam_type: e.target.value })}><option value="Main">Main</option><option value="Supplementary">Supplementary</option><option value="CAT">CAT</option><option value="Mock">Mock</option></select> : (row.exam_type || 'Main')}</td>
                  <td>{row.downloads_count || 0}</td>
                  <td style={{ color: '#8696a0', fontSize: '12px' }}>{formatTimestamp(row.created_at)}</td>
                  <td style={{ color: row.profiles?.full_name ? '#e9edef' : '#8696a0', fontSize: '13px' }}>{row.profiles?.full_name || row.profiles?.email || '—'}</td>
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

export default PastPapersManagement;
