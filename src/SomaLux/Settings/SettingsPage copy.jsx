import './SettingsPage.css';
import { useState, useEffect, useRef } from 'react';
import { setSecure } from '../services/screenshotControl';
import { pushBackAction, popBackAction, runBackAction } from '../services/backNavigation';
import { FiChevronLeft, FiBell, FiSliders, FiUser, FiHelpCircle, FiChevronRight, FiMessageSquare, FiFileText, FiPackage } from 'react-icons/fi';
import { PadlockIcon } from './PadlockIcon';
import { requestLocationPermission } from '../notifications/registerLocation';

// Import tab components
import { NotificationsTab } from './tabs/NotificationsTab';
import { PrivacyTab } from './tabs/PrivacyTab';
import { PreferencesTab } from './tabs/PreferencesTab';
import { AccountTab } from './tabs/AccountTab';
import { HelpTab } from './tabs/HelpTab';
import { FaqTab } from './tabs/FaqTab';
import { FeedbackTab } from './tabs/FeedbackTab';
import { AgreementTab } from './tabs/UserAgreement';
import { UsagePolicy } from './tabs/UsagePolicy';
import { AppsTab } from './tabs/AppsTab';

// Import custom icon
import { UsageRulesIcon } from './icons/UsageRulesIcon';

function SettingsPage({ onBack, onLogout }) {
  const [currentPage, setCurrentPage] = useState('main');
  const [headerOverride, setHeaderOverride] = useState(null);
  const [settings, setSettings] = useState({
    notifications: {
      emailNotifications: true,
      pushNotifications: true,
      jobAlerts: true,
      messageNotifications: true
    },
    privacy: {
      profileVisibility: 'public',
      showEmail: false,
      showPhone: false,
      allowMessages: true,
      allowScreenshots: true
    },
    preferences: {
      theme: 'dark',
      language: 'English'
    ,
      allowLocation: false
    }
  });
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [, setSavedMessage] = useState(false); // eslint-disable-next-line no-unused-vars

  const currentPageRef = useRef(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    if (typeof onBack !== 'function') return undefined;

    const handleSettingsBack = async () => {
      if (currentPageRef.current !== 'main') {
        setCurrentPage('main');
      } else {
        onBack();
      }
    };

    pushBackAction(handleSettingsBack);
    return () => popBackAction(handleSettingsBack);
  }, [onBack]);

  const handleHeaderBack = async () => {
    try {
      const handled = await runBackAction();
      if (!handled && typeof onBack === 'function') onBack();
    } catch (e) {
      if (typeof onBack === 'function') onBack();
    }
  };

  const handleIndividualHeaderBack = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      const handled = await runBackAction();
      if (!handled) {
        if (currentPage === 'faq') {
          setCurrentPage('help');
        } else {
          setCurrentPage('main');
        }
      }
    } catch (err) {
      if (currentPage === 'faq') {
        setCurrentPage('help');
      } else {
        setCurrentPage('main');
      }
    }
  };

  const handleToggle = (category, key) => {
    // Calculate the new value BEFORE state update (since state updates are async)
    const currentValue = settings[category]?.[key];
    const toggledValue = !currentValue;

    console.log(`Toggle ${key} from ${currentValue} to ${toggledValue}`);

    setSettings(prev => {
      const newState = {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: toggledValue
        }
      };
      console.log('New settings state:', newState.privacy);
      return newState;
    });

    // Persist allow_screenshots preference when toggled
    if (category === 'privacy' && key === 'allowScreenshots') {
      console.log('Updating profile with allow_screenshots:', toggledValue);
      // Update backend profile and native secure flag
      try {
        if (typeof window.updateUserProfile === 'function') {
          window.updateUserProfile({ allow_screenshots: toggledValue }).then(() => {
            console.log('Profile updated successfully');
          }).catch(err => console.warn('Profile update failed', err));
        }
      } catch (e) {
        console.warn('Failed to update profile', e);
      }

      // Plugin: secure = true means block screenshots
      // allow_screenshots = true means DON'T block
      // So: secure = !allow_screenshots
      console.log('Setting secure flag to:', !toggledValue);
      setSecure(!toggledValue);
    }

    // Persist location preference and request permission when enabling
    if (category === 'preferences' && key === 'allowLocation') {
      try {
        // If enabling, request native permission
        if (toggledValue) {
          requestLocationPermission().then(async (granted) => {
            if (granted) {
              console.log('Location permission granted from settings toggle');
              // Save preference to profile if available
              try {
                if (typeof window.updateUserProfile === 'function') {
                  await window.updateUserProfile({ allow_location: true });
                } else {
                  localStorage.setItem('allow_location', 'true');
                }
              } catch (e) {
                console.warn('Failed to persist allow_location to profile, falling back to localStorage', e);
                localStorage.setItem('allow_location', 'true');
              }
            } else {
              console.warn('User denied location permission');
              // Revert toggle in UI
              setSettings(prev => ({
                ...prev,
                preferences: {
                  ...prev.preferences,
                  allowLocation: false
                }
              }));
            }
          }).catch(err => {
            console.warn('Error requesting location permission:', err);
            setSettings(prev => ({
              ...prev,
              preferences: {
                ...prev.preferences,
                allowLocation: false
              }
            }));
          });
        } else {
          // Disabling: persist false
          try {
            if (typeof window.updateUserProfile === 'function') {
              window.updateUserProfile({ allow_location: false }).catch(() => {});
            } else {
              localStorage.setItem('allow_location', 'false');
            }
          } catch (e) {
            console.warn('Failed to persist allow_location to profile', e);
            localStorage.setItem('allow_location', 'false');
          }
        }
      } catch (err) {
        console.warn('Error handling allowLocation toggle', err);
      }
    }

    showSavedMessage();
  };

  // Load current profile values (including allow_screenshots)
  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      try {
        if (window.getCurrentUserProfile) {
          const profile = await window.getCurrentUserProfile();
          if (!mounted || !profile) return;
          setSettings(prev => ({
            ...prev,
            privacy: {
              ...prev.privacy,
              allowScreenshots: !!profile.allow_screenshots
            },
            preferences: {
              ...prev.preferences,
              allowLocation: !!profile.allow_location
            }
          }));
        }
      } catch (e) {
        console.warn('Failed to load profile for settings', e);
      }
    };
    loadProfile();
    return () => { mounted = false; };
  }, []);

  // If no server-side profile value exists, fall back to localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('allow_location');
      if (stored !== null) {
        setSettings(prev => ({
          ...prev,
          preferences: {
            ...prev.preferences,
            allowLocation: stored === 'true'
          }
        }));
      }
    } catch (e) {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (currentPage !== 'feedback') setHeaderOverride(null);
  }, [currentPage]);

  const handleSelectChange = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
    
    // Save theme to localStorage and update data-theme attribute
    if (category === 'preferences' && key === 'theme') {
      localStorage.setItem('appTheme', value);
      document.documentElement.setAttribute('data-theme', value);
    }
    
    showSavedMessage();
  };

  const showSavedMessage = () => {
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2000);
  };

  const handleDeleteAccount = () => {
    console.log('Account deletion initiated');
    setShowConfirmDelete(false);
    onBack();
  };

  const tabConfig = [
    { id: 'notifications', label: 'Notifications', icon: FiBell, description: 'Manage alerts' },
    { id: 'privacy', label: 'Privacy Policy', icon: PadlockIcon, description: 'Control visibility' },
    { id: 'preferences', label: 'Preferences', icon: FiSliders, description: 'Customize experience' },
    { id: 'account', label: 'Account', icon: FiUser, description: 'Manage account' },
    { id: 'help', label: 'Help & Support', icon: FiHelpCircle, description: 'Get assistance' },
    { id: 'feedback', label: 'Feedback', icon: FiMessageSquare, description: 'Share your feedback' },
    { id: 'agreement', label: 'User Agreement', icon: FiFileText, description: 'Terms & conditions' },
    { id: 'usage', label: 'Usage Policy', icon: UsageRulesIcon, description: 'Platform guidelines' },
    { id: 'apps', label: 'Apps', icon: FiPackage, description: 'Manage applications' }
  ];

  const renderHeaderTitle = () => {
    if (headerOverride) {
      if (typeof headerOverride === 'string') {
        const m = headerOverride.match(/^(.+?)\s*\((.+)\)$/);
        if (m) {
          return (
            <>
              <span className="header-main">{m[1]}</span>
              <span className="header-bracket">({m[2]})</span>
            </>
          );
        }
      }
      return headerOverride;
    }
    if (currentPage === 'faq') return 'Frequently Asked Questions';
    return tabConfig.find(t => t.id === currentPage)?.label;
  };

  // Main Settings Page View
  if (currentPage === 'main') {
    return (
      <div className="settings-stp-page-container">
        {/* Header */}
        <div className="settings-stp-page-header">
          <button className="settings-stp-back-btn" onClick={handleHeaderBack}>
            <FiChevronLeft />
            <span>Back</span>
          </button>
          <h1 className="settings-stp-page-title">Settings</h1>
          <div className="settings-stp-header-spacer"></div>
        </div>

        <div className="settings-stp-page-content">
          {/* Large Tab Cards */}
          <div className="settings-stp-tabs-cards-grid">
            {tabConfig.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className="settings-stp-tab-card"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentPage(tab.id);
                  }}
                >
                  <div className="tab-card-left">
                    <div className="tab-card-icon">
                      <Icon />
                    </div>
                    <div className="tab-card-content">
                      <h3 className="tab-card-label">{tab.label}</h3>
                      <p className="tab-card-description">{tab.description}</p>
                    </div>
                  </div>
                  <div className="tab-card-arrow">
                    <FiChevronRight />
                  </div>
                </button>
              );
            })}
            {onLogout && (
              <button
                className="settings-stp-tabs-signout-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowLogoutConfirm(true);
                }}
              >
                Logout
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="settings-stp-page-footer">
          <div className="footer-content">
          </div>
          <button className="settings-stp-page-close-btn" onClick={handleHeaderBack}>
            Close Settings
          </button>
        </div>

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="settings-stp-modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
            <div className="settings-stp-modal" onClick={(e) => e.stopPropagation()}>
              <h2 className="modal-title">Confirm Logout</h2>
              <p className="modal-message">Are you sure you want to log out?</p>
              <div className="modal-buttons">
                <button
                  className="modal-btn modal-cancel-btn"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  className="modal-btn modal-confirm-btn"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    onLogout();
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Individual Settings Page Views
  return (
    <div className="settings-stp-page-container">
      {/* Header */}
      <div className="settings-stp-page-header">
        <button className="settings-stp-back-btn" onClick={handleIndividualHeaderBack}>
          <FiChevronLeft />
          <span>Back</span>
        </button>
        <h1 className="settings-stp-page-title">{renderHeaderTitle()}</h1>
        <div className="settings-stp-header-spacer"></div>
      </div>

      <div className="settings-stp-page-content">
        <div className="settings-stp-page-body">
          
          {currentPage === 'notifications' && <NotificationsTab settings={settings} handleToggle={handleToggle} showSavedMessage={showSavedMessage} />}
          {currentPage === 'privacy' && <PrivacyTab settings={settings} handleToggle={handleToggle} showSavedMessage={showSavedMessage} />}
          {currentPage === 'preferences' && <PreferencesTab settings={settings} handleSelectChange={handleSelectChange} handleToggle={handleToggle} showSavedMessage={showSavedMessage} />}
          {currentPage === 'account' && <AccountTab showConfirmDelete={showConfirmDelete} setShowConfirmDelete={setShowConfirmDelete} handleDeleteAccount={handleDeleteAccount} />}
          {currentPage === 'help' && <HelpTab onViewFaq={() => setCurrentPage('faq')} />}
          {currentPage === 'faq' && <FaqTab onBack={() => setCurrentPage('help')} />}
          {currentPage === 'feedback' && <FeedbackTab setHeaderTitle={setHeaderOverride} />}
          {currentPage === 'agreement' && <AgreementTab onBack={() => setCurrentPage('main')} />}
          {currentPage === 'usage' && <UsagePolicy onBack={() => setCurrentPage('main')} />}
          {currentPage === 'apps' && <AppsTab />}

        </div>
      </div>

      {/* Footer */}
      <div className="settings-stp-page-footer">
        <div className="footer-content">
        </div>
        <button className="settings-stp-page-close-btn" onClick={handleHeaderBack}>
          Close Settings
        </button>
      </div>
    </div>
  );
}

export default SettingsPage;
