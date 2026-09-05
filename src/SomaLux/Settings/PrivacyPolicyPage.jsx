import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronLeft } from 'react-icons/fi';

export default function PrivacyPolicyPage({ onBack }) {
  const navigate = useNavigate();
  const privacySections = [
    {
      title: '1. Data Collection',
      content: [
        'We collect personal information you provide when you create an account, use our services, or communicate with us. This may include your name, email address, phone number, profile details, and any content you share on Somalux.',
        'We also collect technical data such as device identifiers, browser information, IP address, and usage analytics to improve the service and keep the platform secure.',
        'Some information is collected automatically when you browse the platform, including pages viewed, searches, interaction history, approximate location, language, device type, operating system, and diagnostic information.',
      ],
    },
    {
      title: '2. Use of Information',
      content: [
        'We use personal information to provide and maintain your account, save your library preferences, record reading progress, manage bookmarks and highlights, support downloads, and send relevant notifications. We may also use data for research, product improvements, fraud prevention, and legal compliance.',
        'We use account and activity information to personalize your experience, remember preferences, maintain reading history, support book discussions, past-paper access, audio reading features, and provide customer support.',
        'Where required, we ask for your consent before using information for optional communications or purposes that are not necessary to provide the service.',
      ],
    },
    {
      title: '3. Sharing and Disclosure',
      content: [
        'Somalux does not sell your personal data. We may share information with service providers, payment processors, and partners to operate the service, deliver support, or comply with legal obligations.',
        'We may also disclose information if required by law, to protect rights and safety, or to enforce our terms and policies.',
        'When information is shared with a service provider, we require that provider to use it only for the agreed service and to apply appropriate security and confidentiality controls.',
      ],
    },
    {
      title: '4. Your Rights',
      content: [
        'You may have rights to access, correct, delete, or restrict processing of your data under applicable law. Contact us for requests related to your personal information.',
        'You may also request a copy of information associated with your account, object to certain processing, withdraw optional consent, or ask us to explain how a decision involving your information was made.',
        'We may need to verify your identity before completing a request. We will respond within the period required by applicable law and explain any lawful reason we cannot fulfill a request.',
      ],
    },
    {
      title: '5. Data Retention',
      content: [
        'We retain your information as long as necessary to provide the service, comply with legal obligations, resolve disputes, and enforce our policies.',
        'When information is no longer needed, we delete it, anonymize it, or securely isolate it where deletion is not immediately possible because of legal, security, or operational requirements.',
      ],
    },
    {
      title: '6. Security',
      content: [
        'We use commercially reasonable safeguards to protect your information, but no system is completely secure. You should protect your account credentials and report suspicious activity promptly.',
        'Security measures may include access controls, encrypted connections, authentication protections, monitoring, backups, and limited staff access based on work responsibilities.',
        'If we identify a breach that legally requires notification, we will provide affected users with information about the incident and recommended protective steps where permitted and appropriate.',
      ],
    },
    {
      title: '7. Contact',
      content: [
        'If you have privacy questions or requests, please contact Somalux support through the app or website. Include enough detail for us to understand your request, but do not send passwords, authentication codes, or other sensitive credentials.',
      ],
    },
    {
      title: '8. Cookies and Local Storage',
      content: [
        'Somalux may use cookies, local storage, and similar technologies to keep you signed in, remember preferences, improve performance, protect sessions, and understand how the service is used.',
        'You can control cookies through your browser or device settings. Disabling essential storage may prevent parts of Somalux from working correctly.',
      ],
    },
    {
      title: '9. Third-Party Services',
      content: [
        'Somalux may rely on trusted third-party services for authentication, hosting, analytics, payments, communications, file storage, and security. Those services may process information under their own privacy policies.',
        'We do not control the privacy practices of external websites or services linked from Somalux. Review their policies before providing information or using those services.',
      ],
    },
    {
      title: '10. Children’s Privacy',
      content: [
        'Somalux is not intended for children who are not legally permitted to use the service. We do not knowingly collect personal information from children in violation of applicable law.',
        'If you believe a child has provided personal information, contact support so we can investigate and remove it where appropriate.',
      ],
    },
    {
      title: '11. Policy Changes',
      content: [
        'We may update this Privacy Policy when our services, legal obligations, or data practices change. The updated version will be posted with a new revision date.',
        'If a change materially affects your rights or how we use information, we will provide additional notice where required by law.',
      ],
    },
  ];

  return (
    <div className="settings-privacy-policy-page" style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', overflowY: 'auto' }}>
      <div className="settings-stp-page-header fullpage" style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-muted)' }}>
        <button className="settings-stp-back-btn" onClick={() => (onBack ? onBack() : navigate(-1))} style={{ marginRight: 12 }}>
          <FiChevronLeft />
          <span style={{ marginLeft: 8 }}>Back</span>
        </button>
        <h1 className="settings-stp-page-title" style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', textAlign: 'center' }}>Privacy Policy</h1>
        <div className="settings-stp-header-spacer" />
      </div>
      <div style={{ padding: 16, paddingTop: 12, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div className="agreement-text" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
          <h3>Somalux Privacy Policy</h3>
          <p><strong>Last updated:</strong> September 3, 2026</p>
          {privacySections.map((section) => (
            <details key={section.title} style={{ marginBottom: 6, border: 'none', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>
                {section.title}
              </summary>
              <div style={{ marginTop: 12 }}>
                {section.content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
