import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheckCircle, FiClock } from 'react-icons/fi';
import { supabase } from './supabaseClient';
import { API_URL } from '../../config';
import './BookPanel.css';

export const SubscriptionModal = ({
  isOpen,
  onClose,
  user,
  onSubscribed,
  product = 'books',
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState('1m');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [checkoutRequestId, setCheckoutRequestId] = useState(null);
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  if (!isOpen) return null;

  const plans = [
    { id: '1m', label: '1 month', months: 1, priceKes: 50 },
    { id: '2m', label: '2 months', months: 2, priceKes: 100 },
    { id: '3m', label: '3 months', months: 3, priceKes: 150 },
    { id: '6m', label: '6 months', months: 6, priceKes: 300 },
    { id: '9m', label: '9 months', months: 9, priceKes: 450 },
    { id: '12m', label: '12 months', months: 12, priceKes: 600 },
  ];

  const currentPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  const handleSubscribe = async () => {
    if (!user?.id) {
      setError('You need to sign in first.');
      return;
    }

    if (!phoneNumber.trim()) {
      setError('Please enter your M-Pesa phone number.');
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
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData?.session?.access_token;
      if (!token) {
        setError('Session expired. Please sign in again.');
        return;
      }

      console.log('📱 Starting M-Pesa subscription:', { product, planId: currentPlan.id, phoneNumber: phoneNumber.trim() });

      const initRes = await fetch(`${API_URL}/api/subscriptions/mpesa/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product,
          planId: currentPlan.id,
          phoneNumber: phoneNumber.trim(),
        }),
      });

      console.log('📨 Init response status:', initRes.status, initRes.ok);
      const initJson = await initRes.json();
      console.log('📦 Init response data:', initJson);
      if (!initRes.ok || !initJson.ok) {
        const errorMsg = initJson.error || initJson.details || 'Failed to start payment';
        throw new Error(errorMsg);
      }

      if (!initJson.checkoutRequestId) {
        throw new Error('Invalid M-Pesa initialize response');
      }

      setCheckoutRequestId(initJson.reference);
      setAwaitingPayment(true);

      // Show success message - M-Pesa will send STK push to user's phone
      alert(`M-Pesa payment request sent to ${phoneNumber}. Please check your phone and enter your M-Pesa PIN to complete the payment.`);

    } catch (e) {
      console.error('Subscription failed Error:', e.message || e);
      setError(`Failed to start subscription: ${e.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!user?.id || !checkoutRequestId) return;

    try {
      setLoading(true);
      setError(null);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData?.session?.access_token;
      if (!token) {
        setError('Session expired. Please sign in again.');
        return;
      }

      const verifyRes = await fetch(`${API_URL}/api/subscriptions/mpesa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reference: checkoutRequestId }),
      });

      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok || !verifyJson.ok) {
        if (verifyRes.status === 202) {
          // Payment still processing
          setError('Payment is still being processed. Please wait a moment and try again.');
          return;
        }
        throw new Error(verifyJson.error || 'Verification failed');
      }

      if (onSubscribed) {
        onSubscribed(verifyJson.subscription);
      }
      setAwaitingPayment(false);
      setCheckoutRequestId(null);
      setPhoneNumber('');
    } catch (e) {
      console.error('Verification failed', e);
      setError(e.message || 'Failed to verify payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlayBKP"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal-contentBKP subscription-modalBKP"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'tween', duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close-buttonBKP" onClick={onClose}>
              <FiX size={20} />
            </button>

            <div className="subscription-headerBKP">
              <h2>Unlock Book Library</h2>
              <p>
                Subscribe to read all books online. Downloads are disabled to keep content
                safe, but you can enjoy full-screen reading any time.
              </p>
            </div>

            <div className="subscription-bodyBKP">
              <div className="subscription-plansBKP">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className={
                      'subscription-planBKP' +
                      (plan.id === selectedPlanId ? ' subscription-plan-selectedBKP' : '')
                    }
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    <div className="subscription-plan-mainBKP">
                      <span className="subscription-plan-labelBKP">{plan.label}</span>
                      <span className="subscription-plan-priceBKP">Ksh {plan.priceKes}</span>
                    </div>
                    <div className="subscription-plan-metaBKP">
                      <FiClock size={14} />
                      <span>Access for {plan.months} month{plan.months > 1 ? 's' : ''}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="subscription-phone-inputBKP">
                <label htmlFor="phoneNumber" className="subscription-phone-labelBKP">
                  M-Pesa Phone Number
                </label>
                <input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="0712345678 or +254712345678"
                  className="subscription-phone-fieldBKP"
                  disabled={awaitingPayment}
                />
                <p className="subscription-phone-helpBKP">
                  Enter the phone number registered with M-Pesa
                </p>
              </div>

              <div className="subscription-footerBKP">
                <div className="subscription-noteBKP">
                  <FiCheckCircle size={16} />
                  <span>Subscription is locked to your account – sharing and screenshots are discouraged.</span>
                </div>
                {error && <div className="subscription-errorBKP">{error}</div>}
                {!awaitingPayment ? (
                  <button
                    type="button"
                    className="subscription-submitBKP"
                    onClick={handleSubscribe}
                    disabled={loading}
                  >
                    {loading ? 'Processing…' : `Pay with M-Pesa – Ksh ${currentPlan.priceKes}`}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="subscription-submitBKP"
                    onClick={handleVerify}
                    disabled={loading}
                  >
                    {loading ? 'Verifying…' : 'I have completed payment – Verify'}
                  </button>
                )}
                <p className="subscription-smallprintBKP">
                  Payment is processed securely via M-Pesa. After entering your PIN on your phone,
                  click "Verify" to activate your subscription.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
