import React, { useEffect, useState, useMemo } from 'react';
import { FiRefreshCw, FiBook, FiFileText, FiMapPin } from 'react-icons/fi';
import { useAdminUI } from '../AdminUIContext';
import SubmissionsList from './SubmissionsList';
import SubmissionDetailModal from './SubmissionDetailModal';
import { API_URL } from '../../../../config';
import { supabase } from '../../supabaseClient';

const API_BASE = API_URL;

const Submissions = ({ userProfile }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [busy, setBusy] = useState({});
  const [type, setType] = useState('books'); // 'books' | 'past_papers' | 'universities'
  const [summary, setSummary] = useState({ booksPending: 0, pastPapersPending: 0, universitiesPending: 0 });
  const [selected, setSelected] = useState(null);

  const { confirm, prompt, showToast } = useAdminUI();

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    'x-actor-email': userProfile?.email || 'admin',
    'x-actor-id': userProfile?.id || userProfile?.user_id || '' // Add user UUID if available
  }), [userProfile?.email, userProfile?.id, userProfile?.user_id]);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token
      ? { ...headers, Authorization: `Bearer ${session.access_token}` }
      : headers;
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use submissions endpoint for all types (books, past_papers, universities)
      // This endpoint queries the appropriate table and filters by status
      const url = `${API_BASE}/api/elib/submissions?status=${encodeURIComponent(filter)}&type=${encodeURIComponent(type)}`;
      console.log(`[Submissions] Fetching ${type} with status=${filter}: ${url}`);
      
      const res = await fetch(url, { headers: await getAuthHeaders() });
      const json = await res.json();
      console.log(`[Submissions] Response for ${type}:`, { status: res.status, count: json.submissions?.length, items: json.submissions });
      
      if (!res.ok) throw new Error(json?.error || `Failed to load ${type} submissions`);
      
      const items = Array.isArray(json.submissions) ? json.submissions : [];
      console.log(`[Submissions] Loaded ${items.length} ${type} submissions with status=${filter}`);
      setItems(items);
    } catch (e) {
      console.error(`[Submissions] Error fetching ${type}:`, e);
      setError(e.message || `Failed to load ${type} submissions`);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/elib/submissions/summary`, { headers: await getAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load summary');
      
      setSummary({
        booksPending: json.booksPending || 0,
        pastPapersPending: json.pastPapersPending || 0,
        universitiesPending: json.universitiesPending || 0,
      });
    } catch (_) {
      // ignore summary errors in UI
    }
  };

  useEffect(() => { fetchData(); }, [filter, type]);
  useEffect(() => { fetchSummary(); }, []);

  const approve = async (id) => {
    console.log('Approve called with id:', id, 'type of id:', typeof id);
    
    const item = items.find((x) => x.id === id) || selected;
    console.log('Found item:', item);
    
    const label = type === 'books'
      ? (item?.title || 'this book')
      : type === 'universities'
      ? (item?.name || 'this university')
      : (item?.unit_code || item?.unit_name || 'this past paper');

    // Validate that id is a UUID, not an email
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(id)) {
      console.error('Invalid submission ID format:', id);
      // If id is not valid but we have selected with valid id, use that
      if (selected?.id && uuidPattern.test(selected.id)) {
        console.log('Recursing with selected.id:', selected.id);
        return approve(selected.id);
      }
      showToast({ type: 'error', message: 'Invalid submission ID format. Please refresh and try again.' });
      return;
    }

    const ok = await confirm({
      title: `Approve ${type === 'books' ? 'Book' : type === 'universities' ? 'University' : 'Past Paper'}?`,
      message: `Are you sure you want to approve ${label}? It will become visible to users and count towards the uploader's contributions.`,
      confirmLabel: 'Approve',
      cancelLabel: 'Cancel',
      variant: 'default',
    });
    if (!ok) return;

    setBusy((prev) => ({ ...prev, [id]: true }));
    
    // Optimistic update: remove item immediately and decrement count
    setItems((prev) => prev.filter((x) => x.id !== id));
    setSelected(null);
    setSummary((prev) => {
      const updated = { ...prev };
      if (type === 'books') updated.booksPending = Math.max(0, updated.booksPending - 1);
      else if (type === 'universities') updated.universitiesPending = Math.max(0, updated.universitiesPending - 1);
      else if (type === 'past_papers') updated.pastPapersPending = Math.max(0, updated.pastPapersPending - 1);
      return updated;
    });
    
    try {
      let res;
      if (type === 'universities') {
        // For universities, just update the status
        res = await fetch(`${API_BASE}/api/elib/universities/${id}`, {
          method: 'PATCH',
          headers: await getAuthHeaders(),
          body: JSON.stringify({ status: 'approved' }),
        });
      } else {
        // For books/past_papers, use submissions endpoint
        res = await fetch(`${API_BASE}/api/elib/submissions/${id}/approve?type=${encodeURIComponent(type)}`, { method: 'POST', headers: await getAuthHeaders() });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.details || json?.error || 'Approve failed');
      showToast({ type: 'success', message: `${type === 'books' ? 'Book' : type === 'universities' ? 'University' : 'Past paper'} approved successfully.` });
    } catch (e) {
      console.error('Approve submission failed:', e);
      showToast({ type: 'error', message: e.message || 'Approve failed.' });
      // Restore item and count on error
      fetchData();
      fetchSummary();
    } finally {
      setBusy((prev) => ({ ...prev, [id]: false }));
    }
  };

  const reject = async (id) => {
    // Debug: log what was passed
    console.log('Reject called with id:', id, 'type of id:', typeof id);
    
    const item = items.find((x) => x.id === id) || selected;
    console.log('Found item:', item);
    
    const label = type === 'books'
      ? (item?.title || 'this book')
      : type === 'universities'
      ? (item?.name || 'this university')
      : (item?.unit_code || item?.unit_name || 'this past paper');

    // Validate that id is a UUID, not an email
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(id)) {
      console.error('Invalid submission ID format:', id);
      // If id is not valid but we have selected with valid id, use that
      if (selected?.id && uuidPattern.test(selected.id)) {
        console.log('Recursing with selected.id:', selected.id);
        return reject(selected.id);
      }
      showToast({ type: 'error', message: 'Invalid submission ID format. Please refresh and try again.' });
      return;
    }

    const reason = await prompt({
      title: `Reject ${type === 'books' ? 'Book' : type === 'universities' ? 'University' : 'Past Paper'}?`,
      message: `Optionally provide a reason for rejecting ${label}. This may be shared with the uploader.`,
      label: 'Rejection reason',
      defaultValue: '',
      multiline: true,
      confirmLabel: 'Reject',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });

    if (reason === null) return;

    setBusy((prev) => ({ ...prev, [id]: true }));
    
    // Optimistic update: remove item immediately and decrement count
    setItems((prev) => prev.filter((x) => x.id !== id));
    setSelected(null);
    setSummary((prev) => {
      const updated = { ...prev };
      if (type === 'books') updated.booksPending = Math.max(0, updated.booksPending - 1);
      else if (type === 'universities') updated.universitiesPending = Math.max(0, updated.universitiesPending - 1);
      else if (type === 'past_papers') updated.pastPapersPending = Math.max(0, updated.pastPapersPending - 1);
      return updated;
    });
    
    try {
      let res;
      if (type === 'universities') {
        // For universities, update status and add rejection reason
        res = await fetch(`${API_BASE}/api/elib/universities/${id}`, {
          method: 'PATCH',
          headers: await getAuthHeaders(),
          body: JSON.stringify({ status: 'rejected', rejection_reason: reason || '' }),
        });
      } else {
        // For books/past_papers, use submissions endpoint
        res = await fetch(`${API_BASE}/api/elib/submissions/${id}/reject?type=${encodeURIComponent(type)}`, {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({ reason: reason || '' }),
        });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Reject failed');
      showToast({ type: 'success', message: `${type === 'books' ? 'Book' : type === 'universities' ? 'University' : 'Past paper'} rejected.` });
    } catch (e) {
      console.error('Reject submission failed:', e);
      showToast({ type: 'error', message: e.message || 'Reject failed.' });
      // Restore item and count on error
      fetchData();
      fetchSummary();
    } finally {
      setBusy((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="panel">
      <div className="panel-title">Submissions</div>
      <div style={{ color: '#8696a0', fontSize: 12, marginBottom: 8 }}>
        Review and approve or reject user-contributed books, universities, and past papers.
      </div>

      <div className="panel" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button
            className="btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: type === 'books' ? '#00a884' : 'transparent',
              color: type === 'books' ? '#fff' : '#e9edef',
              borderColor: type === 'books' ? '#00a884' : '#374151',
            }}
            onClick={() => setType('books')}
          >
            <FiBook /> Books
            {summary.booksPending > 0 && (
              <span className="notification-badge" style={{ marginLeft: 4 }}>
                {summary.booksPending > 99 ? '99+' : summary.booksPending}
              </span>
            )}
          </button>
          <button
            className="btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: type === 'universities' ? '#00a884' : 'transparent',
              color: type === 'universities' ? '#fff' : '#e9edef',
              borderColor: type === 'universities' ? '#00a884' : '#374151',
            }}
            onClick={() => setType('universities')}
          >
            <FiMapPin /> Universities
            {summary.universitiesPending > 0 && (
              <span className="notification-badge" style={{ marginLeft: 4 }}>
                {summary.universitiesPending > 99 ? '99+' : summary.universitiesPending}
              </span>
            )}
          </button>
          <button
            className="btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: type === 'past_papers' ? '#00a884' : 'transparent',
              color: type === 'past_papers' ? '#fff' : '#e9edef',
              borderColor: type === 'past_papers' ? '#00a884' : '#374151',
            }}
            onClick={() => setType('past_papers')}
          >
            <FiFileText /> Past Papers
            {summary.pastPapersPending > 0 && (
              <span className="notification-badge" style={{ marginLeft: 4 }}>
                {summary.pastPapersPending > 99 ? '99+' : summary.pastPapersPending}
              </span>
            )}
          </button>
        </div>

        <select
          className="input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ maxWidth: 200 }}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
        <button className="btn" onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <FiRefreshCw /> Refresh
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 8, padding: 6, borderRadius: 4, border: '1px solid rgba(234,67,53,.35)', color: '#ffab91', background: 'rgba(234,67,53,.08)', fontSize: 12 }}>
          {error}
        </div>
      )}

      <SubmissionsList
        items={items}
        loading={loading}
        type={type}
        busy={busy}
        onSelect={setSelected}
        onApprove={approve}
        onReject={reject}
      />

      {selected && (
        <SubmissionDetailModal
          submission={selected}
          type={type}
          busy={busy}
          onClose={() => setSelected(null)}
          onApprove={approve}
          onReject={reject}
        />
      )}
    </div>
  );
};

export default Submissions;