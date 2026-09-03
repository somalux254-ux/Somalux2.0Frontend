import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronLeft } from 'react-icons/fi';

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', overflowY: 'auto' }}>
      <div className="settings-stp-page-header fullpage" style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-muted)' }}>
        <button className="settings-stp-back-btn" onClick={() => navigate(-1)} style={{ marginRight: 12 }}>
          <FiChevronLeft />
          <span style={{ marginLeft: 8 }}>Back</span>
        </button>
        <h1 className="settings-stp-page-title" style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', textAlign: 'center' }}>Privacy Policy</h1>
        <div className="settings-stp-header-spacer" />
      </div>
      <div style={{ padding: 16, paddingTop: 12, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
          <h3>Somalux Privacy Policy</h3>
          <p><strong>Last updated:</strong> September 3, 2026</p>

          <section style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-muted)' }}>
            <h4>1. Data Collection</h4>
            <p>We collect personal information you provide when you create an account, use our services, or communicate with us. This may include your name, email address, phone number, profile details, and any content you share on Somalux.</p>
            <p>We also collect technical data such as device identifiers, browser information, IP address, and usage analytics to improve the service and keep the platform secure.</p>
          </section>

          <section style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-muted)' }}>
            <h4>2. Use of Information</h4>
            <p>We use personal information to provide and maintain your account, process applications, match job opportunities, and send relevant notifications. We may also use data for research, product improvements, fraud prevention, and legal compliance.</p>
          </section>

          <section style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-muted)' }}>
            <h4>3. Sharing and Disclosure</h4>
            <p>Somalux does not sell your personal data. We may share information with service providers, payment processors, and partners to operate the service, deliver support, or comply with legal obligations.</p>
            <p>We may also disclose information if required by law, to protect rights and safety, or to enforce our terms and policies.</p>
          </section>

          <section style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-muted)' }}>
            <h4>4. Your Rights</h4>
            <p>You may have rights to access, correct, delete, or restrict processing of your data under applicable law. Contact us for requests related to your personal information.</p>
          </section>

          <section style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-muted)' }}>
            <h4>5. Data Retention</h4>
            <p>We retain your information as long as necessary to provide the service, comply with legal obligations, resolve disputes, and enforce our policies.</p>
          </section>

          <section style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-muted)' }}>
            <h4>6. Security</h4>
            <p>We use commercially reasonable safeguards to protect your information, but no system is completely secure. You should protect your account credentials and report suspicious activity promptly.</p>
          </section>

          <section style={{ marginBottom: 16, padding: 14, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-muted)' }}>
            <h4>7. Contact</h4>
            <p>If you have privacy questions or requests, please contact Somalux support through the app or website.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
