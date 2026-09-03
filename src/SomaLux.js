// SomaLux.js
import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { FeatureFlagsProvider } from "./context/FeatureFlagsContext";
import UserUploadPage from "./SomaLux/User/UserProfile/UserUploadPage";
import { BookManagement } from "./SomaLux/BookDashboard/BookManagement";
import { BooksAdmin } from "./SomaLux/Books/Admin/BooksAdmin";
import { SubscriptionThanks } from "./SomaLux/Subscriptions/SubscriptionThanks";
import { EmailSender } from "./SomaLux/Admin/EmailSender";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
                        <Route path="/books/admin/*" element={<BooksAdmin />} />
                        <Route path="/past-papers/admin" element={<Navigate to="/books/admin/content?tab=pastpapers" replace />} />

                        {/* Subscription */}
                        <Route path="/subscription/thanks" element={<SubscriptionThanks />} />

                        {/* Email */}
                        <Route path="/admin/email" element={<EmailSender />} />
                    </Routes>
                </Router>
            </div>
        </FeatureFlagsProvider>
    );
}
