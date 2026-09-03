import React, { useState } from 'react';
import { API_URL } from '../../config';

export const EmailSender = () => {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);

    if (!to) {
      setStatus({ type: 'error', text: 'Please enter a recipient email.' });
      return;
    }

    try {
      setSending(true);
      const res = await fetch(`${API_URL}/api/utils/send-test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, message }),
      });

      const contentType = res.headers.get('content-type') || '';
      let json = null;
      if (contentType.includes('application/json')) {
        json = await res.json();
      }

      if (!res.ok || !json?.ok) {
        const errorMsg = json?.error || `Request failed with status ${res.status} (${contentType || 'no content-type'})`;
        throw new Error(errorMsg);
      }

      setStatus({ type: 'success', text: 'Email sent successfully.' });
    } catch (err) {
      console.error('Send email failed:', err);
      setStatus({ type: 'error', text: err.message || 'Failed to send email.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '24px',
        background: '#020817',
        color: '#e5e7eb',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 640,
          background: '#020617',
          borderRadius: 12,
          padding: '24px 24px 32px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          border: '1px solid #1f2937',
        }}
      >
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Manual Email Sender</h1>
        <p style={{ fontSize: 14, color: '#9ca3af', marginBottom: 20 }}>
          Use this page to send a test email via the backend (Gmail / SMTP). Later we can
          hook this into subscriptions and other flows.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>To (email)</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #374151',
                background: '#020617',
                color: '#e5e7eb',
                fontSize: 14,
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="SomaLux test email"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #374151',
                background: '#020617',
                color: '#e5e7eb',
                fontSize: 14,
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Type the body of your email here..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #374151',
                background: '#020617',
                color: '#e5e7eb',
                fontSize: 14,
                resize: 'vertical',
              }}
            />
          </div>

          {status && (
            <div
              style={{
                fontSize: 13,
                padding: '8px 10px',
                borderRadius: 8,
                background: status.type === 'success' ? 'rgba(22, 163, 74, 0.15)' : 'rgba(220, 38, 38, 0.15)',
                border: `1px solid ${status.type === 'success' ? '#16a34a' : '#ef4444'}`,
                color: status.type === 'success' ? '#bbf7d0' : '#fecaca',
              }}
            >
              {status.text}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              type="submit"
              disabled={sending}
              style={{
                padding: '10px 18px',
                borderRadius: 999,
                border: 'none',
                background: sending ? '#4b5563' : '#22c55e',
                color: '#020617',
                fontWeight: 600,
                cursor: sending ? 'not-allowed' : 'pointer',
              }}
            >
              {sending ? 'Sending...' : 'Send Email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
