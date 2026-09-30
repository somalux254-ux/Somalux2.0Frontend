// SomaLux.js
import React, { useLayoutEffect, useRef, useState } from 'react';
import { HashRouter as Router, Route, Routes, Navigate, useLocation, useNavigate } from "react-router-dom";
import { FeatureFlagsProvider } from "./context/FeatureFlagsContext";
import UserUploadPage from "./SomaLux/User/UserProfile/UserUploadPage";
import { BookManagement } from "./SomaLux/BookDashboard/BookManagement";
import { ProfilePage } from "./SomaLux/BookDashboard/Profile";
import { BooksAdmin } from "./SomaLux/Books/Admin/BooksAdmin";
import SettingsPage from './SomaLux/Settings/SettingsPage';
import { NotificationProvider } from './SomaLux/contexts/NotificationContext';
import { ReaderAudioProvider } from './SomaLux/contexts/ReaderAudioContext';
import { supabase } from './SomaLux/Books/supabaseClient';
import { signOutCompletely } from './auth/sessionManager';
import { EmailSender } from "./SomaLux/Admin/EmailSender";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function StartupRouteGuard({ children }) {
    const location = useLocation();
    const navigate = useNavigate();
    const hasCheckedRoute = useRef(false);
    const [ready, setReady] = useState(false);

    useLayoutEffect(() => {
        if (hasCheckedRoute.current) return;
        hasCheckedRoute.current = true;

        if (location.pathname === '/BookManagement/pastpapers') {
            navigate('/BookManagement', { replace: true });
            return;
        }

        setReady(true);
    }, [location.pathname, navigate]);

    useLayoutEffect(() => {
        if (hasCheckedRoute.current && location.pathname !== '/BookManagement/pastpapers') {
            setReady(true);
        }
    }, [location.pathname]);

    return ready ? children : null;
}

function SomaLuxRoutes() {
    const location = useLocation();
    const backgroundLocation = location.state?.backgroundLocation;

    return (
        <StartupRouteGuard>
            <Routes location={backgroundLocation || location}>
                <Route path="/" element={<Navigate to="/BookManagement" replace />} />
                <Route path="/user/upload" element={<UserUploadPage />} />
                <Route path="/user/upload/:tabType" element={<UserUploadPage />} />
                <Route path="/BookManagement" element={<BookManagement />} />
                <Route path="/BookManagement/:tab" element={<BookManagement />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={
                    <NotificationProvider>
                        <SettingsPage
                            onBack={() => window.history.back()}
                            onLogout={() => signOutCompletely(supabase)}
                        />
                    </NotificationProvider>
                } />
                <Route path="/books/admin/*" element={<BooksAdmin />} />
                <Route path="/past-papers/admin" element={<Navigate to="/books/admin/content?tab=pastpapers" replace />} />
                <Route path="/admin/email" element={<EmailSender />} />
            </Routes>

            {backgroundLocation && (
                <Routes>
                    <Route path="/profile" element={<ProfilePage />} />
                </Routes>
            )}
        </StartupRouteGuard>
    );
}

export function SomaLux() {
    return (
        <FeatureFlagsProvider>
            <div className="SomaLux">
                {/* Global Toasts */}
                <ToastContainer
                    position="top-right"
                    autoClose={4000}
                    hideProgressBar={false}
                    closeButton={false}
                    pauseOnHover
                />

                <ReaderAudioProvider>
                    <Router>
                        <SomaLuxRoutes />
                    </Router>
                </ReaderAudioProvider>
            </div>
        </FeatureFlagsProvider>
    );
}
