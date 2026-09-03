import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { FiSend, FiFileText, FiHistory } from 'react-icons/fi';
import { MdEmail } from 'react-icons/md';
import { API_URL } from '../../../../config';
import './SendEmails.css';

const NOTIFICATION_TYPES = [
  { value: 'update', label: 'System Update', color: '#3498db' },
  { value: 'new_feature', label: 'New Feature', color: '#2ecc71' },
  { value: 'system_downtime', label: 'System Downtime', color: '#e74c3c' },
  { value: 'congratulation', label: 'Congratulation', color: '#f39c12' },
  { value: 'general', label: 'General Message', color: '#95a5a6' },
];

const RECIPIENT_TYPES = [
  { value: 'all_users', label: 'All Users' },
  { value: 'by_role', label: 'By Role (Admin, Editor, etc)' },
  { value: 'by_tier', label: 'By Subscription Tier' },
  { value: 'specific_users', label: 'Specific Users (Enter emails)' },
];

const EMAIL_TEMPLATES = [
  {
    id: 'template_update',
    category: 'update',
    name: 'System Update',
    subject: 'Important System Update - Somalux',
    body: 'Dear User,\n\nWe are excited to announce an important update to Somalux:\n\n{{update_details}}\n\nThis update improves your experience and adds new capabilities.\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_feature',
    category: 'new_feature',
    name: 'New Feature Announcement',
    subject: '🎉 New Feature Available - Somalux',
    body: 'Dear User,\n\nWe are thrilled to introduce a new feature to Somalux:\n\n{{feature_description}}\n\nYou can start using it today!\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_downtime',
    category: 'system_downtime',
    name: 'Scheduled Downtime',
    subject: '⚠️ Scheduled System Maintenance - Somalux',
    body: 'Dear User,\n\nWe will be performing scheduled maintenance on:\n\nDate: {{maintenance_date}}\nTime: {{maintenance_time}}\nExpected Duration: {{duration}}\n\nDuring this time, Somalux may be unavailable.\n\nWe apologize for any inconvenience.\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_congrats',
    category: 'congratulation',
    name: 'Congratulations',
    subject: '🎊 Congratulations! - Somalux',
    body: 'Dear {{user_name}},\n\nWe want to congratulate you on {{achievement}}!\n\nYour dedication and contributions are greatly appreciated.\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_security',
    category: 'update',
    name: 'Security Alert',
    subject: '🔒 Important Security Alert - Somalux',
    body: 'Dear User,\n\nFor your account security, we need to inform you about:\n\n{{security_details}}\n\nAction Required: {{required_action}}\n\nIf you did not perform this action, please contact our support team immediately.\n\nBest regards,\nThe Somalux Security Team',
  },
  {
    id: 'template_policy',
    category: 'update',
    name: 'Policy Update',
    subject: '📋 Important Policy Update - Somalux',
    body: 'Dear User,\n\nWe are updating our policies to better serve you:\n\n{{policy_details}}\n\nEffective Date: {{effective_date}}\n\nPlease review the updated terms at your earliest convenience.\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_promotion',
    category: 'new_feature',
    name: 'Special Offer',
    subject: '🎁 Exclusive Offer Just for You - Somalux',
    body: 'Dear {{user_name}},\n\nWe have a special offer exclusively for you:\n\n{{offer_details}}\n\nDiscount Code: {{discount_code}}\nValid Until: {{expiration_date}}\n\nDon\'t miss out on this exclusive opportunity!\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_welcome',
    category: 'congratulation',
    name: 'Welcome New User',
    subject: '👋 Welcome to Somalux!',
    body: 'Dear {{user_name}},\n\nWelcome to Somalux! We are thrilled to have you join our community.\n\nHere are some resources to get you started:\n{{getting_started_tips}}\n\nIf you have any questions, our support team is here to help.\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_bug_fix',
    category: 'update',
    name: 'Bug Fix Release',
    subject: '🐛 Bug Fix Release - Somalux',
    body: 'Dear User,\n\nWe have released a bug fix to improve your experience:\n\n{{bug_details}}\nFix Description: {{fix_description}}\n\nThis fix has been deployed to all systems.\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_performance',
    category: 'update',
    name: 'Performance Update',
    subject: '⚡ Performance Improvements - Somalux',
    body: 'Dear User,\n\nWe have made significant performance improvements:\n\n{{performance_details}}\n\nYou should notice faster load times and smoother operations.\n\nThank you for your patience!\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_emergency',
    category: 'system_downtime',
    name: 'Emergency Notice',
    subject: '🚨 Emergency Alert - Somalux',
    body: 'Dear User,\n\nThis is an urgent emergency notice:\n\n{{emergency_details}}\n\nAction Required: {{action_required}}\n\nPlease take immediate action to protect your account.\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_announcement',
    category: 'general',
    name: 'General Announcement',
    subject: '📢 Important Announcement - Somalux',
    body: 'Dear User,\n\nWe have an important announcement to share:\n\n{{announcement_details}}\n\nFor more information: {{info_link}}\n\nThank you for being part of our community!\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_survey',
    category: 'general',
    name: 'Feedback Survey',
    subject: '📝 We Value Your Feedback - Somalux',
    body: 'Dear {{user_name}},\n\nWe would love to hear your thoughts about Somalux!\n\nPlease take a few minutes to complete our survey:\n{{survey_link}}\n\nYour feedback helps us improve the platform.\n\nThank you!\nThe Somalux Team',
  },
  {
    id: 'template_verification',
    category: 'update',
    name: 'Account Verification',
    subject: '✅ Verify Your Account - Somalux',
    body: 'Dear {{user_name}},\n\nPlease verify your account to complete the setup:\n\nVerification Code: {{verification_code}}\n\nOr click here: {{verification_link}}\n\nThis code expires in {{expiration_time}}.\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_password_reset',
    category: 'update',
    name: 'Password Reset',
    subject: '🔐 Password Reset Request - Somalux',
    body: 'Dear {{user_name}},\n\nWe received a request to reset your password.\n\nReset Link: {{reset_link}}\n\nThis link expires in {{expiration_time}}.\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_content',
    category: 'new_feature',
    name: 'New Content Available',
    subject: '📚 New Content Available - Somalux',
    body: 'Dear {{user_name}},\n\nNew content has been added to Somalux:\n\n{{content_title}}\n{{content_description}}\n\nView Now: {{content_link}}\n\nHappy learning!\nThe Somalux Team',
  },
  {
    id: 'template_event',
    category: 'congratulation',
    name: 'Event Notification',
    subject: '🎪 Upcoming Event - Somalux',
    body: 'Dear {{user_name}},\n\nWe are hosting an exciting event:\n\nEvent: {{event_name}}\nDate: {{event_date}}\nTime: {{event_time}}\nLocation: {{event_location}}\n\nRegister Now: {{registration_link}}\n\nWe look forward to seeing you!\nThe Somalux Team',
  },
  {
    id: 'template_milestone',
    category: 'congratulation',
    name: 'Milestone Celebration',
    subject: '🏆 You\'ve Reached a Milestone! - Somalux',
    body: 'Dear {{user_name}},\n\nCongratulations! You\'ve reached {{milestone}}!\n\n{{milestone_details}}\n\nKeep up the great work!\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_subscription',
    category: 'update',
    name: 'Subscription Renewal',
    subject: '💳 Subscription Renewal Reminder - Somalux',
    body: 'Dear {{user_name}},\n\nYour subscription will renew on {{renewal_date}}.\n\nSubscription Plan: {{plan_name}}\nAmount: {{amount}}\n\nManage Subscription: {{manage_link}}\n\nIf you have questions, contact our support team.\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_resources',
    category: 'general',
    name: 'Help & Resources',
    subject: '❓ Help & Resources - Somalux',
    body: 'Dear {{user_name}},\n\nWe\'ve compiled helpful resources for you:\n\n{{resources_list}}\n\nOur Knowledge Base: {{kb_link}}\nContact Support: {{support_link}}\n\nWe\'re here to help!\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_report',
    category: 'update',
    name: 'Monthly Report',
    subject: '📊 Your Monthly Report - Somalux',
    body: 'Dear {{user_name}},\n\nHere\'s your activity report for {{month}}:\n\n{{report_summary}}\n\nView Full Report: {{report_link}}\n\nWe appreciate your continued engagement!\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_guidelines',
    category: 'update',
    name: 'Community Guidelines',
    subject: '📖 Community Guidelines Update - Somalux',
    body: 'Dear User,\n\nWe\'ve updated our community guidelines to ensure a positive environment:\n\n{{guidelines_summary}}\n\nRead Full Guidelines: {{guidelines_link}}\n\nThank you for helping keep our community great!\n\nBest regards,\nThe Somalux Team',
  },
  {
    id: 'template_data_retention',
    category: 'update',
    name: 'Data Retention Notice',
    subject: '📋 Data Retention Notice - Somalux',
    body: 'Dear User,\n\nThis is to inform you about our data retention policy:\n\n{{retention_details}}\n\nFor more information: {{privacy_link}}\n\nIf you have concerns, please contact us.\n\nBest regards,\nThe Somalux Team',
  },
];

