import React from 'react';

export const SubscriptionThanks = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b1216',
        color: '#e9edef',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          textAlign: 'center',
          background: '#111b21',
          padding: '24px 32px',
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          border: '1px solid #2a3942',
        }}
      >
        <h1 style={{ marginBottom: 12 }}>Payment Complete</h1>
        <p style={{ marginBottom: 16, color: '#8696a0' }}>
          Thank you for your payment via M-Pesa.
        </p>
        <p style={{ marginBottom: 24, color: '#8696a0' }}>
          Please return to the main Campuslife tab and click <strong>Verify</strong> in the
          subscription popup to activate your access.
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            padding: '10px 18px',
            borderRadius: 999,
            background: '#00a884',
            color: '#0b1216',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Back to Campuslife
        </a>
      </div>
    </div>
  );
};
