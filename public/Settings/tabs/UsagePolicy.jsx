import React, { useState } from 'react';
import { FiChevronLeft } from 'react-icons/fi';

const usageSections = [
  {
    id: 'code-of-conduct',
    label: '1. Code of Conduct',
    content: [
      'Treat every Joblink user with respect, courtesy, and professionalism, whether you are posting a role, responding to an application, or sending a message.',
      'Do not harass, abuse, intimidate, threaten, or discriminate against any user on the basis of race, gender, religion, disability, nationality, age, sexual orientation, or any other protected characteristic.',
      'Use language that is clear and constructive, avoid personal attacks, and maintain a positive and professional tone during all interactions.',
    ],
  },
  {
    id: 'prohibited-activities',
    label: '2. Prohibited Activities',
    content: [
      'Do not post illegal, fraudulent, deceptive, or misleading content, including scams, phishing schemes, fake job listings, or misrepresented services.',
      'Do not use Joblink to solicit payment outside the platform, collect personal financial information without consent, or direct users to unsafe third-party sites.',
      'Do not impersonate any person, company, or organization, and do not create multiple profiles to manipulate search results, reviews, or user trust.',
    ],
  },
  {
    id: 'posting-guidelines',
    label: '3. Posting Guidelines',
    content: [
      'Create honest, complete, and accurate job posts with clear titles, correct location details, and precise descriptions of deliverables, compensation, and required qualifications.',
      'Avoid duplicate listings, irrelevant content, or excessive use of hashtags and promotional language that may confuse or mislead applicants.',
      'Do not include discriminatory requirements, misrepresent compensation, or promise unrealistic outcomes, and always disclose whether a role is full-time, part-time, contract, or freelance.',
    ],
  },
  {
    id: 'communication-standards',
    label: '4. Communication Standards',
    content: [
      'Respond to messages and applications in a timely, respectful manner. If you are unable to continue a conversation, close it politely with a clear explanation.',
      'Keep communication focused on the opportunity, avoid excessive follow-ups, and do not share unsolicited marketing messages with other members.',
      'Respect privacy by not sharing contact details, financial information, or personal data without explicit consent and by using Joblink messaging when required.',
    ],
  },
  {
    id: 'privacy-data',
    label: '5. Privacy and Data Usage',
    content: [
      'Only collect and use candidate or employer data for the purpose of evaluating and fulfilling a job opportunity; do not store or repurpose information beyond what is necessary.',
      'Do not share or publish private user data, resumes, messages, or personal contact details without consent, and comply with applicable privacy laws and regulations.',
      'Respect Joblink privacy settings and profile preferences; do not attempt to bypass restrictions or extract information that has not been shared publicly.',
    ],
  },
  {
    id: 'security-suspension',
    label: '6. Security and Account Safety',
    content: [
      'Protect your login credentials and never share your password, authentication tokens, or device access with anyone, even if the request appears to come from Joblink.',
      'Report suspicious account activity, unauthorized access, or security incidents immediately through Joblink support channels.',
      'Joblink may suspend or terminate accounts that engage in account sharing, fraud, unauthorized access, or any activity that puts the platform or users at risk.',
    ],
  },
  {
    id: 'verification-authenticity',
    label: '7. Verification and Authenticity',
    content: [
      'Use real names, job titles, and accurate company information in your profile and listings. Do not use fake identities, aliases, or misleading credentials.',
      'Verify all information before it is posted or shared, and promptly correct any errors that may affect user trust or the integrity of the platform.',
      'Do not claim certifications, awards, or endorsements that you do not have, and do not present unverifiable or false qualifications as fact.',
    ],
  },
  {
    id: 'reporting-enforcement',
    label: '8. Reporting and Enforcement',
    content: [
      "If you observe behavior that violates this Usage Policy, report it immediately through Joblink's reporting tools so the team can investigate and act.",
      'Joblink reviews all reports and may take actions including warnings, content removal, temporary suspension, or permanent account termination.',
      'Cooperating with investigations and providing truthful information helps Joblink maintain a safe, fair, and trusted community for everyone.',
    ],
  },
  {
    id: 'compliance-sanctions',
    label: '9. Compliance and Sanctions',
    content: [
      'You must comply with all applicable laws, regulations, and Joblink policies while using the platform, including labor rules, anti-discrimination requirements, and data protection obligations.',
      'Violations of this Usage Policy may result in warnings, restricted functionality, account suspension, or permanent removal from Joblink.',
      'Joblink reserves the right to investigate suspected abuse, cooperate with law enforcement, and take legal action if necessary to protect users and the platform.',
    ],
  },
  {
    id: 'support-appeals',
    label: '10. Support and Appeals',
    content: [
      'If you need help or believe an action was taken in error, contact Joblink support with clear evidence and a description of the issue.',
      'Joblink will provide dispute or appeal guidance where appropriate, but retains final authority over membership, content, and enforcement decisions.',
      'Use support channels courteously and provide complete information to help resolve your issue quickly and fairly.',
    ],
  },
];

