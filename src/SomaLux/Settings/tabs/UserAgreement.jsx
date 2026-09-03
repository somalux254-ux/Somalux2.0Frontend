import React, { useState, useEffect } from 'react';
import { FiChevronLeft } from 'react-icons/fi';

const AGREEMENT_TS_KEY = 'joblinkAgreementAcceptedAt';

export const AgreementTab = ({ onBack, initialSection, pageTitle = 'User Agreement' }) => {
  const isFullPage = typeof onBack === 'function';
  const [isExpanded, setIsExpanded] = useState(true);
  const [openSectionId, setOpenSectionId] = useState('introduction');
  const [acceptedAt] = useState(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(AGREEMENT_TS_KEY);
  });

  const scrollToSection = (sectionId) => {
    if (typeof window === 'undefined') return;
    setOpenSectionId(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (initialSection) {
      scrollToSection(initialSection);
    }
  }, [initialSection]);

  const handleToggleSection = (sectionId) => {
    setOpenSectionId((prev) => (prev === sectionId ? null : sectionId));
  };

  const isAccepted = Boolean(acceptedAt);
  const acceptedLabel = isAccepted ? `Accepted on ${new Date(acceptedAt).toLocaleString()}` : null;

  // Render full-screen, edge-to-edge overlay when used as full page
  if (isFullPage) {
    return (
      <div className="settings-user-agreement-page" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', maxWidth: '100%', background: 'var(--bg-primary)', zIndex: 1200, display: 'flex', flexDirection: 'column', margin: 0, padding: 0, color: 'var(--text-primary)', overflowX: 'hidden' }}>
        <div className="settings-stp-page-header fullpage" style={{ background: 'var(--bg-primary)' }}>
          <button className="settings-stp-back-btn" onClick={onBack} style={{ marginRight: 12 }}>
            <FiChevronLeft />
            <span style={{ marginLeft: 8 }}>Back</span>
          </button>
          <h1 className="settings-stp-page-title" style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', textAlign: 'center' }}>User Agreement</h1>
          <div className="settings-stp-header-spacer" />
        </div>
        <div style={{ overflowY: 'auto', overflowX: 'hidden', padding: 16, paddingTop: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box', paddingBottom: 'max(8px, env(safe-area-inset-bottom))', background: 'var(--bg-primary)' }}>
          <div className="agreement-text" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
            <h3>{pageTitle === 'Privacy Policy' ? 'Somalux Privacy Policy' : 'Somalux Terms of Use'}</h3>
            <p><strong>Last updated:</strong> September 3, 2026</p>

            <section style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <button type="button" id="introduction" onClick={(e) => { e.stopPropagation(); handleToggleSection('introduction'); }} aria-expanded={openSectionId === 'introduction'} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, margin: 0, padding: 0, background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none' }}>
                Introduction
              </button>
              {openSectionId === 'introduction' && (
                <div style={{ marginTop: 12 }}>
                  <p>
                    Welcome to Somalux. This Somalux Terms of Use ("Agreement") is a binding legal agreement between you and Excellent Innovation Limited ("Somalux", "we", "us", or "our") governing your access to and use of Somalux's products, services, and software.
                  </p>
                  <p>
                    By using Somalux, you confirm that you have read, understood, and accepted this Agreement. If you do not agree, do not use Somalux.
                  </p>
                </div>
              )}
            </section>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="definitions" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>1. Definitions and Scope</summary>
              <p>
                <strong>1.1</strong> "Service" means the Somalux platform and all related functionality, including the mobile application, website, APIs, software, tools, and services.
              </p>
            <p>
              <strong>1.2</strong> "User" means any individual or entity that accesses or uses the Service.
            </p>
            <p>
              <strong>1.3</strong> "User Content" means all materials submitted by a User, including resumes, job postings, messages, applications, profiles, images, videos, and documents.
            </p>
            <p>
              <strong>1.4</strong> "Employer" means any User posting roles, reviewing candidates, or using Somalux’s hiring or recruitment features.
            </p>
            <p>
              <strong>1.5</strong> "Job Seeker" means any User seeking employment, freelance work, contract opportunities, or professional networking.
            </p>
            <p>
              <strong>1.6</strong> "Recruiter" means any User or third party offering sourcing, referral, or placement services through the Service.
            </p>
            <p>
              <strong>1.7</strong> "Applicable Law" means all laws, rules, and regulations applicable to your use of the Service.
            </p>
            <p>
              <strong>1.8</strong> This Agreement governs all access to and use of the Service, including any updates, upgrades, enhancements, and new features.
            </p>
            <p>
              <strong>1.9</strong> Somalux may change this Agreement at any time. If we make material changes, we will notify you through the app, email, or other available communication channels.
            </p>

            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="acceptance" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>2. Acceptance and Eligibility</summary>
              <p>
                <strong>2.1</strong> By clicking "Agree" or by using Somalux, you accept this Agreement and agree to comply with it.
              </p>
            <p>
              <strong>2.2</strong> You must be legally capable of entering into a binding contract in your jurisdiction. If you use the Service on behalf of an organization, you warrant that you have authority to bind that organization.
            </p>
            <p>
              <strong>2.3</strong> Minors may use Somalux only with parental or guardian consent and only where permitted by law.
            </p>
            <p>
              <strong>2.4</strong> Somalux may refuse access or suspend accounts that are ineligible, provide false information, or violate this Agreement.
            </p>

            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="accounts" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>3. Account Creation, Access, and Security</summary>
              <p>
                <strong>3.1</strong> Provide accurate, complete, and up-to-date information when creating and maintaining your account.
              </p>
            <p>
              <strong>3.2</strong> You are responsible for all activity under your account, whether authorized by you or not.
            </p>
            <p>
              <strong>3.3</strong> Protect your account credentials and do not share your password or multi-factor authentication methods.
            </p>
            <p>
              <strong>3.4</strong> Notify Somalux immediately if you suspect unauthorized access, loss, or theft of your credentials.
            </p>
            <p>
              <strong>3.5</strong> Somalux may suspend, disable, or terminate accounts that use false information, violate this Agreement, or appear compromised.
            </p>

            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="conduct" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>4. User Roles and Conduct</summary>
              <p>
                <strong>4.1</strong> Somalux supports multiple User roles, including Job Seekers, Employers, Recruiters, and Service Providers. You must use the Service in accordance with the role you have selected.
              </p>
            <p>
              <strong>4.2</strong> You agree not to use Somalux for abusive, discriminatory, harassing, fraudulent, or unlawful conduct.
            </p>
            <p>
              <strong>4.3</strong> You may not impersonate another person, provide false credentials, or misrepresent your relationship with any party.
            </p>
            <p>
              <strong>4.4</strong> You are responsible for observing recruitment, tax, labor, and data privacy laws applicable to your activities on Somalux.
            </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="content" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>5. User Content and Intellectual Property</summary>
              <p>
                <strong>5.1</strong> You retain ownership of your User Content. By submitting User Content, you grant Somalux a worldwide, royalty-free, non-exclusive, sublicensable license to use, reproduce, modify, distribute, and display it as necessary to provide the Service.
              </p>
              <p>
                <strong>5.2</strong> You warrant that your User Content is true, accurate, and does not infringe any third-party rights.
              </p>
              <p>
                <strong>5.3</strong> Somalux may remove, reject, or edit User Content that violates this Agreement, is unlawful, or poses a risk to the Service.
              </p>
              <p>
                <strong>5.4</strong> Somalux and its licensors retain all rights, title, and interest in the Service and its original content, including trademarks, software, designs, and documentation.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="prohibited" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>6. Prohibited Content and Actions</summary>
              <p>
                <strong>6.1</strong> You may not use the Service to:
              </p>
              <ul>
                <li><strong>6.1.1</strong> post content that is defamatory, obscene, abusive, discriminatory, misleading, or unlawful;</li>
                <li><strong>6.1.2</strong> impersonate another person, entity, or organization;</li>
                <li><strong>6.1.3</strong> collect or store personal information from other Users without their consent;</li>
                <li><strong>6.1.4</strong> interfere with the Service, introduce malware, or disrupt Somalux systems;</li>
                <li><strong>6.1.5</strong> use bots, scrapers, or other automated methods to access or extract data from Somalux without permission;</li>
                <li><strong>6.1.6</strong> reverse engineer, decompile, or attempt to derive source code or algorithms from Somalux;</li>
                <li><strong>6.1.7</strong> violate any applicable law, regulation, or Somalux policy.</li>
              </ul>
              <p>
                <strong>6.2</strong> You may not remove or obscure copyright, trademark, or proprietary notices from any portion of the Service.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="service" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>7. Service Description and User Relationship</summary>
              <p>
                <strong>7.1</strong> Somalux is a platform that facilitates connections between job seekers, employers, recruiters, and service providers.
              </p>
              <p>
                <strong>7.2</strong> Somalux is not an employer, staffing agency, or agent. Somalux does not hire or employ any User and is not responsible for employment decisions, compensation, or contractual arrangements.
              </p>
              <p>
                <strong>7.3</strong> Somalux does not guarantee any particular outcome, including interviews, offers, hires, or payments.
              </p>
              <p>
                <strong>7.4</strong> Any relationship, hiring decision, contract, or payment arrangement is solely between the relevant Users.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="payments" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>8. Fees, Payments, and Refunds</summary>
              <p>
                <strong>8.1</strong> Certain features, subscriptions, or premium services may require payment. Fees will be presented clearly before purchase.
              </p>
              <p>
                <strong>8.2</strong> Payments are processed by third-party providers and are subject to their terms and policies.
              </p>
              <p>
                <strong>8.3</strong> Unless otherwise required by applicable law, fees are non-refundable. Refunds are handled according to Somalux’s refund policy.
              </p>
              <p>
                <strong>8.4</strong> You are responsible for any taxes, duties, or charges incurred in connection with your payments.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="trial" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>9. Trial Offers and Promotions</summary>
              <p>
                <strong>9.1</strong> Promotional offers, free trials, and introductory subscriptions are subject to specific terms and may require cancellation before renewal.
              </p>
              <p>
                <strong>9.2</strong> Somalux may modify or terminate promotional offers at any time.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="thirdparty" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>10. Third-Party Services and Integrations</summary>
              <p>
                <strong>10.1</strong> Somalux may integrate with third-party tools, services, and content, including payment processors, analytics providers, and verification services.
              </p>
              <p>
                <strong>10.2</strong> Third-party services are governed by their own terms and privacy practices. Somalux is not responsible for their performance or content.
              </p>
              <p>
                <strong>10.3</strong> Any transaction or relationship with a third party is between you and that third party.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="privacy" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>11. Privacy and Data Rights</summary>
              <p>
                <strong>11.1</strong> Somalux’s Privacy Policy explains how we collect, use, disclose, and retain personal data. It is incorporated into this Agreement.
              </p>
              <p>
                <strong>11.2</strong> We may use aggregated, anonymized, or pseudonymized data to improve the Service and for research.
              </p>
              <p>
                <strong>11.3</strong> You may have rights to access, correct, delete, or restrict processing of your personal information under applicable law.
              </p>
              <p>
                <strong>11.4</strong> Somalux may retain data as required by law, dispute resolution, or to protect our rights and the rights of others.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="permissions" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>12. Device Permissions and Communications</summary>
              <p>
                <strong>12.1</strong> Somalux may request permission to access device features such as camera, microphone, contacts, storage, and location.
              </p>
              <p>
                <strong>12.2</strong> Granting permissions is optional, but declining optional permissions may reduce functionality.
              </p>
              <p>
                <strong>12.3</strong> Somalux may send service messages, account updates, and alerts. You may manage marketing preferences where available.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="security" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>13. Security and Confidentiality</summary>
              <p>
                <strong>13.1</strong> Somalux employs commercially reasonable security measures, but cannot guarantee absolute protection.
              </p>
              <p>
                <strong>13.2</strong> You must protect your account credentials and not disclose confidential information belonging to other Users.
              </p>
              <p>
                <strong>13.3</strong> Report security incidents or suspicious activity to Somalux promptly.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="analytics" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>14. Analytics, Monitoring, and Logging</summary>
              <p>
                <strong>14.1</strong> Somalux may collect usage, performance, and diagnostic data to operate and improve the Service.
              </p>
              <p>
                <strong>14.2</strong> We may monitor activity to detect abuse, violations, fraud, or security incidents.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="availability" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>15. Availability and Service Changes</summary>
              <p>
                <strong>15.1</strong> Somalux may update, suspend, or discontinue the Service, or any feature, at any time without liability.
              </p>
              <p>
                <strong>15.2</strong> Somalux is not responsible for outages, delays, or degradation caused by third parties, infrastructure failure, or events outside our control.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="beta" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>16. Beta Programs and Feedback</summary>
              <p>
                <strong>16.1</strong> Somalux may offer beta features or early access programs. These features may be incomplete and are provided at Somalux’s discretion.
              </p>
              <p>
                <strong>16.2</strong> Feedback you provide may be used by Somalux without compensation.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="compliance" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>17. Compliance and Export Control</summary>
              <p>
                <strong>17.1</strong> You agree to comply with all export, sanctions, trade control, privacy, and anti-money laundering laws.
              </p>
              <p>
                <strong>17.2</strong> Do not use Somalux from prohibited jurisdictions or for purposes that violate trade restrictions.
              </p>
              <p>
                <strong>17.3</strong> You are responsible for any tax or statutory obligations arising from your use of the Service.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="fraud" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>18. Fraud Prevention and Suspicious Activity</summary>
              <p>
                Somalux may investigate suspicious activity, block fraudulent accounts, and cooperate with law enforcement where required.
              </p>
              <p>
                You must not engage in identity theft, false representation, or any conduct intended to deceive others.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="termination" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>19. Termination and Suspension</summary>
              <p>
                <strong>19.1</strong> Somalux may suspend or terminate your access if you breach this Agreement, violate policies, or create risks for the Service.
              </p>
              <p>
                <strong>19.2</strong> Upon termination, Somalux may delete or restrict access to your account and User Content in accordance with data retention policies.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="warranties" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>20. Warranty Disclaimers</summary>
              <p>
                <strong>20.1</strong> The Service is provided "as is" and "as available." Somalux disclaims all warranties, express or implied, including merchantability and fitness for a particular purpose.
              </p>
              <p>
                <strong>20.2</strong> Somalux does not warrant that the Service will be uninterrupted, secure, or error-free.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="liability" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>21. Limitation of Liability</summary>
              <p>
                <strong>21.1</strong> To the fullest extent permitted by law, Somalux is not liable for indirect, incidental, special, punitive, or consequential damages.
              </p>
              <p>
                <strong>21.2</strong> Somalux’s aggregate liability for any claim arising from the Service is limited to the amount you paid to Somalux in the prior twelve months, or one hundred dollars (USD 100), whichever is less.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="indemnity" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>22. Indemnification</summary>
              <p>
                You agree to indemnify and hold Somalux harmless from claims, losses, liabilities, damages, and expenses arising from your use of the Service, User Content, or breach of this Agreement.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="disputes" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>23. Dispute Resolution</summary>
              <p>
                <strong>23.1</strong> This Agreement is governed by the laws applicable to Excellent Innovation Limited.
              </p>
              <p>
                <strong>23.2</strong> You and Somalux agree to resolve disputes through the dispute resolution process identified by Somalux or as required by law.
              </p>
              <p>
                <strong>23.3</strong> If legal action is necessary, it shall be brought in the applicable court specified by Somalux, except where prohibited by law.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="notices" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>24. Notices</summary>
              <p>
                <strong>24.1</strong> Somalux may provide notices by email, push notification, or in-app message. You agree that electronic communications satisfy any legal notice requirement.
              </p>
              <p>
                <strong>24.2</strong> Keep your contact information current to receive important notices.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="severability" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>25. Severability</summary>
              <p>
                If any provision of this Agreement is held invalid or unenforceable, the remaining provisions will remain in full force and effect.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="entire" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>26. Entire Agreement</summary>
              <p>
                This Agreement constitutes the entire agreement between you and Somalux regarding the Service, superseding prior agreements.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="assignment" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>27. Assignment</summary>
              <p>
                Somalux may assign this Agreement to affiliates or successors without notice, provided the assignee agrees to bound by these terms.
              </p>
            </details>
            <details style={{ marginBottom: 6, border: '1px solid var(--border-muted)', borderRadius: 12, padding: 10, background: 'var(--bg-surface)' }}>
              <summary onClick={(e) => e.stopPropagation()} id="contact" style={{ cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>28. Contact Information</summary>
              <p>
                For questions, support, or data rights requests, use Somalux’s Help or Feedback features or contact our support channels listed in the app.
              </p>
            </details>

            {acceptedLabel && <p style={{ margin: 0, marginTop: 6, color: 'var(--text-secondary)', textAlign: 'center' }}>{acceptedLabel}</p>}
          </div>
        </div>
      </div>
    );
  }

  // Default (inline) rendering when not full page
  return (
    <div className="settings-stp-page-section">
      <div className="section-header" style={{ cursor: 'default' }}>
        <div>
          <h2 className="settings-stp-page-section-title">User Agreement</h2>
          <p className="settings-stp-page-section-description">
            {isFullPage ? 'Last updated: September 3, 2026' : (isExpanded ? 'Click Collapse to hide' : 'Last updated: September 3, 2026 — Use the button below to read the full agreement')}
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
              {isExpanded ? 'Collapse' : 'Read full agreement'}
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div
          className={isFullPage ? 'settings-agreement-fullpage' : 'settings-agreement-content'}
          style={isFullPage ? { height: 'calc(100vh - 140px)', overflowY: 'auto', padding: '16px' } : { maxHeight: '60vh', overflowY: 'auto', padding: '16px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="agreement-text" style={{}}>
            <h3>Somalux Terms Summary</h3>
            <p><strong>Last updated:</strong> September 3, 2026</p>
            <p>This summary highlights the key obligations for using Somalux. The full agreement above offers complete details for account security, content rules, privacy, fees, third-party services, and legal protections.</p>
            <p><strong>Key points:</strong></p>
            <ul>
              <li>Your Somalux account is personal and you are responsible for all activity under it.</li>
              <li>Somalux is a platform connecting users; it does not guarantee employment or hiring outcomes.</li>
              <li>You must submit accurate, lawful user content and comply with Somalux’s conduct rules.</li>
              <li>Paid features and third-party integrations are governed by separate terms and disclosures.</li>
              <li>Using Somalux means you accept privacy, intellectual property, and limitation of liability terms.</li>
            </ul>

            {acceptedLabel && <p style={{ margin: 0, marginTop: 6, color: 'var(--text-secondary)', textAlign: 'center' }}>{acceptedLabel}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

