// Simple global toast bus to trigger toasts from anywhere
// Usage:
//   import { showGlobalToast } from '../utils/toastBus'
//   showGlobalToast({ message, subtext, chatId, senderId, isGroup, type })
// In ELib, register handler:
//   import { setGlobalToastHandler } from '../utils/toastBus'
//   setGlobalToastHandler(showGlobalForegroundToast)

let handler = null;

// Simple TTL cache to dedupe toasts from WS & FCM
const recentToasts = new Map(); // key -> expiresAt
const DEDUPE_WINDOW_MS = 8000;

function buildToastKey(payload) {
  if (!payload || typeof payload !== 'object') return null;
  // Prefer server messageId when available
  if (payload.messageId) return `mid:${payload.messageId}`;
  const chatId = payload.chatId || '';
  const senderId = payload.senderId || '';
  const text = payload.text || payload.subtext || payload.message || '';
  const isGroup = payload.isGroup ? '1' : '0';
  // Round timestamp to 5s buckets to avoid micro-diffs
  const ts = Math.floor(((payload.timestamp || Date.now())) / 5000);
  return `c:${chatId}|s:${senderId}|g:${isGroup}|t:${text.slice(0,40)}|ts:${ts}`;
}

function shouldSuppress(payload) {
  const now = Date.now();
  // Cleanup expired entries
  for (const [k, exp] of recentToasts.entries()) {
    if (exp <= now) recentToasts.delete(k);
  }
  const key = buildToastKey(payload);
  if (!key) return false;
  if (recentToasts.has(key)) return true;
  recentToasts.set(key, now + DEDUPE_WINDOW_MS);
  return false;
}

export const setGlobalToastHandler = (fn) => {
  handler = typeof fn === 'function' ? fn : null;
};

export const showGlobalToast = (payload) => {
  if (shouldSuppress(payload)) {
    return;
  }
  if (handler) {
    try {
      handler(payload);
    } catch (e) {
      // no-op
    }
  } else {
    // No handler registered yet
    // Optionally, queue or log
    // console.debug('Global toast handler not set');
  }
};