export const UsagePolicy = ({ onBack }) => {
  const isFullPage = typeof onBack === 'function';
  const [isExpanded, setIsExpanded] = useState(true);

  const renderSection = (section) => (
    <details key={section.id} style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
      <summary onClick={(e) => e.stopPropagation()} id={section.id} style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>
        {section.label}
      </summary>
      <div style={{ marginTop: 12 }}>
        {section.content.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </div>
    </details>
  );

  if (isFullPage) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', maxWidth: '100%', background: 'var(--bg-primary)', zIndex: 1200, display: 'flex', flexDirection: 'column', margin: 0, padding: 0, color: 'var(--text-primary)', overflowX: 'hidden' }}>
        <div className="settings-stp-page-header fullpage" style={{ background: 'var(--bg-primary)' }}>
          <button className="settings-stp-back-btn" onClick={onBack} style={{ marginRight: 12 }}>
            <FiChevronLeft />
            <span style={{ marginLeft: 8 }}>Back</span>
          </button>
          <h1 className="settings-stp-page-title" style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', textAlign: 'center' }}>Usage Policy</h1>
          <div className="settings-stp-header-spacer" />
        </div>
        <div style={{ flex: 1, padding: 16, paddingTop: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box', background: 'var(--bg-primary)', overflowY: 'auto', overflowX: 'hidden' }}>
          <div className="agreement-text" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', minHeight: '100%', paddingBottom: 29 }}>
            <h3>Joblink Usage Policy</h3>
            <p><strong>Last updated:</strong> June 25, 2026</p>
            <p>This Usage Policy defines the behavior, content, and safety expectations for every person using Joblink. It is designed to protect users, preserve trust, and keep the platform professional and reliable.</p>
            <p>Read each section carefully. If you are unsure about the correct action, choose the safest, most transparent option and contact support when necessary.</p>
            <p><strong>How to use these rules:</strong></p>
            <ul>
              <li>Follow the principles of honesty, accuracy, and respect in your posts and conversations.</li>
              <li>Use the platform for legitimate hiring, job searching, and professional collaboration.</li>
              <li>Report any misconduct, suspicious activity, or rule violations promptly.</li>
            </ul>
            {usageSections.map(renderSection)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-stp-page-section" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="section-header" style={{ cursor: 'default' }}>
        <div>
          <h2 className="settings-stp-page-section-title">Usage Policy</h2>
          <p className="settings-stp-page-section-description">
            {isFullPage ? 'Last updated: June 25, 2026' : (isExpanded ? 'Click Collapse to hide' : 'Last updated: June 25, 2026 - Use the button below to read the full usage policy')}
          </p>
          {!isFullPage && (
            <button
              type="button"
              className="settings-stp-section-toggle-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              style={{ marginTop: 6 }}
            >
              {isExpanded ? 'Collapse' : 'Read full usage policy'}
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div
          className={isFullPage ? 'settings-agreement-fullpage' : 'settings-agreement-content'}
          style={isFullPage ? { padding: '16px' } : { padding: '16px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="agreement-text" style={{}}>
            <h3>Joblink Usage Policy Summary</h3>
            <p><strong>Last updated:</strong> June 25, 2026</p>
            <p>The Joblink Usage Policy helps ensure every member can search, apply, hire, and communicate in a trustworthy environment. This policy covers conduct, posting quality, privacy, security, and enforcement.</p>
            <p><strong>Key points:</strong></p>
            <ul>
              <li>Treat others with respect and avoid harassment or discrimination.</li>
              <li>Post accurate, complete, and legitimate job opportunities.</li>
              <li>Keep communication professional, relevant, and privacy-safe.</li>
              <li>Report misuse quickly and cooperate with investigations.</li>
              <li>Protect your account and follow Joblink's security policies.</li>
            </ul>
            <p><strong>Expanded rules:</strong></p>
            <ul>
              <li>Do not post scams, false offers, or requests for payment outside the platform.</li>
              <li>Use real identity and transparent company information.</li>
              <li>Respect Joblink's reporting and enforcement processes.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
