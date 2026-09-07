import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCheck, FiChevronDown, FiChevronLeft, FiChevronRight, FiFilter, FiSearch } from 'react-icons/fi';
import { fetchBooks, fetchCategories, createCategory, deleteBook, updateBook } from '../api';
import { useAdminUI } from '../AdminUIContext';
import { supabase } from '../../supabaseClient';
import '../../BookPanel.css';

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

const CategoryDropdown = ({ value, options, onChange, ariaLabel, placeholder = 'Select category' }) => {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const menuRef = useRef(null);
  const panelRef = useRef(null);
  const selectedLabel = options.find(option => String(option.value) === String(value))?.label || placeholder;

  useEffect(() => {
    const closeMenu = (event) => {
      if (
        menuRef.current && !menuRef.current.contains(event.target) &&
        panelRef.current && !panelRef.current.contains(event.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const trigger = menuRef.current?.querySelector('.users-filter-trigger');
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 5, left: rect.left, width: rect.width });
    }
    setOpen(true);
  };

  return (
    <div className="users-filter-menu books-category-edit-dropdown" ref={menuRef}>
      <button
        type="button"
        className={`users-filter-trigger${open ? ' is-open' : ''}`}
        onClick={toggleMenu}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
      >
        <span>{selectedLabel}</span>
        <FiChevronDown className="users-filter-chevron" />
      </button>
      {open && menuPosition && createPortal(
        <div
          className="users-filter-panel books-category-edit-panel"
          role="menu"
          ref={panelRef}
          style={{ top: menuPosition.top, left: menuPosition.left, minWidth: menuPosition.width }}
        >
          {options.map(option => (
            <button
              type="button"
              role="menuitem"
              className={`users-filter-option${String(value) === String(option.value) ? ' is-selected' : ''}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              key={String(option.value)}
            >
              <span>{option.label}</span>
              {String(value) === String(option.value) && <FiCheck />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

const Books = ({ userProfile }) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(23);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [sort, setSort] = useState({ col: 'created_at', dir: 'desc' });
  const [editingId, setEditingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editDraft, setEditDraft] = useState({});
  const [expandedEditFields, setExpandedEditFields] = useState(new Set());
  const [newPdf, setNewPdf] = useState(null);
  const [newCover, setNewCover] = useState(null);
  const [isMultiEditMode, setIsMultiEditMode] = useState(false);
  const [showCheckboxes, setShowCheckboxes] = useState(false);
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);


  const { confirm, showToast } = useAdminUI();

  const ADMIN_EMAILS = ['campuslives254@gmail.com', 'paltechsomalux@gmail.com', 'eliblearning@gmail.com'];
  const isAdmin = userProfile?.role === 'admin' || ADMIN_EMAILS.includes(userProfile?.email);
  const isEditor = userProfile?.role === 'editor' || ADMIN_EMAILS.includes(userProfile?.email);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count, pageSize]);

  const load = async () => {
    setLoading(true);
    try {
      const fetchParams = { 
        page, 
        pageSize, 
        search,
        categoryId,
        uncategorized: categoryId === 'uncategorized',
        sort
      };
      const { data, count: total } = await fetchBooks(fetchParams);
      
      setRows(data);
      setCount(total);
    } finally { setLoading(false); }
  };

  // Fetch all book IDs matching current filters (no pagination)
  const fetchAllMatchingIds = async () => {
    try {
      const fetchParams = { 
        page: 1, 
        pageSize: 10000, 
        search, 
        categoryId,
        uncategorized: categoryId === 'uncategorized',
        sort 
      };
      const { data } = await fetchBooks(fetchParams);
      return new Set(data.map(item => item.id));
    } catch (error) {
      console.error('Failed to fetch all matching books:', error);
      return new Set();
    }
  };

  useEffect(() => {
    (async () => {
      if (userProfile) {
        await load();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, categoryId, sort.col, sort.dir, userProfile]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const closeFilterMenu = (event) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeFilterMenu);
    return () => document.removeEventListener('mousedown', closeFilterMenu);
  }, []);

  useEffect(() => {
    if (!userProfile) return undefined;

    const channel = supabase
      .channel('admin-books-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // Reload when the current page/filter changes so Realtime uses current values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, sort.col, sort.dir, userProfile]);

  const canEdit = (row) => {
    if (isAdmin) return true;
    if (isEditor) return true;
    return false;
  };

  const startEdit = (row) => {
    if (!canEdit(row)) {
      showToast({ type: 'error', message: 'You do not have permission to edit this book.' });
      return;
    }
    setEditingId(row.id);
    setEditDraft({
      title: row.title || '',
      author: row.author || '',
      year: row.year || '',
      language: row.language || '',
      isbn: row.isbn || '',
      pages: row.pages || '',
      category_id: row.category_id || '',
      publisher: row.publisher || ''
    });
    setExpandedEditFields(new Set());
    setNewPdf(null);
    setNewCover(null);
    setUseCustomCategory(false);
    setCustomCategory('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
    setExpandedEditFields(new Set());
    setNewPdf(null);
    setNewCover(null);
    setCustomCategory('');
    setUseCustomCategory(false);
  };

  const resolveCategoryId = async () => {
    const name = customCategory.trim();
    if (!name) throw new Error('Enter a name for the new category.');

    const existing = categories.find(category => category.name?.trim().toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;

    const created = await createCategory({ name, description: '' });
    if (!created?.id) throw new Error('The category was created but no ID was returned.');
    setCategories(current => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created.id;
  };

  const expandEditFieldOnEnter = (field, event) => {
    if (event.key === 'Enter') {
      setExpandedEditFields((fields) => new Set(fields).add(field));
    }
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
      setSelectedIds(new Set());
    } else {
      fetchAllMatchingIds().then(allIds => {
        setSelectedIds(allIds);
      });
    }
  };

  const startMultiEdit = () => {
    if (selectedIds.size === 0) {
      showToast({ type: 'error', message: 'Please select at least one book to edit.' });
      return;
    }
    
    const visibleSelectedIds = Array.from(selectedIds).filter(id => rows.some(r => r.id === id));
    if (visibleSelectedIds.length > 0) {
      const canEditVisible = visibleSelectedIds.every(id => {
        const row = rows.find(r => r.id === id);
        return canEdit(row);
      });

      if (!canEditVisible) {
        showToast({ type: 'error', message: 'You do not have permission to edit some of the selected books.' });
        return;
      }
    }

    setIsMultiEditMode(true);
    setUseCustomCategory(false);
    setCustomCategory('');
    setEditDraft({
      title: '', author: '', year: '', publisher: ''
    });
  };

  const cancelMultiEdit = () => {
    setIsMultiEditMode(false);
    setEditDraft({});
    setSelectedIds(new Set());
    setShowCheckboxes(false);
    setCustomCategory('');
    setUseCustomCategory(false);
  };

  const saveMultiEdit = async () => {
    if (selectedIds.size === 0) {
      showToast({ type: 'error', message: 'No books selected.' });
      return;
    }

    const updates = {};
    if (editDraft.title) updates.title = editDraft.title;
    if (editDraft.author) updates.author = editDraft.author;
    if (editDraft.year) updates.year = editDraft.year;
    if (editDraft.publisher) updates.publisher = editDraft.publisher;
    if (editDraft.category_id === '__custom__') {
      updates.category_id = await resolveCategoryId();
    } else if (editDraft.category_id !== '') {
      updates.category_id = editDraft.category_id === '__uncategorized__' ? null : editDraft.category_id;
    }

    if (Object.keys(updates).length === 0) {
      showToast({ type: 'error', message: 'Please enter at least one field to update.' });
      return;
    }

    try {
      const booksToUpdate = Array.from(selectedIds).map(id => {
        const cachedRow = rows.find(r => r.id === id);
        return { id, cached: cachedRow };
      });

      const missingIds = booksToUpdate.filter(p => !p.cached).map(p => p.id);
      let missingBooksMap = new Map();
      
      if (missingIds.length > 0) {
        const { data: allSelectedBooks } = await fetchBooks({ 
          page: 1, 
          pageSize: 10000, 
          search,
          categoryId,
          uncategorized: categoryId === 'uncategorized',
          sort 
        });
        missingBooksMap = new Map(allSelectedBooks.map(p => [p.id, p]));
      }

      const updatePromises = [];
      const batchSize = 5;
      
      for (const { id, cached } of booksToUpdate) {
        const row = cached || missingBooksMap.get(id);
        if (!row) {
          console.warn(`Book with ID ${id} not found`);
          continue;
        }
        
        updatePromises.push(
          updateBook(id, { 
            updates, 
            newPdfFile: null, 
            newCoverFile: null, 
            oldFilePath: row.file_path 
          })
        );

        if (updatePromises.length >= batchSize) {
          await Promise.all(updatePromises);
          updatePromises.length = 0;
        }
      }

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }

      cancelMultiEdit();
      setLoading(true);
      const { data, count: total } = await fetchBooks({ page, pageSize, search, categoryId, uncategorized: categoryId === 'uncategorized', sort });
      setRows(data);
      setCount(total);
      setLoading(false);
      
      showToast({ type: 'success', message: `${selectedIds.size} book(s) updated successfully.` });
    } catch (e) {
      console.error('Failed to update books:', e?.message || e);
      showToast({ type: 'error', message: e?.message || 'Failed to update books.' });
    }
  };

  const saveEdit = async (row) => {
    if (!canEdit(row)) {
      showToast({ type: 'error', message: 'You can only edit books you uploaded.' });
      return;
    }
    const updates = { ...editDraft };

    if (updates.category_id === '__custom__') {
      updates.category_id = await resolveCategoryId();
    }

    try {
      await updateBook(row.id, { updates, newPdfFile: newPdf, newCoverFile: newCover, oldFilePath: row.file_path });
      cancelEdit();
      await load();
      showToast({ type: 'success', message: 'Book details updated.' });
    } catch (e) {
      console.error('Failed to update book:', e);
      showToast({ type: 'error', message: e?.message || 'Failed to update book.' });
    }
  };

  const handleDelete = async (row) => {
    if (!canEdit(row)) {
      showToast({ type: 'error', message: 'You can only delete books you uploaded.' });
      return;
    }
    const ok = await confirm({
      title: 'Delete book?',
      message: `Delete "${row.title}" and its files? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await deleteBook({ id: row.id, file_path: row.file_path });
      await load();
      showToast({ type: 'success', message: 'Book deleted.' });
    } catch (e) {
      console.error('Failed to delete book:', e);
      showToast({ type: 'error', message: e?.message || 'Failed to delete book.' });
    }
  };

  const handleMultiDelete = async () => {
    if (selectedIds.size === 0) {
      showToast({ type: 'error', message: 'Please select at least one book to delete.' });
      return;
    }

    const booksToDelete = Array.from(selectedIds);

    const ok = await confirm({
      title: `Delete ${selectedIds.size} book${selectedIds.size !== 1 ? 's' : ''}?`,
      message: `You are about to delete ${selectedIds.size} book${selectedIds.size !== 1 ? 's' : ''} and their files. This action cannot be undone.`,
      confirmLabel: 'Delete All',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      // Get all book data (including file paths)
      const booksData = [];
      for (const id of booksToDelete) {
        const cachedRow = rows.find(r => r.id === id);
        if (cachedRow) {
          booksData.push(cachedRow);
        }
      }

      // If some books are not in current page view, fetch them
      const foundIds = new Set(booksData.map(b => b.id));
      const missingIds = Array.from(booksToDelete).filter(id => !foundIds.has(id));
      
      if (missingIds.length > 0) {
        const { data: allBooks } = await fetchBooks({ 
          page: 1, 
          pageSize: 10000, 
          search, 
          sort 
        });
        
        missingIds.forEach(id => {
          const book = allBooks.find(b => b.id === id);
          if (book) booksData.push(book);
        });
      }

      // Verify all books can be deleted (after fetching all data)
      const canDeleteAll = booksData.every(book => canEdit(book));
      if (!canDeleteAll) {
        showToast({ type: 'error', message: 'You do not have permission to delete some of the selected books.' });
        return;
      }

      // Delete books sequentially with batch processing
      const deletePromises = [];
      const batchSize = 5;
      
      for (const book of booksData) {
        deletePromises.push(
          deleteBook({ id: book.id, file_path: book.file_path })
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
      const { data, count: total } = await fetchBooks({ page, pageSize, search, categoryId, uncategorized: categoryId === 'uncategorized', sort });
      setRows(data);
      setCount(total);
      setLoading(false);
      
      showToast({ type: 'success', message: `${booksData.length} book(s) deleted successfully.` });
    } catch (e) {
      console.error('Failed to delete books:', e?.message || e);
      showToast({ type: 'error', message: e?.message || 'Failed to delete books.' });
    }
  };

  const toggleSort = (col) => {
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }));
  };

  const applyCategoryFilter = (value) => {
    setPage(1);
    setCategoryId(value || null);
    setFilterMenuOpen(false);
  };

  const activeCategoryLabel = categoryId === 'uncategorized'
    ? 'Uncategorized'
    : categories.find(category => String(category.id) === String(categoryId))?.name || 'All categories';

  return (
    <div>
      <div className="panel books-panel">
        <div className="users-controls books-search-controls">
          <div className="books-search-field">
            <FiSearch style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#8696a0', fontSize: '14px' }} />
            <input
              type="search"
              enterKeyHint="search"
              placeholder="Search by title..."
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              className="input books-search-input"
            />
          </div>
          <div className="users-filter-menu books-category-filter" ref={filterMenuRef}>
            <button
              type="button"
              className={`users-filter-trigger${filterMenuOpen ? ' is-open' : ''}`}
              onClick={() => setFilterMenuOpen((open) => !open)}
              aria-expanded={filterMenuOpen}
              aria-haspopup="menu"
              aria-label="Filter books by category"
            >
              <FiFilter />
              <span>{activeCategoryLabel}</span>
              <FiChevronDown className="users-filter-chevron" />
            </button>
            {filterMenuOpen && (
              <div className="users-filter-panel" role="menu">
                <div className="users-filter-group">
                  <div className="users-filter-heading">Category</div>
                  {[
                    { value: '', label: 'All categories' },
                    { value: 'uncategorized', label: 'Uncategorized' },
                    ...categories.map(category => ({ value: category.id, label: category.name }))
                  ].map(option => (
                    <button
                      type="button"
                      role="menuitem"
                      className={`users-filter-option${String(categoryId || '') === String(option.value) ? ' is-selected' : ''}`}
                      onClick={() => applyCategoryFilter(option.value)}
                      key={option.value || 'all-categories'}
                    >
                      <span>{option.label}</span>
                      {String(categoryId || '') === String(option.value) && <FiCheck />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="actions" style={{ marginBottom: 10, marginLeft: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            {!showCheckboxes && (
              <button 
                className="btn" 
                onClick={() => setShowCheckboxes(true)}
                style={{ background: '#006b54', color: '#000', fontWeight: 700, border: 'none', boxShadow: 'none' }}
              >
                Bulk Edit
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
                Edit {selectedIds.size} Book{selectedIds.size !== 1 ? 's' : ''}
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
                <label className="label" style={{ fontSize: '13px' }}>Title</label>
                <input 
                  className="input" 
                  placeholder="Leave blank to skip" 
                  value={editDraft.title || ''} 
                  onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} 
                />
              </div>
              <div>
                <label className="label" style={{ fontSize: '13px' }}>Author</label>
                <input 
                  className="input" 
                  placeholder="Leave blank to skip" 
                  value={editDraft.author || ''} 
                  onChange={(e) => setEditDraft({ ...editDraft, author: e.target.value })} 
                />
              </div>
              <div>
                <label className="label" style={{ fontSize: '13px' }}>Category</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {useCustomCategory ? (
                    <input
                      className="input"
                      style={{ flex: 1, minWidth: 0 }}
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="New category name"
                    />
                  ) : (
                    <CategoryDropdown
                      value={editDraft.category_id || ''}
                      options={[
                        { value: '', label: 'Leave unchanged' },
                        { value: '__uncategorized__', label: 'Uncategorized' },
                        ...categories.map(category => ({ value: category.id, label: category.name }))
                      ]}
                      onChange={(value) => setEditDraft({ ...editDraft, category_id: value })}
                      ariaLabel="Category for selected books"
                    />
                  )}
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', color: '#8696a0', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input
                      className="custom-category-toggle"
                      type="checkbox"
                      checked={useCustomCategory}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUseCustomCategory(checked);
                        setEditDraft({ ...editDraft, category_id: checked ? '__custom__' : '' });
                        if (!checked) setCustomCategory('');
                      }}
                    />
                    Custom
                  </label>
                </div>
              </div>
              <div>
                <label className="label" style={{ fontSize: '13px' }}>Year</label>
                <input 
                  className="input" 
                  placeholder="Leave blank to skip" 
                  value={editDraft.year || ''} 
                  onChange={(e) => setEditDraft({ ...editDraft, year: e.target.value })} 
                />
              </div>
              <div>
                <label className="label" style={{ fontSize: '13px' }}>Publisher</label>
                <input 
                  className="input" 
                  placeholder="Leave blank to skip" 
                  value={editDraft.publisher || ''} 
                  onChange={(e) => setEditDraft({ ...editDraft, publisher: e.target.value })} 
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button 
                className="btn primary" 
                onClick={saveMultiEdit}
                style={{ background: '#00a884' }}
              >
                Save Changes to All {selectedIds.size} Book{selectedIds.size !== 1 ? 's' : ''}
              </button>
              <button 
                className="btn" 
                onClick={handleMultiDelete}
                style={{ background: '#ff4444', color: '#fff' }}
                title="Delete selected books"
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
            <div style={{ display: 'flex', gap: '8px' }}>
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

        <div className="panel books-table-panel" style={{ padding: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="table books-management-table numbered-table" style={{ minWidth: '1100px' }}>
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
                <th style={{ width: '42px' }}>#</th>
                <th style={{ width: '50px' }}>Cover</th>
                <th className="book-title-column" style={{ width: '220px', cursor: 'pointer' }} onClick={() => toggleSort('title')}>Title {sort.col === 'title' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ width: '150px', cursor: 'pointer' }} onClick={() => toggleSort('author')}>Author {sort.col === 'author' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ width: '220px' }}>Category</th>
                <th style={{ width: '75px', cursor: 'pointer' }} onClick={() => toggleSort('year')}>Year {sort.col === 'year' ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</th>
                <th style={{ width: '70px' }}>Pages</th>
                <th style={{ width: '140px' }}>Publisher</th>
                <th style={{ width: '110px' }}>Date Added</th>
                <th className="books-actions-header" style={{ width: '260px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={showCheckboxes ? 12 : 11} style={{ color: '#8696a0', textAlign: 'center' }}>Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={showCheckboxes ? 12 : 11} style={{ color: '#8696a0', textAlign: 'center' }}>No data</td></tr>
              ) : rows.map((row, idx) => (
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
                  <td className="admin-row-number">{idx + 1}</td>
                  <td>{row.cover_url ? <img src={row.cover_url} alt="cover" style={{ width: 44, height: 58, aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 4, display: 'block' }} /> : <span className="badge">No cover</span>}</td>
                  <td className="book-title-column">
                    {editingId === row.id ? (
                      <textarea className={`input book-edit-textarea${expandedEditFields.has('title') ? ' is-expanded' : ''}`} rows={expandedEditFields.has('title') ? 2 : 1} value={editDraft.title} onKeyDown={(e) => expandEditFieldOnEnter('title', e)} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} />
                    ) : highlightSearchText(row.title, search)}
                  </td>
                  <td className="books-actions-cell">
                    {editingId === row.id ? (
                      <textarea className={`input book-edit-textarea${expandedEditFields.has('author') ? ' is-expanded' : ''}`} rows={expandedEditFields.has('author') ? 2 : 1} value={editDraft.author} onKeyDown={(e) => expandEditFieldOnEnter('author', e)} onChange={(e) => setEditDraft({ ...editDraft, author: e.target.value })} />
                    ) : highlightSearchText(row.author, search)}
                  </td>
                  <td style={{ minWidth: '220px' }}>
                    {editingId === row.id ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          {useCustomCategory ? (
                            <input
                              className="input"
                              style={{ flex: 1, minWidth: 0 }}
                              value={customCategory}
                              onChange={(e) => setCustomCategory(e.target.value)}
                              placeholder="New category name"
                              aria-label={`New category for ${row.title}`}
                            />
                          ) : (
                            <CategoryDropdown
                              value={editDraft.category_id || ''}
                              options={[
                                { value: '', label: 'Uncategorized' },
                                ...categories.map(category => ({ value: category.id, label: category.name }))
                              ]}
                              onChange={(value) => { setUseCustomCategory(false); setEditDraft({ ...editDraft, category_id: value || null }); }}
                              ariaLabel={`Category for ${row.title}`}
                            />
                          )}
                          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', color: '#8696a0', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <input
                              className="custom-category-toggle"
                              type="checkbox"
                              checked={useCustomCategory}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setUseCustomCategory(checked);
                                setEditDraft({ ...editDraft, category_id: checked ? '__custom__' : (row.category_id || '') });
                                if (!checked) setCustomCategory('');
                              }}
                            />
                            Custom
                          </label>
                        </div>
                      </>
                    ) : (
                      categories.find(category => String(category.id) === String(row.category_id))?.name || 'Uncategorized'
                    )}
                  </td>
                  <td>
                    {editingId === row.id ? (
                      <input className="input" type="number" inputMode="numeric" value={editDraft.year} onChange={(e) => setEditDraft({ ...editDraft, year: e.target.value })} />
                    ) : (row.year || '—')}
                  </td>
                  <td>
                    {editingId === row.id ? (
                      <input className="input" type="number" placeholder="Pages" value={editDraft.pages} onChange={(e) => setEditDraft({ ...editDraft, pages: e.target.value })} />
                    ) : (row.pages || '—')}
                  </td>
                  <td>
                    {editingId === row.id ? (
                      <textarea className={`input book-edit-textarea${expandedEditFields.has('publisher') ? ' is-expanded' : ''}`} rows={expandedEditFields.has('publisher') ? 2 : 1} placeholder="Publisher" value={editDraft.publisher} onKeyDown={(e) => expandEditFieldOnEnter('publisher', e)} onChange={(e) => setEditDraft({ ...editDraft, publisher: e.target.value })} />
                    ) : (row.publisher || '—')}
                  </td>
                  <td>{new Date(row.created_at).toLocaleDateString()}</td>
                  <td>
                    {editingId === row.id ? (
                      <div className="book-edit-actions">
                        <div className="book-file-actions">
                        <div className="book-file-action">
                          <label className="label">Replace PDF</label>
                          <div
                            className={`file-upload-btn${newPdf ? ' has-file' : ''}`}
                            onClick={() => document.getElementById(`pdf-input-${row.id}`).click()}
                            style={{
                              border: '1px solid #374151',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              background: newPdf ? 'rgba(0, 168, 132, 0.1)' : 'transparent',
                              color: newPdf ? '#00a884' : '#e9edef',
                              transition: 'all 0.2s'
                            }}
                          >
                            <input
                              id={`pdf-input-${row.id}`}
                              type="file"
                              accept="application/pdf"
                              onChange={(e) => setNewPdf(e.target.files?.[0] || null)}
                              style={{ display: 'none' }}
                            />
                            {newPdf ? (
                              <>📄 {newPdf.name.slice(0, 20)}{newPdf.name.length > 20 ? '...' : ''}</>
                            ) : (
                              <>📄 Choose PDF</>
                            )}
                          </div>
                        </div>
                        <div className="book-file-action">
                          <label className="label">Replace Cover</label>
                          <div
                            className={`file-upload-btn${newCover ? ' has-file' : ''}`}
                            onClick={() => document.getElementById(`cover-input-${row.id}`).click()}
                            style={{
                              border: '1px solid #374151',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              background: newCover ? 'rgba(0, 168, 132, 0.1)' : 'transparent',
                              color: newCover ? '#00a884' : '#e9edef',
                              transition: 'all 0.2s'
                            }}
                          >
                            <input
                              id={`cover-input-${row.id}`}
                              type="file"
                              accept="image/*"
                              onChange={(e) => setNewCover(e.target.files?.[0] || null)}
                              style={{ display: 'none' }}
                            />
                            {newCover ? (
                              <>🖼️ {newCover.name.slice(0, 20)}{newCover.name.length > 20 ? '...' : ''}</>
                            ) : (
                              <>🖼️ Choose Image</>
                            )}
                          </div>
                        </div>
                        </div>
                        <div className="book-edit-save-actions">
                          <button className="btn primary" onClick={() => saveEdit(row)}>Save</button>
                          <button className="btn" onClick={cancelEdit}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="actions books-row-actions">
                        <button 
                          className="btn books-row-action" 
                          onClick={() => startEdit(row)}
                          disabled={!canEdit(row)}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn books-row-action" 
                          onClick={() => handleDelete(row)}
                          disabled={!canEdit(row)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && <div className="book-pagination-actions" style={{ marginTop: 10 }}>
          <button className="btn book-pagination-button" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
            <FiChevronLeft size={16} aria-hidden="true" /> Prev
          </button>
          <span style={{ color: '#cfd8dc' }}>Page {page} of {totalPages}</span>
          <button className="btn book-pagination-button" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
            Next <FiChevronRight size={16} aria-hidden="true" />
          </button>
        </div>}
      </div>
    </div>
  );
};

export default Books;
