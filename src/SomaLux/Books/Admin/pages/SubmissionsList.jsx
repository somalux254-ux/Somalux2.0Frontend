import React from 'react';
import { FiCheck, FiX, FiClock } from 'react-icons/fi';

const SubmissionsList = ({ items, loading, type, busy, onSelect, onApprove, onReject }) => {
  const fmt = (d) => d ? new Date(d).toLocaleString() : '—';

  if (loading) {
    return <div style={{ padding: 12, color: '#8696a0', fontSize: 12 }}>Loading…</div>;
  }

  if (items.length === 0) {
    return <div style={{ padding: 12, color: '#8696a0', fontSize: 12 }}>No submissions.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((sub) => (
        <div
          key={sub.id}
          style={{ 
            background: '#0b141a', 
            border: '1px solid #1f2c33', 
            borderRadius: 4, 
            padding: 8, 
            cursor: 'pointer' 
          }}
          onClick={() => onSelect(sub)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#e9edef', fontWeight: 600, fontSize: 12 }}>
                {type === 'universities' ? (sub.name || 'Untitled') : (sub.title || 'Untitled')}
              </div>
              {type === 'books' ? (
                <div style={{ color: '#8696a0', fontSize: 11 }}>
                  {sub.author || 'Unknown'} {sub.isbn ? `• ISBN: ${sub.isbn}` : ''}
                </div>
              ) : type === 'universities' ? (
                <div style={{ color: '#8696a0', fontSize: 11 }}>
                  {sub.location || 'Unknown location'} {sub.website_url ? `• Has website` : ''}
                </div>
              ) : (
                <div style={{ color: '#8696a0', fontSize: 11 }}>
                  {sub.faculty || 'Unknown faculty'} {sub.unit_code ? `• ${sub.unit_code}` : ''} {sub.unit_name ? `• ${sub.unit_name}` : ''}
                </div>
              )}
              <div style={{ color: '#00a884', fontSize: 11, marginTop: 4, fontWeight: 500 }}>
                👤 {sub.uploader_name ? `${sub.uploader_name} (${sub.uploader_email || 'No email'})` : sub.uploader_email || 'Unknown user'}
              </div>
              <div style={{ color: '#8696a0', fontSize: 10, marginTop: 3 }}>
                {fmt(sub.created_at)} • {sub.status}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {sub.status === 'pending' ? (
                <>
                  <button
                    className="btn"
                    disabled={!!busy[sub.id]}
                    onClick={(e) => { e.stopPropagation(); onApprove(sub.id); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#00a884', color: '#fff', fontSize: 11, padding: '4px 8px' }}
                  >
                    <FiCheck /> Approve
                  </button>
                  <button
                    className="btn"
                    disabled={!!busy[sub.id]}
                    onClick={(e) => { e.stopPropagation(); onReject(sub.id); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#ea4335', color: '#fff', fontSize: 11, padding: '4px 8px' }}
                  >
                    <FiX /> Reject
                  </button>
                </>
              ) : (
                <div style={{ color: '#8696a0', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                  <FiClock /> Reviewed
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SubmissionsList;