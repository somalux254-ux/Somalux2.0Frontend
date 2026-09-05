import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { Capacitor } from '@capacitor/core';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { supabase } from './supabaseClient';
import './AuthModal.css';

export const AuthModal = ({ isOpen, onClose, onSuccess, action = 'action' }) => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const getActionMessage = () => {
    const messages = {
      'view': 'view book details',
      'like': 'like this book',
      'share': 'share a book',
      'download': 'download this book',
      'search': 'search and discover books',
      'share': 'share this book',
      'action': 'continue with this action'
    };
    return messages[action] || messages['action'];
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');

    try {
      const { data: existingSessionData } = await supabase.auth.getSession();
      if (existingSessionData?.session?.user) {
        if (onSuccess) onSuccess();
        if (onClose) onClose();
        setLoading(false);
        return;
      }

      if (Capacitor.getPlatform() === 'android') {
        const clientId = process.env.REACT_APP_GOOGLE_WEB_CLIENT_ID;
        if (!clientId) {
          throw new Error('Native Google sign-in is not configured. Add REACT_APP_GOOGLE_WEB_CLIENT_ID.');
        }

        await GoogleSignIn.initialize({ clientId });
        const result = await GoogleSignIn.signIn();
        if (!result?.idToken) {
          throw new Error('Google did not return an ID token.');
        }

        void supabase.auth.signInWithIdToken({
          provider: 'google',
          token: result.idToken,
        }).then(({ error: tokenError }) => {
          if (tokenError) throw tokenError;
        }).catch((tokenError) => {
          console.error('Background sign in error:', tokenError);
        });

        setLoading(false);
        if (onSuccess) onSuccess();
        if (onClose) onClose();
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15sec timeout

      const redirectTo = typeof window !== 'undefined'
        ? window.location.origin
        : 'https://agirxwnwpxpddaqylucg.supabase.co/auth/v1/callback';

      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      clearTimeout(timeoutId);

      if (signInError) throw signInError;

      if (!data?.url) {
        throw new Error('Google sign-in did not return a redirect URL.');
      }

      // Redirect explicitly so OAuth does not remain stuck in the modal.
      window.location.assign(data.url);
    } catch (err) {
      console.error('Sign in error:', err);
      if (err?.name === 'AbortError') {
        setError('Sign in took too long. Please try again.');
      } else {
        setError(err.message || 'Failed to sign in. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="auth-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="auth-modal-content"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="auth-modal-close" onClick={onClose}>
              <FiX size={18} />
            </button>

            <div className="auth-container">
              <h3>Sign in to:</h3>
              <ul className="auth-features">
                <li>Search and discover books</li>
                <li>Download and read books</li>
                <li>Share and discuss books</li>
                <li>Save your favorites and reading history</li>
              </ul>

              {error && <div className="auth-error">{error}</div>}

              <button
                className="google-sign-in-btn"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <FcGoogle size={24} />
                <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
