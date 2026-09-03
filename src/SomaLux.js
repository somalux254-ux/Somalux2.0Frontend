// SomaLux.js
import React from 'react';
import { HashRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { FeatureFlagsProvider } from "./context/FeatureFlagsContext";
import UserUploadPage from "./SomaLux/User/UserProfile/UserUploadPage";
import { BookManagement } from "./SomaLux/BookDashboard/BookManagement";
import { BooksAdmin } from "./SomaLux/Books/Admin/BooksAdmin";
import SettingsPage from './SomaLux/Settings/SettingsPage';
import { NotificationProvider } from './SomaLux/contexts/NotificationContext';
import { supabase } from './SomaLux/Books/supabaseClient';
import { EmailSender } from "./SomaLux/Admin/EmailSender";
import NativeInstallPrompt from "./components/NativeInstallPrompt";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
                                    onLogout={() => supabase.auth.signOut()}
                                />
                            </NotificationProvider>
                        } />
                        <Route path="/books/admin/*" element={<BooksAdmin />} />
                        <Route path="/past-papers/admin" element={<Navigate to="/books/admin/content?tab=pastpapers" replace />} />

                        {/* Email */}
                        <Route path="/admin/email" element={<EmailSender />} />
                    </Routes>
                </Router>
            </div>
        </FeatureFlagsProvider>
    );
}
