import './PremiumProPanel.css';
import { useState, useEffect } from 'react';
import { pushBackAction, popBackAction } from './backNavigation';

function PremiumProPanel({ onClose, onBack, isPro = false }) {
  const [activeTab, setActiveTab] = useState('benefits');

  const proBenefits = [
    {
      title: 'Dedicated Support',
      description: 'Get priority support from our expert team',
      icon: '👔'
    },
    {
      title: 'Custom Branding',
      description: 'Customize your profile with your brand colors and logo',
      icon: '🎨'
    },
    {
      title: 'Advanced Analytics',
      description: 'Track profile views, applications, and engagement metrics',
      icon: '📊'
    },
    {
      title: 'API Access',
      description: 'Integrate with your own applications',
      icon: '⚙️'
    },
    {
      title: 'Team Collaboration',
      description: 'Manage multiple team members and campaigns',
      icon: '👥'
    },
    {
      title: 'Premium Badge',
      description: 'Display a verified Pro badge on your profile',
      icon: '🏆'
    }
  ];

  const proFeatures = [
    'Unlimited job applications',
    'Unlimited featured profiles',
    'Advanced profile analytics',
    'Profile verification badge',
    '24/7 priority support',
    'Enhanced visibility in search',
    'Dedicated account manager',
    'Custom profile branding',
    'Full API access',
    'Team collaboration tools',
    'Monthly strategy sessions',
    'Early access to new features'
  ];

  useEffect(() => {
    const handleBackAction = () => {
      if (typeof onBack === 'function') {
        onBack();
      } else {
        onClose();
      }
    };

    pushBackAction(handleBackAction);
    return () => popBackAction(handleBackAction);
  }, [onClose, onBack]);

  return (
    <div className="pro-panel-wrapper" onClick={onClose}>
      <div className="pro-panel-backdrop" aria-hidden="true" />
      <div className="pro-panel" onClick={(e) => e.stopPropagation()}>
        <button className="close-panel-btn" onClick={onClose}>✕</button>

        <div className="pro-header">
          <div className="pro-badge-large">🏆 PREMIUM PRO</div>
          <h1 className="pro-title">Welcome to Premium Pro</h1>
          <p className="pro-subtitle">Unlock unlimited potential with our most powerful plan</p>
        </div>

        {/* Tabs */}
        <div className="pro-tabs">
          <button 
            className={`tab-btn ${activeTab === 'benefits' ? 'active' : ''}`}
            onClick={() => setActiveTab('benefits')}
          >
            ✨ Benefits
          </button>
          <button 
            className={`tab-btn ${activeTab === 'features' ? 'active' : ''}`}
            onClick={() => setActiveTab('features')}
          >
            📋 All Features
          </button>
          <button 
            className={`tab-btn ${activeTab === 'faq' ? 'active' : ''}`}
            onClick={() => setActiveTab('faq')}
          >
            ❓ FAQs
          </button>
        </div>

        {/* Tab Content */}
        <div className="pro-content">
          {/* Benefits Tab */}
          {activeTab === 'benefits' && (
            <div className="benefits-grid">
              {proBenefits.map((benefit, index) => (
                <div key={index} className="benefit-card">
                  <div className="benefit-icon">{benefit.icon}</div>
                  <h3 className="benefit-title">{benefit.title}</h3>
                  <p className="benefit-description">{benefit.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* Features Tab */}
          {activeTab === 'features' && (
            <div className="features-section">
              <h3 className="features-title">All Premium Pro Features</h3>
              <div className="features-grid">
                {proFeatures.map((feature, index) => (
                  <div key={index} className="feature-row">
                    <span className="feature-check">✓</span>
                    <span className="feature-text">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FAQ Tab */}
          {activeTab === 'faq' && (
            <div className="faq-section">
              <div className="faq-item">
                <h4>How do I manage my team?</h4>
                <p>You can invite team members from your account settings and assign them different roles and permissions.</p>
              </div>
              <div className="faq-item">
                <h4>Can I cancel anytime?</h4>
                <p>Yes, you can cancel your subscription anytime without any penalties or hidden fees.</p>
              </div>
              <div className="faq-item">
                <h4>What payment methods do you accept?</h4>
                <p>We accept all major credit cards, PayPal, and bank transfers for annual plans.</p>
              </div>
              <div className="faq-item">
                <h4>How often is billing?</h4>
                <p>By default, billing occurs monthly. You can switch to annual billing for a 20% discount.</p>
              </div>
              <div className="faq-item">
                <h4>Is there a free trial?</h4>
                <p>Yes! Get 14 days free when you sign up. No credit card required.</p>
              </div>
            </div>
          )}
        </div>



        {/* Actions */}
        <div className="pro-actions">
          {isPro ? (
            <button className="btn-manage" onClick={onClose}>
              → Manage My Subscription
            </button>
          ) : (
            <>
              <button className="btn-upgrade-now">
                Upgrade Now
              </button>
              <button className="btn-back-pro" onClick={onClose}>
                ← Back
              </button>
            </>
          )}
        </div>

        <p className="pro-footer-text">No credit card required. Cancel anytime.</p>
      </div>
    </div>
  );
}

export default PremiumProPanel;
