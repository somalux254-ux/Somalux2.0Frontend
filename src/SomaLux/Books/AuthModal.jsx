import React from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiX } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { Capacitor } from '@capacitor/core';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { supabase } from './supabaseClient';
import './AuthModal.css';

let googleSignInInitialization = null;

export const prewarmGoogleSignIn = () => {
  if (Capacitor.getPlatform() !== 'android' || googleSignInInitialization) return;

  const clientId = process.env.REACT_APP_GOOGLE_WEB_CLIENT_ID;
  if (!clientId) return;

  googleSignInInitialization = GoogleSignIn.initialize({ clientId });
  void googleSignInInitialization.catch((error) => {
    googleSignInInitialization = null;
    console.warn('Google sign-in initialization failed:', error);
  });
};

export const AuthModal = ({ isOpen, onClose, onSuccess, action = 'action' }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (isOpen) prewarmGoogleSignIn();

    return () => {
      document.documentElement.style.removeProperty('background-color');
      document.body.style.removeProperty('background-color');
    };
  }, [isOpen]);

  const getActionMessage = () => {
    const messages = {
      'view': 'view book details',
      'like': 'like this book',
      'download': 'download this book',
      'search': 'search and discover books',
      'action': 'continue with this action'
    };
    return messages[action] || messages['action'];
  };

  const isUserCancellation = (err) => {
    const code = String(err?.code || '').toLowerCase();
    const message = String(err?.message || '').toLowerCase();
    return (
      code === '12501' ||
      code.includes('cancel') ||
      message.includes('cancel') ||
      message.includes('canceled') ||
      message.includes('cancelled')
    );
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');

    try {
      if (Capacitor.getPlatform() !== 'android') {
        const { data: existingSessionData } = await supabase.auth.getSession();
        if (existingSessionData?.session?.user) {
          if (onSuccess) onSuccess();
          if (onClose) onClose();
          setLoading(false);
          return;
        }
      }

      if (Capacitor.getPlatform() === 'android') {
        const clientId = process.env.REACT_APP_GOOGLE_WEB_CLIENT_ID;
        if (!clientId) {
          throw new Error('Native Google sign-in is not configured. Add REACT_APP_GOOGLE_WEB_CLIENT_ID.');
        }

        prewarmGoogleSignIn();
        await googleSignInInitialization;
        const result = await GoogleSignIn.signIn();
        if (!result?.idToken) {
          throw new Error('Google did not return an ID token.');
        }

        const tokenExchange = supabase.auth.signInWithIdToken({
          provider: 'google',
          token: result.idToken,
        });

        void tokenExchange.then(({ error: tokenError }) => {
          if (tokenError) {
            console.error('Background sign in error:', tokenError);
          }
        });

        setLoading(false);
        if (onSuccess) onSuccess();
        if (onClose) onClose();
        return;
      }

      const redirectTo = typeof window !== 'undefined'
        ? window.location.origin
        : 'https://agirxwnwpxpddaqylucg.supabase.co/auth/v1/callback';

      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });

      if (signInError) throw signInError;

      if (!data?.url) {
        throw new Error('Google sign-in did not return a redirect URL.');
      }

      // Redirect explicitly so OAuth does not remain stuck in the modal.
      window.location.assign(data.url);
    } catch (err) {
      if (isUserCancellation(err)) {
        setError('');
      } else if (err?.name === 'AbortError') {
        setError('Sign in took too long. Please try again.');
      } else {
        console.error('Sign in error:', err);
        setError(err.message || 'Failed to sign in. Please try again.');
      }
      setLoading(false);
    }
  };

  const openSettingsDocument = (event, page) => {
    event.preventDefault();
    navigate('/settings', {
      state: {
        settingsPage: page,
        returnPath: location.pathname,
        authAction: action,
      },
    });
    onClose?.();
  };

  return isOpen ? createPortal(
    (
      <div className="auth-modal-overlay" onClick={onClose}>
        <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="auth-modal-close" onClick={onClose}>
              <FiX size={18} />
            </button>

            <div className="auth-container">
              <div className="auth-branding">
                <img className="auth-logo" src="/Som152.png" alt="Somalux reader" />
                <p className="auth-brand-name">Somalux</p>
                <p className="auth-tagline">Realize your dreams.</p>
              </div>

              <div className="auth-actions">
                {error && <div className="auth-error">{error}</div>}

                <button
                  className="google-sign-in-btn"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  <FcGoogle size={24} />
                  <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
                </button>
                <p className="auth-legal">
                  By continuing, you agree to our{' '}
                  <a href="#agreement" onClick={(event) => openSettingsDocument(event, 'agreement')}>User Agreement</a>{' '}
                  and acknowledge that you understand the{' '}
                  <a href="#privacy" onClick={(event) => openSettingsDocument(event, 'privacy')}>Privacy Policy</a>.
                </p>
              </div>
            </div>
        </div>
      </div>
    ),
    document.body
  ) : null;
};
