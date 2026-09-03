import React, { useEffect, useState } from 'react';
import { FiCheck, FiAward, FiX } from 'react-icons/fi';
import ReactDOM from 'react-dom';

/**
 * VerificationTierModal Component
 * Displays subscription tiers with benefits for verification (like X.com)
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - userTier: 'basic' | 'premium' | 'premium_pro'
 * - onSelectTier: (tier) => void - Callback when user selects a tier
 * - isLoading: boolean - Show loading state while upgrading
 */
const VerificationTierModal = ({ 
  isOpen, 
  onClose, 
  userTier = 'basic', 
  onSelectTier,
  isLoading = false 
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      price: 'Free',
      icon: null,
      color: '#8696a0',
      description: 'Standard access to all features',
      features: [
        'Read and download books',
        'Search library',
        'Share books',
        'Create reading goals',
        'Basic profile',
      ],
      cta: 'Current Plan',
      ctaDisabled: true,
      badge: false,
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 'KSH 500',
      priceFreq: '/month',
      icon: <FiCheck />,
      color: '#2196F3',
      description: 'Get verified with a blue checkmark',
      features: [
        '✓ Blue verification badge',
        'All Basic features',
        'Early access to new books',
        'Ad-free reading experience',
        'Advanced analytics dashboard',
        'Priority support',
        'Exclusive content access',
        'Custom profile customization',
      ],
      cta: 'Upgrade to Premium',
      ctaDisabled: userTier !== 'basic',
      badge: true,
    },
    {
      id: 'premium_pro',
      name: 'Premium Pro',
      price: 'KSH 1,000',
      priceFreq: '/month',
      icon: <FiAward />,
      color: '#FFD700',
      description: 'Get verified with a gold award badge',
      features: [
        '♔ Gold verification badge',
        'All Premium features',
        'Unlimited priority support',
        'Exclusive Pro community access',
        'Advanced book analytics',
        'Author collaboration tools',
        'Custom API access',
        'White-label profile option',
        'Monthly exclusive author events',
      ],
      cta: 'Upgrade to Premium Pro',
      ctaDisabled: userTier === 'premium_pro',
      badge: true,
    },
  ];

  // Portal render to body
  const modalContent = (
    <div 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#000',
        zIndex: 99999,
        overflowY: 'auto',
        overflowX: 'hidden',
      }} 
      onClick={onClose}
    >
          <div 
            style={{
              width: '100%',
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#000',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Navigation Bar */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid #2a3942',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
              position: 'sticky',
              top: 0,
              zIndex: 1001,
            }}>
              <div>
                <h1 style={{ margin: 0, color: '#e9edef', fontSize: 24, fontWeight: 700 }}>
                  Upgrade Your Account
                </h1>
                <p style={{ margin: '4px 0 0 0', color: '#8696a0', fontSize: 13 }}>
                  Choose a plan and get your verification badge
                </p>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#8696a0',
                  fontSize: 32,
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#e9edef'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#8696a0'}
              >
                ×
              </button>
            </div>

            {/* Main Content */}
            <div style={{
              flex: 1,
              padding: '24px 12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              overflowY: 'auto',
            }}>
              {/* Plans Grid - Responsive */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
                width: '100%',
                maxWidth: 'none',
                padding: '0 16px',
              }}>
            {plans.map((plan) => {
              const isActive = userTier === plan.id;
              
              return (
                <div
                  key={plan.id}
                  style={{
                    padding: '24px 20px',
                    border: `1.5px solid ${isActive ? plan.color : '#1f2937'}`,
                    borderRadius: '10px',
                    backgroundColor: isActive ? `${plan.color}10` : '#0d1b28',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    position: 'relative',
                    minHeight: window.innerWidth > 768 ? '420px' : 'auto',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = plan.color;
                      e.currentTarget.style.backgroundColor = '#0f1f30';
                      e.currentTarget.style.transform = 'scale(1.02)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = '#1f2937';
                      e.currentTarget.style.backgroundColor = '#0d1b28';
                      e.currentTarget.style.transform = 'scale(1)';
                    }
                  }}
                >
                  {/* Premium Badge */}
                  {plan.badge && (
                    <div style={{
                      position: 'absolute',
                      top: '-10px',
                      left: '16px',
                      backgroundColor: plan.color,
                      color: plan.color === '#FFD700' ? '#000' : '#fff',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '9px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                    }}>
                      ⭐ Popular
                    </div>
                  )}

                  {/* Plan Header */}
                  <div style={{ marginBottom: '14px', marginTop: plan.badge ? '12px' : '0' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '6px',
                    }}>
                      {plan.icon && (
                        <span style={{
                          fontSize: '20px',
                          color: plan.color,
                        }}>
                          {plan.icon}
                        </span>
                      )}
                      <h3 style={{
                        margin: 0,
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#e9edef',
                      }}>
                        {plan.name}
                      </h3>
                    </div>
                    <p style={{
                      margin: '4px 0 0 0',
                      fontSize: '12px',
                      color: '#8696a0',
                      lineHeight: '1.5',
                    }}>
                      {plan.description}
                    </p>
                  </div>

                  {/* Price Section */}
                  <div style={{
                    marginBottom: '14px',
                    paddingBottom: '14px',
                    borderBottom: '1px solid #1f2937',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '4px',
                    }}>
                      <span style={{
                        fontSize: '28px',
                        fontWeight: '700',
                        color: '#e9edef',
                        lineHeight: 1,
                      }}>
                        {plan.price}
                      </span>
                      {plan.priceFreq && (
                        <span style={{
                          fontSize: '11px',
                          color: '#8696a0',
                        }}>
                          {plan.priceFreq}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Features List */}
                  <div style={{
                    marginBottom: '14px',
                    flex: 1,
                  }}>
                    <h4 style={{
                      margin: '0 0 8px 0',
                      fontSize: '10px',
                      fontWeight: '700',
                      color: '#7a8a96',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                    }}>
                      Includes
                    </h4>
                    <ul style={{
                      margin: 0,
                      padding: 0,
                      listStyle: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '7px',
                    }}>
                      {plan.features.slice(0, 5).map((feature, idx) => (
                        <li
                          key={idx}
                          style={{
                            fontSize: '12px',
                            color: '#d0d8df',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            lineHeight: '1.4',
                          }}
                        >
                          <span style={{
                            color: plan.color,
                            flexShrink: 0,
                            fontWeight: '700',
                            fontSize: '14px',
                            marginTop: '-1px',
                          }}>
                            ✓
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => onSelectTier(plan.id)}
                    disabled={plan.ctaDisabled || isLoading}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      borderRadius: '20px',
                      border: plan.ctaDisabled ? `1px solid #1f2937` : 'none',
                      backgroundColor: plan.ctaDisabled ? 'transparent' : plan.color,
                      color: plan.ctaDisabled ? '#7a8a96' : plan.color === '#FFD700' ? '#000' : '#fff',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: plan.ctaDisabled ? 'default' : 'pointer',
                      opacity: isLoading && !plan.ctaDisabled ? 0.7 : 1,
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!plan.ctaDisabled && !isLoading) {
                        e.currentTarget.style.opacity = '0.9';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!plan.ctaDisabled && !isLoading) {
                        e.currentTarget.style.opacity = '1';
                      }
                    }}
                  >
                    {isLoading && userTier !== plan.id ? 'Processing...' : plan.cta}
                  </button>

                  {isActive && (
                    <div style={{
                      marginTop: '8px',
                      padding: '6px 10px',
                      backgroundColor: `${plan.color}18`,
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: plan.color,
                      fontWeight: '600',
                      textAlign: 'center',
                    }}>
                      ✓ Active
                    </div>
                  )}
                </div>
              );
            })}
              </div>

              {/* Info Section */}
              <div style={{
                marginTop: '20px',
                padding: '14px 14px',
                backgroundColor: 'rgba(0, 168, 132, 0.08)',
                border: '1px solid rgba(0, 168, 132, 0.3)',
                borderRadius: '8px',
                maxWidth: '100%',
                textAlign: 'center',
              }}>
                <h3 style={{
                  margin: '0 0 6px 0',
                  color: '#00a884',
                  fontSize: '13px',
                  fontWeight: '700',
                }}>
                  ✨ Get Verified
                </h3>
                <p style={{
                  margin: 0,
                  color: '#8696a0',
                  fontSize: '11px',
                  lineHeight: '1.5',
                }}>
                  Choose your plan and stand out with a verification badge.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 12px',
              textAlign: 'center',
              borderTop: '1px solid #1f2937',
              marginTop: '12px',
              backgroundColor: '#000',
              fontSize: '11px',
              color: '#7a8a96',
            }}>
                <p style={{ margin: 0 }}>
                  💳 Secure payment • Cancel anytime
                </p>
            </div>
          </div>
        </div>
    );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default VerificationTierModal;