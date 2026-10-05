
// Format group ID into a valid topic
export const getGroupTopic = (groupId) => `group_${groupId.replace(/[^a-zA-Z0-9-]/g, '_')}`;

// Subscribe to group notifications (via backend)
export const subscribeToGroupTopic = async (groupId) => {
  try {
    // TODO: Implement via backend/Supabase instead of FCM
  } catch (error) {
  }
};

// Unsubscribe from group notifications
// Cloud Messaging removed - endpoint disabled
export const unsubscribeFromGroupTopic = async (groupId) => {
  try {
  } catch (error) {
  }
};