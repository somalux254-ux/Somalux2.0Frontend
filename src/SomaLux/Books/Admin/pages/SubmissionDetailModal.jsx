import React, { useState } from 'react';
import { FiCheck, FiX, FiClock, FiBell, FiEye } from 'react-icons/fi';
import SimpleScrollReader from '../../SimpleScrollReader';

const SubmissionDetailModal = ({ submission, type, busy, onClose, onApprove, onReject }) => {
  const fmt = (d) => d ? new Date(d).toLocaleString() : '—';
  const [showReader, setShowReader] = useState(false);

  // Helper function to convert file path to full public URL
  const getPublicUrl = (fileUrl) => {
    if (!fileUrl) return null;
    
    // If it's already a full URL, return as-is
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return fileUrl;
    }
    
    // Otherwise, construct full Supabase public URL
    const bucket = type === 'past_papers' ? 'past-papers' : 'elib-books';
    const supabaseUrl = 'https://agirxwnwpxpddaqylucg.supabase.co';
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${fileUrl}`;
  };

  return (
    <div
      className="profile-signout-overlay"
      onClick={onClose}
      style={{ zIndex: 60 }}
    >
      <div
        className="profile-signout-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 760,
          width: '96%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#111b21',
        }}
      >
        <div className="profile-signout-header" style={{ borderBottom: '1px solid #1f2c33', padding: '8px 12px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '13px', margin: 0 }}>
            <FiBell /> Review {type === 'books' ? 'Book' : type === 'universities' ? 'University' : 'Past Paper'} Submission
          </h2>
          <button className="profile-signout-close" onClick={onClose}>×</button>
        </div>

        <div
          className="profile-signout-body"
          style={{
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            overflowY: 'auto',
          }}
        >
          {/* Uploader Information Section */}
          <div style={{
            padding: 6,
            background: 'rgba(0, 168, 132, 0.1)',
            border: '1px solid rgba(0, 168, 132, 0.3)',
            borderRadius: 4,
          }}>
            <div style={{ color: '#00a884', fontSize: 10, fontWeight: 600, marginBottom: 2 }}>
              UPLOADER
            </div>
            <div style={{ color: '#e9edef', fontSize: 12, fontWeight: 500 }}>
              {submission.uploader_name || submission.uploader_email || (submission.uploaded_by ? String(submission.uploaded_by) : 'Unknown')}
            </div>
            {submission.uploader_email && submission.uploader_email !== submission.uploader_name && (
              <div style={{ color: '#8696a0', fontSize: 10 }}>
                {submission.uploader_email}
              </div>
            )}
            {!submission.uploader_email && submission.uploaded_by && String(submission.uploaded_by).includes('@') && (
              <div style={{ color: '#8696a0', fontSize: 10 }}>
                {String(submission.uploaded_by)}
              </div>
            )}
          </div>

          {type === 'books' ? (
            <>
              {submission.cover_url && (
                <div style={{ flex: '0 0 120px', alignSelf: 'center' }}>
                  <img
                    src={submission.cover_url}
                    alt={submission.title || 'Cover'}
                    style={{ width: '100%', borderRadius: 4, objectFit: 'cover', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
                  />
                </div>
              )}
              <div>
                <h3 style={{ color: '#e9edef', marginBottom: 2, fontSize: 13, fontWeight: 600 }}>
                  {submission.title || 'Untitled'}
                </h3>
                <div style={{ color: '#8696a0', marginBottom: 8, fontSize: 11 }}>
                  <strong>{submission.author || 'Unknown author'}</strong>
                  {submission.isbn && <> • ISBN: {submission.isbn}</>}
                </div>
                {submission.description && (
                  <div style={{ color: '#cbd5f5', fontSize: 11, marginBottom: 8, lineHeight: 1.4, padding: '6px 0', borderTop: '1px solid #1f2c33', borderBottom: '1px solid #1f2c33' }}>
                    <strong style={{ color: '#e9edef' }}>Description:</strong><br />
                    {submission.description}
                  </div>
                )}
                
                {/* Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6, marginBottom: 8 }}>
                  {submission.author && (
                    <div style={{ padding: 6, background: '#0b141a', borderRadius: 4, border: '1px solid #1f2c33' }}>
                      <div style={{ color: '#8696a0', fontSize: 10 }}>AUTHOR</div>
                      <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 500 }}>{submission.author}</div>
                    </div>
                  )}
                  {submission.year && (
                    <div style={{ padding: 6, background: '#0b141a', borderRadius: 4, border: '1px solid #1f2c33' }}>
                      <div style={{ color: '#8696a0', fontSize: 10 }}>YEAR</div>
                      <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 500 }}>{submission.year}</div>
                    </div>
                  )}
                  {submission.publisher && (
                    <div style={{ padding: 6, background: '#0b141a', borderRadius: 4, border: '1px solid #1f2c33' }}>
                      <div style={{ color: '#8696a0', fontSize: 10 }}>PUBLISHER</div>
                      <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 500 }}>{submission.publisher}</div>
                    </div>
                  )}
                  {submission.pages && (
                    <div style={{ padding: 6, background: '#0b141a', borderRadius: 4, border: '1px solid #1f2c33' }}>
                      <div style={{ color: '#8696a0', fontSize: 10 }}>PAGES</div>
                      <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 500 }}>{submission.pages}</div>
                    </div>
                  )}
                  {submission.language && (
                    <div style={{ padding: 6, background: '#0b141a', borderRadius: 4, border: '1px solid #1f2c33' }}>
                      <div style={{ color: '#8696a0', fontSize: 10 }}>LANGUAGE</div>
                      <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 500 }}>{submission.language}</div>
                    </div>
                  )}
                  {submission.isbn && (
                    <div style={{ padding: 6, background: '#0b141a', borderRadius: 4, border: '1px solid #1f2c33' }}>
                      <div style={{ color: '#8696a0', fontSize: 10 }}>ISBN</div>
                      <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 500, wordBreak: 'break-all' }}>{submission.isbn}</div>
                    </div>
                  )}
                </div>

                {/* Submission Info */}
                <div style={{ marginTop: 12, padding: 10, background: '#0b141a', borderRadius: 6, border: '1px solid #1f2c33' }}>
                  <div style={{ color: '#8696a0', fontSize: 11, marginBottom: 4 }}>SUBMISSION INFO</div>
                  <div style={{ color: '#e9edef', fontSize: 12 }}>
                    <div>Uploaded: {fmt(submission.created_at)}</div>
                    <div>Status: <span style={{ color: submission.status === 'pending' ? '#fbbf24' : submission.status === 'approved' ? '#00a884' : '#ea4335', fontWeight: 600 }}>{submission.status.toUpperCase()}</span></div>
                    {submission.rejection_reason && (
                      <div style={{ color: '#ea4335', marginTop: 4 }}>Rejection Reason: {submission.rejection_reason}</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : type === 'universities' ? (
            <>
              {submission.cover_image_url && (
                <div style={{ flex: '0 0 150px', alignSelf: 'center' }}>
                  <img
                    src={submission.cover_image_url}
                    alt={submission.name || 'Cover'}
                    style={{ width: '100%', borderRadius: 4, objectFit: 'cover', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
                  />
                </div>
              )}
              <div>
                <h3 style={{ color: '#e9edef', marginBottom: 4, fontSize: 16, fontWeight: 600 }}>
                  {submission.name || 'Untitled'}
                </h3>
                <div style={{ color: '#8696a0', marginBottom: 12, fontSize: 13 }}>
                  <strong>{submission.location || 'Unknown location'}</strong>
                </div>

                {submission.description && (
                  <div style={{ color: '#cbd5f5', fontSize: 11, marginBottom: 8, lineHeight: 1.4, padding: '6px 0', borderTop: '1px solid #1f2c33', borderBottom: '1px solid #1f2c33' }}>
                    <strong style={{ color: '#e9edef' }}>Description:</strong><br />
                    {submission.description}
                  </div>
                )}

                {/* Details Grid for Universities */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6, marginBottom: 8 }}>
                  {submission.location && (
                    <div style={{ padding: 6, background: '#0b141a', borderRadius: 4, border: '1px solid #1f2c33' }}>
                      <div style={{ color: '#8696a0', fontSize: 10 }}>LOCATION</div>
                      <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 500 }}>{submission.location}</div>
                    </div>
                  )}
                  {submission.established && (
                    <div style={{ padding: 6, background: '#0b141a', borderRadius: 4, border: '1px solid #1f2c33' }}>
                      <div style={{ color: '#8696a0', fontSize: 10 }}>ESTABLISHED</div>
                      <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 500 }}>{submission.established}</div>
                    </div>
                  )}
                  {submission.website_url && (
                    <div style={{ padding: 6, background: '#0b141a', borderRadius: 4, border: '1px solid #1f2c33' }}>
                      <div style={{ color: '#8696a0', fontSize: 10 }}>WEBSITE</div>
                      <a href={submission.website_url} target="_blank" rel="noopener noreferrer" style={{ color: '#00a884', fontSize: 11, fontWeight: 500, wordBreak: 'break-all' }}>
                        Visit
                      </a>
                    </div>
                  )}
                  {submission.student_count && (
                    <div style={{ padding: 6, background: '#0b141a', borderRadius: 4, border: '1px solid #1f2c33' }}>
                      <div style={{ color: '#8696a0', fontSize: 10 }}>STUDENT COUNT</div>
                      <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 500 }}>{submission.student_count.toLocaleString()}</div>
                    </div>
                  )}
                </div>

                {/* Submission Info */}
                <div style={{ marginTop: 12, padding: 10, background: '#0b141a', borderRadius: 6, border: '1px solid #1f2c33' }}>
                  <div style={{ color: '#8696a0', fontSize: 11, marginBottom: 4 }}>SUBMISSION INFO</div>
                  <div style={{ color: '#e9edef', fontSize: 12 }}>
                    <div>Submitted: {fmt(submission.created_at)}</div>
                    <div>Status: <span style={{ color: submission.status === 'pending' ? '#fbbf24' : submission.status === 'approved' ? '#00a884' : '#ea4335', fontWeight: 600 }}>{submission.status.toUpperCase()}</span></div>
                    {submission.rejection_reason && (
                      <div style={{ color: '#ea4335', marginTop: 4 }}>Rejection Reason: {submission.rejection_reason}</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 style={{ color: '#e9edef', marginBottom: 4, fontSize: 16, fontWeight: 600 }}>
                  {submission.unit_code ? `${submission.unit_code} — ` : ''}{submission.unit_name || 'Untitled'}
                </h3>
                <div style={{ color: '#8696a0', marginBottom: 12, fontSize: 13 }}>
                  <strong>{submission.faculty || 'Unknown faculty'}</strong>
                  {submission.year && <> • {submission.year}</>}
                  {submission.semester && <> • Sem {submission.semester}</>}
                  {submission.exam_type && <> • {submission.exam_type}</>}
                </div>

                {/* Details Grid for Past Papers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6, marginBottom: 8 }}>
                  {submission.unit_code && (
                    <div style={{ padding: 6, background: '#0b141a', borderRadius: 4, border: '1px solid #1f2c33' }}>
                      <div style={{ color: '#8696a0', fontSize: 10 }}>UNIT CODE</div>
                      <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 500 }}>{submission.unit_code}</div>
                    </div>
                  )}
                  {submission.faculty && (
                    <div style={{ padding: 6, background: '#0b141a', borderRadius: 4, border: '1px solid #1f2c33' }}>
                      <div style={{ color: '#8696a0', fontSize: 10 }}>FACULTY</div>
                      <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 500 }}>{submission.faculty}</div>
                    </div>
                  )}
                  {submission.year && (
                    <div style={{ padding: 6, background: '#0b141a', borderRadius: 4, border: '1px solid #1f2c33' }}>
                      <div style={{ color: '#8696a0', fontSize: 10 }}>YEAR</div>
                      <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 500 }}>{submission.year}</div>
                    </div>
                  )}
                  {submission.semester && (
                    <div style={{ padding: 6, background: '#0b141a', borderRadius: 4, border: '1px solid #1f2c33' }}>
                      <div style={{ color: '#8696a0', fontSize: 10 }}>SEMESTER</div>
                      <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 500 }}>{submission.semester}</div>
                    </div>
                  )}
                  {submission.exam_type && (
                    <div style={{ padding: 6, background: '#0b141a', borderRadius: 4, border: '1px solid #1f2c33' }}>
                      <div style={{ color: '#8696a0', fontSize: 10 }}>EXAM TYPE</div>
                      <div style={{ color: '#e9edef', fontSize: 11, fontWeight: 500 }}>{submission.exam_type}</div>
                    </div>
                  )}
                </div>

                {/* Submission Info */}
                <div style={{ marginTop: 12, padding: 10, background: '#0b141a', borderRadius: 6, border: '1px solid #1f2c33' }}>
                  <div style={{ color: '#8696a0', fontSize: 11, marginBottom: 4 }}>SUBMISSION INFO</div>
                  <div style={{ color: '#e9edef', fontSize: 12 }}>
                    <div>Uploaded: {fmt(submission.created_at)}</div>
                    <div>Status: <span style={{ color: submission.status === 'pending' ? '#fbbf24' : submission.status === 'approved' ? '#00a884' : '#ea4335', fontWeight: 600 }}>{submission.status.toUpperCase()}</span></div>
                    {submission.rejection_reason && (
                      <div style={{ color: '#ea4335', marginTop: 4 }}>Rejection Reason: {submission.rejection_reason}</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="profile-signout-footer" style={{ borderTop: '1px solid #1f2c33', padding: 6, display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
          {submission.status === 'pending' ? (
            <>
              {(type === 'books' || type === 'past_papers') && submission.file_url && (
                <button
                  className="btn"
                  onClick={() => setShowReader(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#3b82f6', color: '#fff', fontSize: 11, padding: '4px 8px' }}
                >
                  <FiEye /> Read
                </button>
              )}
              <button
                className="btn"
                disabled={!!busy[submission.id]}
                onClick={() => onApprove(submission.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#00a884', color: '#fff', fontSize: 11, padding: '4px 8px' }}
              >
                <FiCheck /> Approve
              </button>
              <button
                className="btn"
                disabled={!!busy[submission.id]}
                onClick={() => onReject(submission.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#ea4335', color: '#fff', fontSize: 11, padding: '4px 8px' }}
              >
                <FiX /> Reject
              </button>
            </>
          ) : (
            <div style={{ color: '#8696a0', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <FiClock /> Already reviewed
            </div>
          )}
        </div>

        {showReader && submission.file_url && (
          <SimpleScrollReader
            src={getPublicUrl(submission.file_url)}
            title={submission.title || 'Document'}
            author={submission.author || 'Unknown'}
            sampleText={submission.description || ''}
            onClose={() => setShowReader(false)}
          />
        )}
      </div>
    </div>
  );
};

export default SubmissionDetailModal;