import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { supabase } from "../Books/supabaseClient";
import { clearSessionCache } from "../../utils/sessionManager";
import { AuthModal } from "../Books/AuthModal";
import "./AuthModals.css"; // Import this CSS file

export const AuthModals = ({
  showAuthModal,
  setShowAuthModal,
  showSignOutModal,
  setShowSignOutModal,
  authUser,
  setAuthUser,
  markProfileSignedOut,
}) => {
  const [signOutReason, setSignOutReason] = useState("");
  const [showReasonInput, setShowReasonInput] = useState(false);

  // Prevent body scroll when any modal is open
  useEffect(() => {
    if (showAuthModal || showSignOutModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showAuthModal, showSignOutModal]);

  const handleSignOut = async () => {
    try {
      setShowSignOutModal(false);
      
      // Clear session cache FIRST (critical for preventing auto-login)
      clearSessionCache();
      
      // Supabase sign out NEXT (non-blocking)
      supabase.auth.signOut().catch(e => console.error("Sign out error:", e));
      
      // Clear local state immediately - no delays
      setAuthUser(null);
      setSignOutReason("");
      setShowReasonInput(false);
      localStorage.removeItem("userProfile");
      window.dispatchEvent(new CustomEvent("authChanged", { detail: { user: null } }));

      // Send feedback asynchronously (non-blocking) with timeout
      if (signOutReason.trim() && authUser?.email) {
        // Fire and forget - don't await
        (async () => {
          try {
            const apiOrigin =
              (typeof window !== "undefined" && window.__API_ORIGIN__) ||
              (typeof window !== "undefined" && window.location?.hostname === "localhost"
                ? `${window.location.protocol}//${window.location.hostname}:5000`
                : "");

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3sec max

            const response = await fetch(`${apiOrigin}/api/user/signout-feedback`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userEmail: authUser.email,
                userName:
                  authUser.user_metadata?.full_name ||
                  authUser.email?.split("@")[0] ||
                  "User",
                signOutReason: signOutReason.trim(),
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok) {
              console.log("Feedback sent successfully");
            }
          } catch (err) {
            console.warn("Feedback failed (non-blocking):", err?.message);
          }
        })();
      }

      toast.success("Signed out successfully", { autoClose: 2000 });
    } catch (err) {
      console.error("Sign out error:", err);
      toast.error("Sign out failed: " + (err.message || "Try again"));
    }
  };

  return (
    <>
      {/* Sign In / Sign Up Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
      />

      {/* Sign Out Confirmation Modal */}
      {showSignOutModal && (
        <div className="auth-modal-overlay" onClick={() => setShowSignOutModal(false)}>
          <div
            className="auth-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="auth-modal-header">
              <h2>Sign Out?</h2>
              <button
                className="auth-modal-close-btn"
                onClick={() => setShowSignOutModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="auth-modal-body">
              <p>Are you sure you want to sign out?</p>

              <div className="reason-section">
                <button
                  className="toggle-reason-btn"
                  onClick={() => setShowReasonInput(!showReasonInput)}
                >
                  {showReasonInput ? "Hide" : "Add a reason (optional)"}
                </button>

                {showReasonInput && (
                  <textarea
                    className="reason-textarea"
                    placeholder="Help us improve — why are you leaving today?"
                    value={signOutReason}
                    onChange={(e) => setSignOutReason(e.target.value)}
                    maxLength={300}
                    rows={4}
                  />
                )}
              </div>
            </div>

            <div className="auth-modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setShowSignOutModal(false)}
              >
                Cancel
              </button>
              <button className="btn-confirm" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};