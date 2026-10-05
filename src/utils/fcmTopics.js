
// Format group ID into a valid topic
export const getGroupTopic = (groupId) => `group_${groupId.replace(/[^a-zA-Z0-9-]/g, '_')}`;

// Subscribe to group notifications (via backend)
export const subscribeToGroupTopic = async (groupId) => {
  try {
    const topic = getGroupTopic(groupId);
    // TODO: Implement via backend/Supabase instead of FCM
  } catch (error) {
    console.error('❌ Error subscribing to group topic:', error);
  }
};

// Unsubscribe from group notifications
// Cloud Messaging removed - endpoint disabled
export const unsubscribeFromGroupTopic = async (groupId) => {
  try {
    const topic = getGroupTopic(groupId);
  } catch (error) {
    console.error('❌ Error unsubscribing from group topic:', error);
  }
};