const SendEmails = () => {
  const [tabValue, setTabValue] = useState(0);

  // Form states for sending emails
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [notificationType, setNotificationType] = useState('general');
  const [recipientType, setRecipientType] = useState('all_users');
  const [recipientRole, setRecipientRole] = useState('admin');
  const [recipientTier, setRecipientTier] = useState('premium');
  const [specificEmails, setSpecificEmails] = useState('');
  const [tags, setTags] = useState([]);
  const [isUrgent, setIsUrgent] = useState(false);

  // UI states
  const [loading, setLoading] = useState(false);
  const [message_notification, setMessageNotification] = useState('');
  const [notificationType_ui, setNotificationTypeUI] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // History states
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationStats, setNotificationStats] = useState({});

  // User selection states
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Fetch notifications on mount or when tab changes
  useEffect(() => {
    if (tabValue === 2) {
      fetchNotifications();
      fetchStats();
    }
  }, [tabValue]);

  // Fetch users when specific_users is selected
  useEffect(() => {
    if (recipientType === 'specific_users' && availableUsers.length === 0) {
      fetchAvailableUsers();
    }
  }, [recipientType]);

  // Fetch notification history
  const fetchNotifications = async () => {
    setNotificationsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/notifications?limit=50`);
      const data = await response.json();
      if (data.success) {
        setNotifications(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  // Fetch notification statistics
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/notification-stats`);
      const data = await response.json();
      if (data.success) {
        setNotificationStats(data.stats || {});
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Fetch available users from database
  const fetchAvailableUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/users`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success && Array.isArray(data.users)) {
        setAvailableUsers(data.users);
        console.log('✅ Loaded', data.users.length, 'users');
      } else {
        console.warn('No users returned from API');
        setAvailableUsers([]);
      }
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      setMessageNotification('Failed to load users: ' + error.message);
      setNotificationTypeUI('error');
      setAvailableUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  // Handle user selection
  const handleUserSelect = (userId, email) => {
    setSelectedUsers((prev) => {
      const isSelected = prev.find((u) => u.id === userId);
      if (isSelected) {
        return prev.filter((u) => u.id !== userId);
      } else {
        return [...prev, { id: userId, email }];
      }
    });
  };

  // Check if user is selected
  const isUserSelected = (userId) => {
    return selectedUsers.some((u) => u.id === userId);
  };

  // Filter users based on search query
  const filteredUsers = availableUsers.filter((user) => {
    const searchLower = userSearchQuery.toLowerCase();
    const userName = (user.full_name || user.email.split('@')[0]).toLowerCase();
    const userEmail = user.email.toLowerCase();
    return userName.includes(searchLower) || userEmail.includes(searchLower);
  });

  // Handle select all
  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length && filteredUsers.length > 0) {
      // Deselect all
      setSelectedUsers([]);
    } else {
      // Select all filtered users
      const allFilteredUserIds = filteredUsers.map((user) => ({
        id: user.id,
        email: user.email,
      }));
      setSelectedUsers(allFilteredUserIds);
    }
  };

  // Apply template
  const applyTemplate = (template) => {
    setTitle(template.subject);
    setMessage(template.body);
    setNotificationType(template.category);
    setSelectedTemplate(template);
    setTabValue(0); // Switch back to compose tab
  };

  // Validate form
  const validateForm = () => {
    if (!title.trim()) {
      setMessageNotification('Title is required');
      setNotificationTypeUI('error');
      return false;
    }
    if (!message.trim()) {
      setMessageNotification('Message is required');
      setNotificationTypeUI('error');
      return false;
    }
    if (recipientType === 'specific_users' && selectedUsers.length === 0) {
      setMessageNotification('Please select at least one user');
      setNotificationTypeUI('error');
      return false;
    }
    return true;
  };

  // Handle send email
  const handleSendEmail = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setMessageNotification('');

    try {
      // Prepare recipient list
      let recipientFilter = {};
      let recipientsList = [];

      if (recipientType === 'by_role') {
        recipientFilter = { role: recipientRole };
      } else if (recipientType === 'by_tier') {
        recipientFilter = { tier: recipientTier };
      } else if (recipientType === 'specific_users') {
        recipientsList = selectedUsers.map((user) => ({ email: user.email }));
      }

      const payload = {
        title: title.trim(),
        message: message.trim(),
        notificationType,
        recipientType,
        recipientFilter,
        recipientsList,
        adminName: 'Admin', // You can replace with actual admin name
        adminEmail: 'admin@somalux.com',
        tags,
        isUrgent,
      };

      const response = await fetch(`${API_URL}/api/admin/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        setMessageNotification(
          `✅ Email sent successfully to ${data.recipientCount} recipient(s)!`
        );
        setNotificationTypeUI('success');

        // Reset form
        setTimeout(() => {
          setTitle('');
          setMessage('');
          setNotificationType('general');
          setRecipientType('all_users');
          setSpecificEmails('');
          setTags([]);
          setIsUrgent(false);
          setSelectedTemplate(null);
        }, 2000);

        // Refresh history
        fetchNotifications();
      } else {
        setMessageNotification(`❌ Error: ${data.error}`);
        setNotificationTypeUI('error');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      setMessageNotification(`❌ Failed to send email: ${error.message}`);
      setNotificationTypeUI('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="send-emails-container">
      <Box className="analytics-header">
        <h1>📧 Email Notifications & Communication Center</h1>
        <p>Send system updates, feature announcements, and messages to users</p>
      </Box>

      <Tabs
        value={tabValue}
        onChange={(e, newValue) => setTabValue(newValue)}
        className="send-emails-tabs"
      >
        <Tab label="📧 Compose" />
        <Tab label="📋 Templates" />
        <Tab label="📜 History" />
      </Tabs>

      {/* TAB 0: Compose Email */}
      {tabValue === 0 && (
        <Box className="send-emails-content">
          <Card className="send-emails-card">
            <CardContent>
              <h2>New Notification</h2>

              {message_notification && (
                <Alert severity={notificationType_ui} style={{ marginBottom: '20px' }}>
                  {message_notification}
                </Alert>
              )}

              {selectedTemplate && (
                <Alert severity="info" style={{ marginBottom: '20px' }}>
                  Using template: <strong>{selectedTemplate.name}</strong>
                </Alert>
              )}

              {/* Three-Column Layout: Notification Type, Recipient Type, and Select Role */}
              <Box className="form-row-three">
                <Box className="form-group">
                  <label>Notification Type *</label>
                  <FormControl fullWidth>
                    <Select
                      value={notificationType}
                      onChange={(e) => setNotificationType(e.target.value)}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '&:hover fieldset': { borderColor: '#3498db' },
                        },
                      }}
                    >
                      {NOTIFICATION_TYPES.map((type) => (
                        <MenuItem key={type.value} value={type.value}>
                          {type.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <Box className="form-group">
                  <label>Who should receive this? *</label>
                  <FormControl fullWidth>
                    <Select
                      value={recipientType}
                      onChange={(e) => setRecipientType(e.target.value)}
                    >
                      {RECIPIENT_TYPES.map((type) => (
                        <MenuItem key={type.value} value={type.value}>
                          {type.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                {recipientType === 'by_role' && (
                  <Box className="form-group">
                    <label>Select Role</label>
                    <FormControl fullWidth>
                      <Select
                        value={recipientRole}
                        onChange={(e) => setRecipientRole(e.target.value)}
                      >
                        <MenuItem value="admin">Admin</MenuItem>
                        <MenuItem value="editor">Editor</MenuItem>
                        <MenuItem value="viewer">Viewer</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                )}

                {recipientType === 'by_tier' && (
                  <Box className="form-group">
                    <label>Select Subscription Tier</label>
                    <FormControl fullWidth>
                      <Select
                        value={recipientTier}
                        onChange={(e) => setRecipientTier(e.target.value)}
                      >
                        <MenuItem value="free">Free</MenuItem>
                        <MenuItem value="premium">Premium</MenuItem>
                        <MenuItem value="enterprise">Enterprise</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                )}

                {recipientType === 'specific_users' && (
                  <Box className="form-group">
                    <label>Select Users *</label>
                    {usersLoading ? (
                      <Box style={{ padding: '8px', textAlign: 'center' }}>
                        <CircularProgress size={20} />
                      </Box>
                    ) : availableUsers.length === 0 ? (
                      <Box style={{ padding: '8px', color: '#8696a0', fontSize: '12px' }}>
                        No users found
                      </Box>
                    ) : (
                      <Box>
                        {/* Search Input + Select All Row */}
                        <Box style={{
                          display: 'flex',
                          gap: '12px',
                          marginBottom: '8px',
                          alignItems: 'center'
                        }}>
                          {/* Search Input */}
                          <TextField
                            placeholder="Search..."
                            value={userSearchQuery}
                            onChange={(e) => setUserSearchQuery(e.target.value)}
                            size="small"
                            sx={{
                              width: '330px',
                              '& .MuiOutlinedInput-root': {
                                borderRadius: '6px',
                                color: '#e9edef',
                                backgroundColor: '#0b1216',
                                '& fieldset': { borderColor: '#4a5a68' },
                                '&:hover fieldset': { borderColor: '#5a6b78' },
                              },
                              '& .MuiOutlinedInput-input::placeholder': {
                                color: '#8696a0',
                                opacity: 1,
                              },
                            }}
                          />

                          {/* Select All / Deselect All */}
                          <Box
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer',
                            }}
                            onClick={handleSelectAll}
                          >
                            <Checkbox
                              checked={
                                filteredUsers.length > 0 &&
                                selectedUsers.length === filteredUsers.length
                              }
                              indeterminate={
                                selectedUsers.length > 0 &&
                                selectedUsers.length < filteredUsers.length
                              }
                              onChange={handleSelectAll}
                              size="small"
                              style={{ margin: 0 }}
                            />
                            <span style={{ color: '#b4d7cc', fontSize: '12px', fontWeight: '500' }}>
                              All
                            </span>
                          </Box>
                        </Box>

                        {/* Users List */}
                        <Box style={{
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                          borderRadius: '6px',
                          maxHeight: '200px',
                          width: '390px',
                          overflowY: 'auto',
                          backgroundColor: '#1a2328'
                        }}>
                          {filteredUsers.length === 0 && userSearchQuery && (
                            <Box
                              style={{
                                padding: '8px',
                                color: '#8696a0',
                                fontSize: '12px',
                                textAlign: 'center',
                              }}
                            >
                              No users match your search
                            </Box>
                          )}
                          {filteredUsers.map((user) => (
                            <Box
                              key={user.id}
                              style={{
                                padding: '6px 8px',
                                borderBottom: '1px solid #0f1b20',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                backgroundColor: isUserSelected(user.id) ? '#1a3a3a' : 'transparent'
                              }}
                              onClick={() => handleUserSelect(user.id, user.email)}
                            >
                              <Checkbox
                                checked={isUserSelected(user.id)}
                                onChange={() => handleUserSelect(user.id, user.email)}
                                size="small"
                                style={{ margin: 0, marginRight: '2px' }}
                              />
                              
                              {/* Compact Avatar */}
                              <Box
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  backgroundColor: user.avatar_url ? 'transparent' : '#4a5a68',
                                  backgroundImage: user.avatar_url ? `url(${user.avatar_url})` : 'none',
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  color: '#e9edef'
                                }}
                              >
                                {!user.avatar_url && (user.full_name || user.email).charAt(0).toUpperCase()}
                              </Box>
                              
                              {/* Compact User Info */}
                              <Box style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  color: '#e9edef',
                                  fontSize: '11px',
                                  fontWeight: '500',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {user.full_name || user.email.split('@')[0]}
                                </div>
                                <div style={{
                                  color: '#8696a0',
                                  fontSize: '10px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {user.email}
                                </div>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>

              <Box className="form-group">
                <label>Subject/Title *</label>
                <TextField
                  fullWidth
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Important System Update"
                  multiline
                  rows={1}
                  variant="outlined"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
              </Box>

              <Box className="form-group">
                <label>Message Body *</label>
                <TextField
                  fullWidth
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your message here. Use {{variable}} for placeholders"
                  multiline
                  rows={20}
                  variant="outlined"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
                />
                <small style={{ color: '#666', marginTop: '5px' }}>
                  Tip: Use {`{{username}}`}, {`{{date}}`}, etc. for dynamic content
                </small>
              </Box>

              <Box className="form-group">
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isUrgent}
                        onChange={(e) => setIsUrgent(e.target.checked)}
                      />
                    }
                    label="🔴 Mark as Urgent (highlights in red)"
                  />
                </FormGroup>
              </Box>

              <Box className="form-group">
                <label>Tags (for organization)</label>
                <TextField
                  fullWidth
                  value={tags.join(', ')}
                  onChange={(e) =>
                    setTags(
                      e.target.value
                        .split(',')
                        .map((tag) => tag.trim())
                        .filter((tag) => tag.length > 0)
                    )
                  }
                  placeholder="e.g., maintenance, feature, urgent"
                  helperText="Separate with commas"
                />
              </Box>

              <Box className="form-actions">
                <Button
                  variant="contained"
                  onClick={() => setPreviewOpen(true)}
                  sx={{
                    backgroundColor: '#95a5a6',
                    '&:hover': { backgroundColor: '#7f8c8d' }
                  }}
                >
                  Preview Email
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSendEmail}
                  disabled={loading}
                  sx={{
                    backgroundColor: '#00a884',
                    '&:hover': { backgroundColor: '#009670' }
                  }}
                >
                  {loading ? (
                    <>
                      <CircularProgress size={20} style={{ marginRight: '10px' }} />
                      Sending...
                    </>
                  ) : (
                    <>
                      <FiSend style={{ marginRight: '8px' }} />
                      Send Email
                    </>
                  )}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* TAB 1: Templates */}
      {tabValue === 1 && (
        <Box className="send-emails-content">
          <Box style={{ marginBottom: '20px' }}>
            <h2>Email Templates</h2>
            <p>Choose a template to quickly compose your email</p>
          </Box>

          <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '15px' }}>
            {EMAIL_TEMPLATES.map((template) => (
              <Card key={template.id} className="template-card">
                <CardContent>
                  <h3>{template.name}</h3>
                  <p style={{ color: '#666', fontSize: '13px', marginBottom: '10px' }}>
                    {template.subject}
                  </p>
                  <Box style={{ marginBottom: '10px' }}>
                    <Chip label={template.category} size="small" color="primary" variant="outlined" />
                  </Box>
                  <Button
                    variant="contained"
                    onClick={() => applyTemplate(template)}
                    sx={{
                      backgroundColor: '#1a7a9f',
                      width: '100%',
                      '&:hover': { backgroundColor: '#2a9bb8' }
                    }}
                  >
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {/* TAB 2: History */}
      {tabValue === 2 && (
        <Box className="send-emails-content">
          <Box style={{ marginBottom: '20px' }}>
            <h2>Notification History</h2>
            <Box style={{ display: 'flex', gap: '15px', marginTop: '15px', flexWrap: 'wrap' }}>
              <Card style={{ padding: '15px', flex: 1, minWidth: '150px', background: 'linear-gradient(135deg, #111b21 0%, #0f1b20 100%)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)' }}>
                <h4 style={{ margin: 0, color: '#34B7F1', fontSize: '20px' }}>{notificationStats.total || 0}</h4>
                <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#b4d7cc' }}>Total Sent</p>
              </Card>
              <Card style={{ padding: '15px', flex: 1, minWidth: '150px', background: 'linear-gradient(135deg, #111b21 0%, #0f1b20 100%)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)' }}>
                <h4 style={{ margin: 0, color: '#2ecc71', fontSize: '20px' }}>{notificationStats.sent || 0}</h4>
                <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#b4d7cc' }}>Successfully Sent</p>
              </Card>
              <Card style={{ padding: '15px', flex: 1, minWidth: '150px', background: 'linear-gradient(135deg, #111b21 0%, #0f1b20 100%)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)' }}>
                <h4 style={{ margin: 0, color: '#e74c3c', fontSize: '20px' }}>{notificationStats.failed || 0}</h4>
                <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#b4d7cc' }}>Failed</p>
              </Card>
            </Box>
          </Box>

          {notificationsLoading ? (
            <Box style={{ textAlign: 'center', padding: '40px' }}>
              <CircularProgress />
            </Box>
          ) : notifications.length === 0 ? (
            <Alert severity="info">No notifications sent yet</Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead style={{ backgroundColor: '#f5f5f5' }}>
                  <TableRow>
                    <TableCell><strong>Type</strong></TableCell>
                    <TableCell><strong>Subject</strong></TableCell>
                    <TableCell><strong>Recipients</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Sent</strong></TableCell>
                    <TableCell><strong>Date</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {notifications.map((notif) => (
                    <TableRow key={notif.id} hover>
                      <TableCell>
                        <Chip
                          label={notif.notification_type}
                          size="small"
                          variant="outlined"
                          style={{
                            borderColor: NOTIFICATION_TYPES.find(
                              (t) => t.value === notif.notification_type
                            )?.color,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <strong>{notif.title}</strong>
                        <br />
                        <small style={{ color: '#999' }}>{notif.recipient_type}</small>
                      </TableCell>
                      <TableCell>{notif.recipient_count}</TableCell>
                      <TableCell>
                        <Chip
                          label={notif.status}
                          size="small"
                          color={
                            notif.status === 'sent'
                              ? 'success'
                              : notif.status === 'failed'
                              ? 'error'
                              : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {notif.sent_count}/{notif.recipient_count}
                      </TableCell>
                      <TableCell style={{ fontSize: '12px' }}>
                        {new Date(notif.created_at).toLocaleDateString()}
                        <br />
                        {new Date(notif.created_at).toLocaleTimeString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Email Preview</DialogTitle>
        <DialogContent>
          <Box style={{ marginTop: '15px' }}>
            <Box style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#666' }}>
                <strong>From:</strong> Somalux &lt;admin@somalux.com&gt;
              </p>
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#666' }}>
                <strong>Subject:</strong> {title || '(No subject)'}
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                <strong>Recipients:</strong> {recipientType === 'all_users' ? 'All Users' : recipientType}
              </p>
            </Box>

            <Box style={{ padding: '15px', backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '8px' }}>
              <p style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px' }}>
                {message || '(Empty message)'}
              </p>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SendEmails;
