import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchUserSearchHistoryAdmin } from '../api';

const UserSearchDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const rows = await fetchUserSearchHistoryAdmin(id, { limit: 200 });
        if (!cancelled) setEvents(rows || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const grouped = useMemo(() => {
    const map = { books: [], authors: [], past_papers: [], other: [] };
    events.forEach((e) => {
      const scope = e.scope || 'other';
      if (map[scope]) map[scope].push(e);
      else map.other.push(e);
    });
    return map;
  }, [events]);

  const renderScopeTable = (scopeId, label) => {
    const rows = grouped[scopeId] || [];
    return (
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ color: '#e9edef', marginBottom: 8 }}>{label}</h3>
        {rows.length === 0 ? (
          <div style={{ color: '#8696a0' }}>No search events recorded for this scope.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Query</th>
                <th>Results Count</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>{e.query_text}</td>
                  <td>{e.results_count != null ? e.results_count : '—'}</td>
                  <td>{e.created_at ? new Date(e.created_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  return (
    <div className="panel">
      <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button className="btn" onClick={() => navigate(-1)}>
          Back
        </button>
        <span>User Search Details</span>
      </div>

      {loading ? (
        <div style={{ color: '#8696a0', padding: 16 }}>Loading user search history...</div>
      ) : events.length === 0 ? (
        <div style={{ color: '#8696a0', padding: 16 }}>No search history found for this user.</div>
      ) : (
        <>
          {renderScopeTable('books', 'Book Searches')}
          {renderScopeTable('authors', 'Author Searches')}
          {renderScopeTable('past_papers', 'Past Paper Searches')}
        </>
      )}
    </div>
  );
};

export default UserSearchDetails;
