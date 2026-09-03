import React, { useState } from 'react';
import './HelpTab.css';

export const HelpTab = ({ onViewFaq }) => {
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactFormData, setContactFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleContactFormChange = (e) => {
    const { name, value } = e.target;
    setContactFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmitContactForm = (e) => {
    e.preventDefault();
    console.log('Contact form submitted:', contactFormData);
    setFormSubmitted(true);
    
    // Reset form after 3 seconds
    setTimeout(() => {
      setContactFormData({ name: '', email: '', subject: '', message: '' });
      setFormSubmitted(false);
      setShowContactForm(false);
    }, 3000);
  };

  const handleOpenLink = (url) => {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.warn('Could not open link:', e);
    }
  };

  if (showContactForm) {
    return (
      <div className="settings-stp-page-section help-page-section">
        <div className="section-header">
          <div>
            <h2 className="settings-stp-page-section-title">Contact Support</h2>
            <p className="settings-stp-page-section-description">Send us your message</p>
          </div>
        </div>

        <form className="settings-stp-options-group help-page-contact-form" onSubmit={handleSubmitContactForm}>
          {formSubmitted ? (
            <div className="help-page-success-message">
              <p className="help-page-success-title">✓ Message Sent!</p>
              <p className="help-page-success-text">Thank you for contacting us. We'll get back to you soon.</p>
            </div>
          ) : (
            <>
              <div className="help-page-form-group">
                <label className="help-page-form-label">Name</label>
                <input
                  type="text"
                  name="name"
                  value={contactFormData.name}
                  onChange={handleContactFormChange}
                  placeholder="Your name"
                  required
                  className="help-page-form-input"
                />
              </div>

              <div className="help-page-form-group">
                <label className="help-page-form-label">Email</label>
                <input
                  type="email"
                  name="email"
                  value={contactFormData.email}
                  onChange={handleContactFormChange}
                  placeholder="your@email.com"
                  required
                  className="help-page-form-input"
                />
              </div>

              <div className="help-page-form-group">
                <label className="help-page-form-label">Subject</label>
                <input
                  type="text"
                  name="subject"
                  value={contactFormData.subject}
                  onChange={handleContactFormChange}
                  placeholder="What is this about?"
                  required
                  className="help-page-form-input"
                />
              </div>

              <div className="help-page-form-group">
                <label className="help-page-form-label">Message</label>
                <textarea
                  name="message"
                  value={contactFormData.message}
                  onChange={handleContactFormChange}
                  placeholder="Please describe your issue in detail..."
                  required
                  rows={5}
                  className="help-page-form-textarea"
                />
              </div>

              <button
                type="submit"
                className="help-page-form-button"
                disabled={formSubmitted}
              >
                {formSubmitted ? 'Sending...' : 'Send Message'}
              </button>

              <button
                type="button"
                onClick={() => setShowContactForm(false)}
                className="help-page-form-back-button"
              >
                Back to Help
              </button>
            </>
          )}
        </form>
      </div>
    );
  }


  return (
    <div className="settings-stp-page-section help-page-section">
      <div className="section-header">
        <div>
          <h2 className="settings-stp-page-section-title">Help & Support</h2>
          <p className="settings-stp-page-section-description">Get assistance and answers to your questions</p>
        </div>
      </div>

      <div className="settings-stp-options-group help-page-options-group">
        <div className="help-page-option-row">
          <div className="help-page-option-info">
            <label className="option-label">Frequently Asked Questions</label>
            <p className="option-description">Browse our FAQ section with answers to common questions about using Joblink</p>
          </div>
          <button
            onClick={() => typeof onViewFaq === 'function' && onViewFaq()}
            className="help-page-action-button"
          >
            <span className="help-page-button-word-first">View</span><span className="help-page-button-word">FAQ</span>
          </button>
        </div>

        <div className="help-page-option-row">
          <div className="help-page-option-info">
            <label className="option-label">Contact Support</label>
            <p className="option-description">Get in touch with our support team for personalized assistance and issue resolution</p>
          </div>
          <button
            onClick={() => setShowContactForm(true)}
            className="help-page-action-button"
          >
            <span className="help-page-button-word-first">Email</span><span className="help-page-button-word">Support</span>
          </button>
        </div>

        <div className="help-page-option-row">
          <div className="help-page-option-info">
            <label className="option-label">Documentation</label>
            <p className="option-description">Access comprehensive guides, tutorials, and documentation about all Joblink features</p>
          </div>
          <button
            onClick={() => handleOpenLink('https://joblink.io/docs')}
            className="help-page-action-button"
          >
            <span className="help-page-button-word-first">Read</span><span className="help-page-button-word">Docs</span>
          </button>
        </div>

        <div className="help-page-option-row">
          <div className="help-page-option-info">
            <label className="option-label">Community Forum</label>
            <p className="option-description">Join our active community, share experiences, and get help from other Joblink users</p>
          </div>
          <button
            onClick={() => handleOpenLink('https://community.joblink.io')}
            className="help-page-action-button"
          >
            <span className="help-page-button-word-first">Visit</span><span className="help-page-button-word">Forum</span>
          </button>
        </div>

        <div className="help-page-option-row">
          <div className="help-page-option-info">
            <label className="option-label">System Status</label>
            <p className="option-description">Check the status of Joblink services and view any ongoing maintenance or incidents</p>
          </div>
          <button
            onClick={() => handleOpenLink('https://status.joblink.io')}
            className="help-page-action-button"
          >
            <span className="help-page-button-word-first">View</span><span className="help-page-button-word">Status</span>
          </button>
        </div>
      </div>
    </div>
  );
};
