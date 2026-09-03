import { useNotifications } from '../../contexts/NotificationContext';

export const NotificationsTab = ({ settings, handleToggle, showSavedMessage }) => {
  const { showToast, addNotification } = useNotifications();

  const sendTestToast = () => showToast({ type: 'success', title: 'Test Toast', message: 'This is a sample toast from the settings.' });
  const sendPersistent = () => addNotification({ type: 'info', title: 'Test Notification', message: 'This will appear in your notification center.' });

  return (
  <div className="settings-stp-page-section">
    <div className="section-header">
      <div>
        <h2 className="settings-stp-page-section-title">Notification Preferences</h2>
        <p className="settings-stp-page-section-description">Manage how you receive notifications</p>
      </div>
    </div>
    
    <div className="settings-stp-options-group">
      <div className="settings-stp-page-option">
        <div className="option-info">
          <label className="option-label">Email Notifications</label>
          <p className="option-description">Receive updates and announcements via email</p>
        </div>
        <div className="toggle-switch">
          <input 
            type="checkbox"
            id="emailNotif"
            checked={settings.notifications.emailNotifications}
            onChange={() => handleToggle('notifications', 'emailNotifications')}
          />
          <label htmlFor="emailNotif"></label>
        </div>
      </div>

      <div className="settings-stp-page-option">
        <div className="option-info">
          <label className="option-label">Push Notifications</label>
          <p className="option-description">Receive browser and mobile notifications</p>
        </div>
        <div className="toggle-switch">
          <input 
            type="checkbox"
            id="pushNotif"
            checked={settings.notifications.pushNotifications}
            onChange={() => handleToggle('notifications', 'pushNotifications')}
          />
          <label htmlFor="pushNotif"></label>
        </div>
      </div>

      <div className="settings-stp-page-option">
        <div className="option-info">
          <label className="option-label">Job Alerts</label>
          <p className="option-description">Get notified about new job opportunities</p>
        </div>
        <div className="toggle-switch">
          <input 
            type="checkbox"
            id="jobAlerts"
            checked={settings.notifications.jobAlerts}
            onChange={() => handleToggle('notifications', 'jobAlerts')}
          />
          <label htmlFor="jobAlerts"></label>
        </div>
      </div>

      <div className="settings-stp-page-option">
        <div className="option-info">
          <label className="option-label">Message Notifications</label>
          <p className="option-description">Notifications for new messages</p>
        </div>
        <div className="toggle-switch">
          <input 
            type="checkbox"
            id="messageNotif"
            checked={settings.notifications.messageNotifications}
            onChange={() => handleToggle('notifications', 'messageNotifications')}
          />
          <label htmlFor="messageNotif"></label>
        </div>
      </div>
      
      <div style={{ marginTop: 18 }}>
        <button onClick={sendTestToast} style={{ marginRight: 8 }}>Send Test Toast</button>
        <button onClick={sendPersistent}>Send Persistent Notification</button>
      </div>
    </div>
  </div>
  );
};
