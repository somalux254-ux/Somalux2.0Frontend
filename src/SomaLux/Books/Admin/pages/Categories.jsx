import React, { useEffect, useMemo, useState } from 'react';
import { FiEdit2, FiFolder, FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi';
import { useAdminUI } from '../AdminUIContext';
import { supabase } from '../../supabaseClient';
import { createCategory, deleteCategory, fetchCategories, updateCategory } from '../api';

const Categories = () => {
  const { confirm, prompt, showToast } = useAdminUI();
  const [rows, setRows] = useState([]);
  const [bookCounts, setBookCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [adding, setAdding] = useState({ name: '' });
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ name: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const categories = await fetchCategories();
      setRows(categories);
      const counts = {};
      await Promise.all(categories.map(async (category) => {
        const { count, error } = await supabase
          .from('books')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', category.id);
        if (!error) counts[category.id] = count || 0;
      }));
      setBookCounts(counts);
    } catch (error) {
      setLoadError(error?.message || 'Could not load categories. Check database permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(row =>
      row.name?.toLowerCase().includes(query)
    );
  }, [rows, searchTerm]);

  const add = async (categoryName = adding.name) => {
    const name = categoryName.trim();
    if (!name) {
      showToast({ type: 'error', message: 'Category name is required.' });
      return;
    }
    setSaving(true);
    try {
      await createCategory({ name });
      setAdding({ name: '' });
      await load();
      showToast({ type: 'success', message: 'Category created successfully.' });
    } catch (error) {
      showToast({ type: 'error', message: error?.message || 'Could not create category.' });
    } finally {
      setSaving(false);
    }
  };

  const promptForCategory = async () => {
    const name = await prompt({
      title: 'Add category',
      label: 'Category name',
      confirmLabel: 'Save',
      cancelLabel: 'Cancel',
      inputClassName: 'category-name-prompt-input',
      actionsClassName: 'category-name-prompt-actions'
    });
    if (name?.trim()) await add(name);
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setDraft({ name: row.name || '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({ name: '' });
  };

  const saveEdit = async (id) => {
    const name = draft.name.trim();
    if (!name) {
      showToast({ type: 'error', message: 'Category name is required.' });
      return;
    }
    setSaving(true);
    try {
      await updateCategory(id, { name });
      cancelEdit();
      await load();
      showToast({ type: 'success', message: 'Category updated successfully.' });
    } catch (error) {
      showToast({ type: 'error', message: error?.message || 'Could not update category.' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    const count = bookCounts[row.id] || 0;
    const confirmed = await confirm({
      title: 'Delete category?',
      message: count > 0
        ? `${count} book${count === 1 ? '' : 's'} use this category. Deleting it will leave those books uncategorized.`
        : 'This will permanently remove the category.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      await deleteCategory(row.id);
      await load();
      showToast({ type: 'success', message: 'Category deleted successfully.' });
    } catch (error) {
      showToast({ type: 'error', message: error?.message || 'Could not delete category.' });
    }
  };

  return (
    <div className="panel">
      <div className="category-toolbar">
        <div className="category-search">
          <FiSearch size={16} />
          <input
            className="input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search categories..."
            aria-label="Search categories"
          />
        </div>
        <div className="category-add">
          <button className="btn primary" onClick={promptForCategory} disabled={saving}>
            Add category
          </button>
        </div>
      </div>

      {loadError && (
        <div style={{ padding: '1rem', marginBottom: '1rem', border: '1px solid #ef4444', borderRadius: 8, color: '#fecaca' }}>
          <strong>Categories could not be loaded.</strong>
          <div style={{ margin: '0.35rem 0 0.75rem' }}>{loadError}</div>
          <button className="btn" onClick={load}>Retry</button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="table categories-table numbered-table">
          <thead>
            <tr><th>#</th><th>Category</th><th style={{ textAlign: 'center' }}>Books</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#8696a0' }}>Loading categories...</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#8696a0' }}>{searchTerm ? 'No matching categories.' : 'No categories created yet.'}</td></tr>
            ) : filteredRows.map((row, idx) => (
              <tr key={row.id}>
                <td className="admin-row-number">{idx + 1}</td>
                <td>
                  {editingId === row.id ? <input className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#e9edef', fontWeight: 600 }}><FiFolder color="#00a884" />{row.name}</span>}
                </td>
                <td style={{ textAlign: 'center', color: '#00a884' }}>{bookCounts[row.id] || 0}</td>
                <td>
                  <div className="actions" style={{ justifyContent: 'flex-end' }}>
                    {editingId === row.id ? <>
                      <button className="btn primary" onClick={() => saveEdit(row.id)} disabled={saving}>Save</button>
                      <button className="btn" onClick={cancelEdit} disabled={saving}>Cancel</button>
                    </> : <>
                      <button className="btn" onClick={() => startEdit(row)} title="Edit category" aria-label={`Edit ${row.name}`}><FiEdit2 size={16} /></button>
                      <button className="btn" onClick={() => remove(row)} title="Delete category" aria-label={`Delete ${row.name}`}><FiTrash2 size={16} color="#ef4444" /></button>
                    </>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Categories;
