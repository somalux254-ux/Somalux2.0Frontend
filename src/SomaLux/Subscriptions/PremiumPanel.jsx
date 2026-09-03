import './PremiumPanel.css';
import { useState, useEffect } from 'react';
import { pushBackAction, popBackAction } from './backNavigation';
import { createPortal } from 'react-dom';

function PremiumPanel({ onClose, onSelectPlan, onBack }) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [viewportInsets, setViewportInsets] = useState({ top: 0, bottom: 0, left: 0, right: 0, height: 0 });

  useEffect(() => {
    const updateViewportInsets = () => {
      const visualViewport = window.visualViewport;
      const top = visualViewport ? Math.round(visualViewport.offsetTop) : 0;
      const left = visualViewport ? Math.round(visualViewport.offsetLeft) : 0;
      const height = visualViewport ? Math.round(visualViewport.height) : window.innerHeight;
      const bottom = Math.max(0, window.innerHeight - (top + height));
      const right = Math.max(0, window.innerWidth - (left + (visualViewport ? visualViewport.width : window.innerWidth)));
      setViewportInsets({ top, bottom, left, right, height });
    };

    updateViewportInsets();

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', updateViewportInsets);
    visualViewport?.addEventListener('scroll', updateViewportInsets);
    window.addEventListener('resize', updateViewportInsets);
    window.addEventListener('orientationchange', updateViewportInsets);

    const handleBackAction = () => {
      if (typeof onBack === 'function') {
        onBack();
      } else {
        onClose();
      }
    };

    pushBackAction(handleBackAction);
    return () => {
      popBackAction(handleBackAction);
      visualViewport?.removeEventListener('resize', updateViewportInsets);
      visualViewport?.removeEventListener('scroll', updateViewportInsets);
      window.removeEventListener('resize', updateViewportInsets);
      window.removeEventListener('orientationchange', updateViewportInsets);
    };
  }, [onClose, onBack]);

  const handleChoose = () => {
    if (selectedPlan === 'basic') {
      // Basic plan is free, just close the panel
      onClose();
      return;
    }
    
    if (selectedPlan && onSelectPlan) {
      onSelectPlan(selectedPlan);
    }
  };

  return createPortal(
    <div
      className="premium-panel-wrapper"
      onClick={onClose}
      style={{
        backgroundColor: 'var(--bg-main, #0c1317)',
        opacity: 1,
        '--safe-top': `${viewportInsets.top}px`,
        '--safe-bottom': `${viewportInsets.bottom}px`,
        '--safe-left': `${viewportInsets.left}px`,
        '--safe-right': `${viewportInsets.right}px`,
        height: viewportInsets.height ? `${viewportInsets.height}px` : undefined,
      }}
    >
      <div className="premium-panel-backdrop" aria-hidden="true" />
      <button
        className="close-panel-btn"
        onPointerDown={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onClick={(e) => e.stopPropagation()}
      >
        ✕
      </button>
      <div
        className="premium-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: '#111a20', opacity: 1 }}
      >

        <div className="premium-columns">
          {/* Basic Plan */}
          {/* COMMENTED OUT - Using SubscriptionModal with KSH pricing instead
          <div 
            className={`plan-column basic-column ${selectedPlan === 'basic' ? 'selected' : ''}`}
            onClick={() => setSelectedPlan('basic')}
          >
            <div className="plan-header">
              <h2 className="plan-name">Basic</h2>
              <div className="plan-price">
                <span className="price-currency">$</span>
                <span className="price-number">0</span>
                <span className="price-period">/month</span>
              </div>
            </div>

            <p className="plan-description">Get started free</p>

            <div className="plan-features">
              <div className="feature">
                <span className="check">✓</span>
                <span>Limited Job Applications</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>Basic Profile</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>Community Support</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>Job Recommendations</span>
              </div>
            </div>
          </div>

          {/* Premium Plan */}
          <div 
            className={`plan-column premium-column ${selectedPlan === 'premium' ? 'selected' : ''}`}
            onClick={() => setSelectedPlan('premium')}
          >
            <div className="plan-header">
              <h2 className="plan-name">Premium</h2>
            </div>

            <div className="plan-features">
              <div className="feature">
                <span className="check">✓</span>
                <span>Unlimited Job Applications</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>5 Featured Profiles</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>Advanced Analytics</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>Priority Support</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>Enhanced Profile Visibility</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>Profile Verification Badge</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>Access to Premium Job Listings</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>Career Development Resources</span>
              </div>
            </div>
          </div>

          {/* Premium Pro Plan */}
          <div 
            className={`plan-column pro-column ${selectedPlan === 'pro' ? 'selected' : ''}`}
            onClick={() => setSelectedPlan('pro')}
          >
            <div className="plan-header">
              <h2 className="plan-name">Premium Pro</h2>
            </div>

            <div className="plan-features">
              <div className="feature">
                <span className="check">✓</span>
                <span>Everything in Premium</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>Dedicated Account Manager</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>Custom Profile Branding</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>Team Collaboration</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>Unlimited Featured Profiles</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>API Access & Integrations</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>24/7 VIP Support</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>Monthly Strategy Sessions</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>Early Access to New Features</span>
              </div>
              <div className="feature">
                <span className="check">✓</span>
                <span>Custom Reporting & Insights</span>
              </div>
            </div>
          </div>
        </div>

        <div className="premium-footer">
          <button 
            className={`choose-btn ${selectedPlan ? 'active' : 'disabled'} ${selectedPlan}`}
            onClick={handleChoose}
            disabled={!selectedPlan}
          >
            Choose Plan
          </button>
        </div>
      </div>
    </div>
  , document.body
  );
}

export default PremiumPanel;
