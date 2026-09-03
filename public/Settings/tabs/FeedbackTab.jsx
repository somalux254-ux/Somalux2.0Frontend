import { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { pushBackAction, popBackAction } from '../../services/backNavigation';
import './FeedbackTab.css';

const feedbackGroups = [
  {
    title: 'Core Experience',
    items: [
      { value: 'home', label: 'Home Feed & Discovery' },
      { value: 'search', label: 'Search' },
      { value: 'job_details', label: 'Job Details & Listings' },
      { value: 'applications', label: 'Applications' },
      { value: 'profile', label: 'User Profile' },
      { value: 'recommendations', label: 'Job Recommendations & Matching' },
      { value: 'matching', label: 'Matching Algorithm / Relevance' },
      { value: 'filters', label: 'Search Filters & Facets' },
      { value: 'sorting', label: 'Sort Options' },
      { value: 'trending', label: 'Trending / Suggested Jobs' },
      { value: 'map_view', label: 'Map / Location View' },
      { value: 'category_navigation', label: 'Category Navigation' },
    ]
  },
  {
    title: 'Communication & Scheduling',
    items: [
      { value: 'messaging', label: 'Messaging & Communication' },
      { value: 'calendar', label: 'Interview Calendar & Scheduling' },
      { value: 'interviews', label: 'Interview Experience' },
      { value: 'alerts', label: 'Alerts & Notifications Settings' },
      { value: 'reminders', label: 'Interview Reminders' },
      { value: 'rescheduling', label: 'Rescheduling Flow' },
      { value: 'video_calls', label: 'In-app Video / Calls' },
      { value: 'sms_notifications', label: 'SMS / Push Reliability' },
    ]
  },
  {
    title: 'Account & Payments',
    items: [
      { value: 'subscription', label: 'Subscription & Premium' },
      { value: 'payments', label: 'Payments & Billing' },
      { value: 'payments_disputes', label: 'Payments Disputes & Refunds' },
      { value: 'referrals', label: 'Referrals & Invite Flow' },
      { value: 'invoices', label: 'Invoices & Receipts' },
      { value: 'promo_codes', label: 'Promotions & Coupon Codes' },
      { value: 'subscription_cancel', label: 'Cancel / Downgrade Flow' },
    ]
  },
  {
    title: 'Content & Tools',
    items: [
      { value: 'resume', label: 'Resume Upload & Parsing' },
      { value: 'saved_jobs', label: 'Saved Jobs & Bookmarks' },
      { value: 'skill_assessments', label: 'Skill Assessments & Tests' },
      { value: 'certifications', label: 'Certifications & Badges' },
      { value: 'editor_tools', label: 'Profile / Editor Tools' },
      { value: 'file_uploads', label: 'Attachments & File Uploads' },
      { value: 'parsing_accuracy', label: 'Parsing Accuracy' },
    ]
  },
  {
    title: 'Platform & Admin',
    items: [
      { value: 'settings', label: 'Settings & Preferences' },
      { value: 'security', label: 'Security' },
      { value: 'privacy', label: 'Privacy & Data' },
      { value: 'privacy_controls', label: 'Privacy Controls & Settings' },
      { value: 'analytics', label: 'Usage Analytics & Insights' },
      { value: 'admin_tools', label: 'Admin Tools & Dashboards' },
      { value: 'audit_logs', label: 'Audit Logs & Monitoring' },
      { value: 'roles_permissions', label: 'Roles & Permissions' },
    ]
  },
  {
    title: 'Integrations & Advanced',
    items: [
      { value: 'integrations', label: 'Third-party Integrations' },
      { value: 'export_import', label: 'Export / Import Data' },
      { value: 'beta', label: 'Beta Features / Experiments' },
      { value: 'feedback_ui', label: 'Feedback Form & UI' },
      { value: 'api', label: 'API Access & Documentation' },
      { value: 'webhooks', label: 'Webhooks & Callbacks' },
      { value: 'sso', label: 'Single Sign-On (SSO)' },
    ]
  },
  {
    title: 'Support & Other',
    items: [
      { value: 'support', label: 'Customer Support & Help' },
      { value: 'community', label: 'Community & Forums' },
      { value: 'accessibility', label: 'Accessibility' },
      { value: 'performance', label: 'Performance & Bugs' },
      { value: 'faq', label: 'FAQ & Documentation' },
      { value: 'report_abuse', label: 'Report Abuse / Safety' },
      { value: 'legal', label: 'Legal & Compliance' },
      { value: 'other', label: 'Other / General' },
    ]
  }
];

const findLabelByValue = (val) => {
  for (const group of feedbackGroups) {
    for (const item of group.items) {
      if (item.value === val) return item.label;
    }
  }
  return null;
};

export const FeedbackTab = ({ setHeaderTitle }) => {
  const [selectedArea, setSelectedArea] = useState('');
  const [feedback, setFeedback] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('');

  useEffect(() => {
    // If an area is selected, push a back action to reset it
    if (selectedArea) {
      const handleBackAction = () => {
        setSelectedArea('');
      };
      pushBackAction(handleBackAction);
      return () => popBackAction(handleBackAction);
    }
  }, [selectedArea]);

  useEffect(() => {
    // If a group is selected (but no area yet), push a back action to go back to groups
    if (selectedGroup && !selectedArea) {
      const handleBackGroup = () => setSelectedGroup('');
      pushBackAction(handleBackGroup);
      return () => popBackAction(handleBackGroup);
    }
  }, [selectedGroup, selectedArea]);

  useEffect(() => {
    if (typeof setHeaderTitle === 'function') {
      let label = null;
      if (selectedArea) {
        // Show the selected area in the header parentheses (e.g. "Feedback (Search)")
        const areaLabel = findLabelByValue(selectedArea) || selectedArea;
        label = `Feedback (${areaLabel})`;
      } else if (selectedGroup) {
        label = `Feedback (${selectedGroup})`;
      }
      setHeaderTitle(label);
    }
    return () => {
      if (typeof setHeaderTitle === 'function') setHeaderTitle(null);
    };
  }, [selectedArea, selectedGroup, setHeaderTitle]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatusMessage('');
    setErrorMessage('');

    if (!selectedArea) {
      setErrorMessage('Please select a feedback area.');
      return;
    }

    if (!feedback.trim()) {
      setErrorMessage('Please enter your feedback before sending.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          area: selectedArea,
          message: feedback.trim(),
          page: 'settings/feedback'
        })
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Unable to send feedback.');
      }

      setStatusMessage(result.message || 'Feedback sent successfully!');
      setFeedback('');
      setSelectedArea('');
    } catch (error) {
      console.error('Feedback submit failed:', error);
      setErrorMessage(error.message || 'Failed to send feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="settings-stp-page-section">
      <div className="section-header">
        <div>
          <h2 className="settings-stp-page-section-title">Share Your Feedback</h2>
          <p className="settings-stp-page-section-description">Help us improve by telling us what you think</p>
        </div>
      </div>

      <form className="settings-stp-options-group" onSubmit={handleSubmit}>
        {!selectedArea && (
          <div className="feedback-area-section">
            {/* If no group selected, show only group headers */}
            {!selectedGroup ? (
                <div className="group-selection-list">
                  {feedbackGroups.map((group) => (
                    <label key={group.title} className="feedback-radio-label group-radio-label">
                      <input
                        type="radio"
                        name="feedback-group"
                        value={group.title}
                        checked={selectedGroup === group.title}
                        onChange={() => setSelectedGroup(group.title)}
                        className="feedback-radio-input"
                      />
                      <span className="feedback-radio-text">{group.title}</span>
                    </label>
                  ))}
                </div>
            ) : (
              <div className="feedback-radio-group">
                <div className="feedback-group">
                  <div className="feedback-group-list">
                    {feedbackGroups.find(g => g.title === selectedGroup)?.items.map((area) => (
                      <label key={area.value} className="feedback-radio-label">
                        <input
                          type="radio"
                          name="feedback-area"
                          value={area.value}
                          checked={selectedArea === area.value}
                          onChange={(e) => setSelectedArea(e.target.value)}
                          className="feedback-radio-input"
                        />
                        <span className="feedback-radio-text">{area.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {selectedArea && (
          <div className="feedback-form-section">
            <textarea
              className="feedback-textarea"
              placeholder="Tell us what you think..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />

            {statusMessage && <p className="feedback-status-message" style={{ color: '#0f9d58', marginTop: 8 }}>{statusMessage}</p>}
            {errorMessage && <p className="feedback-error-message" style={{ color: '#d23f31', marginTop: 8 }}>{errorMessage}</p>}

            <button
              type="submit"
              className="settings-stp-page-select feedback-submit"
              style={{ marginTop: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer', background: 'rgba(0, 217, 255, 0.1)', border: '1px solid rgba(0, 217, 255, 0.2)', color: '#00d9ff' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Submit'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
