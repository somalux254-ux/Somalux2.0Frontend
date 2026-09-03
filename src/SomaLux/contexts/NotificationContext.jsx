import React, { createContext, useContext, useMemo } from 'react';
import { toast } from 'react-toastify';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const value = useMemo(() => ({
    showToast: ({ type = 'info', title, message }) => {
      const content = [title, message].filter(Boolean).join(': ');
      toast[type]?.(content || message || title || 'Notification');
    },
    addNotification: () => {},
  }), []);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => useContext(NotificationContext) || {
  showToast: () => {},
  addNotification: () => {},
};
