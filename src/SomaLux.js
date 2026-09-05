// SomaLux.js
import React, { useLayoutEffect, useRef, useState } from 'react';
import { HashRouter as Router, Route, Routes, Navigate, useLocation, useNavigate } from "react-router-dom";
import { FeatureFlagsProvider } from "./context/FeatureFlagsContext";
import UserUploadPage from "./SomaLux/User/UserProfile/UserUploadPage";
import { BookManagement } from "./SomaLux/BookDashboard/BookManagement";
import { BooksAdmin } from "./SomaLux/Books/Admin/BooksAdmin";
import SettingsPage from './SomaLux/Settings/SettingsPage';
import { NotificationProvider } from './SomaLux/contexts/NotificationContext';
import { supabase } from './SomaLux/Books/supabaseClient';
import { signOutCompletely } from './utils/sessionManager';
import { EmailSender } from "./SomaLux/Admin/EmailSender";
import NativeInstallPrompt from "./components/NativeInstallPrompt";

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

export function SomaLux() {
    return (
        <FeatureFlagsProvider>
            <div className="SomaLux">
                <NativeInstallPrompt />
                {/* Global Toasts */}
                <ToastContainer
                    position="top-right"
                    autoClose={4000}
                    hideProgressBar={false}
                    closeButton={false}
                    pauseOnHover
                />

                <Router>
                    <StartupRouteGuard>
                        <Routes>

                        {/* Default redirect */}
                        <Route path="/" element={<Navigate to="/BookManagement" replace />} />

                        {/* User */}
                       
                        <Route path="/user/upload" element={<UserUploadPage />} />
                        <Route path="/user/upload/:tabType" element={<UserUploadPage />} />

                        {/* Books */}
                        <Route path="/BookManagement" element={<BookManagement />} />
                        <Route path="/BookManagement/:tab" element={<BookManagement />} />
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

                        {/* Email */}
                        <Route path="/admin/email" element={<EmailSender />} />
                        </Routes>
                    </StartupRouteGuard>
                </Router>
            </div>
        </FeatureFlagsProvider>
    );
}
