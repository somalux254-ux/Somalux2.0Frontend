import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './SubscriptionModal.css';
import { pushBackAction, popBackAction } from './backNavigation';

const SubscriptionModal = ({
  isOpen,
  onClose,
  onBack,
  user,
  onSubscribed,
  product = 'joblink',
  selectedPlan = null,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState('1m');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [checkoutRequestId, setCheckoutRequestId] = useState(null);
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [viewportInsets, setViewportInsets] = useState({ top: 0, bottom: 0, left: 0, right: 0, height: 0 });

  useEffect(() => {
    if (!isOpen) return undefined;

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
  }, [isOpen, onClose, onBack]);

  if (!isOpen) return null;

  const premiumPlans = [
    { id: '1m', label: '1 month', months: 1, priceKes: 30 },
    { id: '3m', label: '3 months', months: 3, priceKes: 60 },
    { id: '6m', label: '6 months', months: 6, priceKes: 150 },
    { id: '12m', label: '12 months', months: 12, priceKes: 270 },
  ];

  const proPlans = [
    { id: '1m', label: '1 month', months: 1, priceKes: 50 },
    { id: '3m', label: '3 months', months: 3, priceKes: 100 },
    { id: '6m', label: '6 months', months: 6, priceKes: 250 },
    { id: '12m', label: '12 months', months: 12, priceKes: 450 },
  ];

  const plans = selectedPlan === 'pro' ? proPlans : premiumPlans;

  const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  const handlePhoneChange = (e) => {
    const sanitizedValue = e.target.value
      .replace(/[^\d+]/g, '')
      .replace(/(?!^)\+/g, '');

    setPhoneNumber(sanitizedValue);
  };

  const handleSubscribe = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter your payment details.');
      return;
    }

    // Basic phone number validation for Kenyan numbers
    const phoneRegex = /^(\+254|254|0)[17]\d{8}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s+/g, ''))) {
      setError('Please enter a valid Kenyan phone number (e.g., 0712345678 or +254712345678).');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Demo mode: Simulate payment request
      console.log('📱 Demo Mode - Starting subscription:', { product, planId: currentPlan.id, phoneNumber: phoneNumber.trim() });

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Generate a fake reference ID for demo
      const demoReference = `DEMO-${Date.now()}`;
      setCheckoutRequestId(demoReference);
      setAwaitingPayment(true);

      // Show success message
      alert(`Demo Mode: Payment request sent to ${phoneNumber}.\n\nClick "Verify" to complete the demo subscription flow.`);

    } catch (e) {
      console.error('Subscription error:', e.message || e);
      setError(`Failed to start subscription: ${e.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!checkoutRequestId) return;

    try {
      setLoading(true);
      setError(null);

      // Demo mode: Simulate payment verification
      console.log('📱 Demo Mode - Verifying payment:', { reference: checkoutRequestId });

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Demo success - just close and show success
      if (onSubscribed) {
        onSubscribed({
          planId: selectedPlanId,
          months: currentPlan.months,
          priceKes: currentPlan.priceKes,
          purchasedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + currentPlan.months * 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      alert(`✅ Demo Upgrade Successful!\n\nYou now have ${currentPlan.months} month${currentPlan.months > 1 ? 's' : ''} of premium access (Ksh ${currentPlan.priceKes})\n\nThis is a demo. In production, payment would be processed via M-Pesa.`);

      setAwaitingPayment(false);
      setCheckoutRequestId(null);
      setPhoneNumber('');
      setSelectedPlanId('1m');
      onClose();
    } catch (e) {
      console.error('Verification failed', e);
      setError(e.message || 'Failed to verify payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="subscription-modal-overlay"
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
      <div className="subscription-modal-backdrop" aria-hidden="true" />
      <div
        className="subscription-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#111a20',
          opacity: 1,
          position: 'relative',
          zIndex: 1,
          borderColor: 
            selectedPlan === 'premium' ? '#00d9ff' : 
            selectedPlan === 'pro' ? '#ffd700' : 
            'rgba(0, 217, 255, 0.15)'
        }}
      >
        <button className="subscription-close-btn" onClick={onClose}>
          ✕
        </button>

        <div className="subscription-header">
          <h2 style={{
            color: 
              selectedPlan === 'premium' ? '#00d9ff' : 
              selectedPlan === 'pro' ? '#ffd700' : 
              '#ffffff'
          }}>
            Unlock {selectedPlan === 'premium' ? 'Premium' : selectedPlan === 'pro' ? 'Premium Pro' : 'Premium'}
          </h2>
        </div>

        <div className="subscription-body">
          <div className="subscription-plans-grid">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                className={
                  'subscription-plan-card' +
                  (plan.id === selectedPlanId ? ' selected' : '')
                }
                onClick={() => setSelectedPlanId(plan.id)}
              >
                <div className="plan-price">{plan.priceKes}</div>
                <div className="plan-label">{plan.label}</div>
              </button>
            ))}
          </div>

          <div className="subscription-payment-section">
            <label className="payment-label">
              <svg className="subscription-phone-icon" viewBox="0 -1 34 34" fill="none" aria-hidden="true">
                <path d="M1.02744 7.27271C0.848395 10.3893 1.41536 13.4881 2.67269 16.5692C3.93002 19.6502 5.7667 22.3988 8.18273 24.8148C10.5988 27.2308 13.3473 29.0675 16.4283 30.3248C19.5095 31.5822 22.6082 32.1318 25.7249 31.9734L25.6129 24.9352C20.9073 24.9352 16.8907 23.2715 13.5633 19.9441C10.236 16.6167 8.57225 12.6002 8.57225 7.89457L1.02744 7.27271Z" fill="url(#paint0_linear_103_1456)"/>
                <path d="M25.7298 31.9999C29.7464 31.9999 33.0025 28.7438 33.0025 24.7272C33.0025 20.7106 29.7464 17.4545 25.7298 17.4545C21.7131 17.4545 18.457 20.7106 18.457 24.7272C18.457 28.7438 21.7131 31.9999 25.7298 31.9999Z" fill="url(#paint1_radial_103_1456)"/>
                <path d="M8.27468 14.5455C12.2913 14.5455 15.5474 11.2893 15.5474 7.27273C15.5474 3.25611 12.2913 0 8.27468 0C4.25806 0 1.00195 3.25611 1.00195 7.27273C1.00195 11.2893 4.25806 14.5455 8.27468 14.5455Z" fill="url(#paint2_radial_103_1456)"/>
                <defs>
                  <linearGradient id="paint0_linear_103_1456" x1="13.36" y1="7.27271" x2="13.36" y2="31.9999" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00EE7A"/>
                    <stop offset="1" stopColor="#00C853"/>
                  </linearGradient>
                  <radialGradient id="paint1_radial_103_1456" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(23.4074 20.6087) rotate(78.4769) scale(11.6255)">
                    <stop stopColor="#00EE7A"/>
                    <stop offset="1" stopColor="#00C853"/>
                  </radialGradient>
                  <radialGradient id="paint2_radial_103_1456" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(5.95233 3.15425) rotate(78.4769) scale(11.6255)">
                    <stop stopColor="#00EE7A"/>
                    <stop offset="1" stopColor="#00C853"/>
                  </radialGradient>
                </defs>
              </svg>
              <span>Phone Number</span>
            </label>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9+]*"
              value={phoneNumber}
              onChange={handlePhoneChange}
              placeholder="0712345678"
              className="subscription-phone-field"
              disabled={awaitingPayment}
              maxLength={13}
              autoComplete="tel"
            />

            {error && <div className="subscription-error-box">{error}</div>}

            {!awaitingPayment ? (
              <button
                type="button"
                className="subscription-pay-btn"
                onClick={handleSubscribe}
                disabled={loading}
              >
                {loading ? 'Processing...' : `💳 Pay Ksh ${currentPlan.priceKes}`}
              </button>
            ) : (
              <button
                type="button"
                className="subscription-verify-btn"
                onClick={handleVerify}
                disabled={loading}
              >
                {loading ? 'Verifying...' : '✓ Verify'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SubscriptionModal;
