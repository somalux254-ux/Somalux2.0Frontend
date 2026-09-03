// Firestore removed - privacy settings disabled
// TODO: Migrate to Supabase when needed

export const PRIVACY_FIELDS = [
  'lastSeen',
  'profilePhotoVisibility',
  'aboutVisibility',
  'statusVisibility',
  'groupPrivacy',
  'readReceipts',
  'blockedContacts',
  'mutedContacts',
];

const CACHE_KEY = 'myPrivacyCache';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; } 
}

function writeCache(obj) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...obj, __updatedAt: Date.now() }));
  } catch {}
}

function emitPrivacyUpdated(detail) {
  try {
    window.dispatchEvent(new CustomEvent('privacy:updated', { detail }));
  } catch {}
}

export async function loadMyPrivacy({ preferCache = true } = {}) {
  // Firestore removed
  const cached = readCache();
  return cached || null;
}

export async function savePrivacySetting(key, value) {
  // Firestore removed - local cache only
  if (!PRIVACY_FIELDS.includes(key)) throw new Error('Invalid privacy field');
  const cached = readCache() || {};
  const next = { ...cached, [key]: value };
  writeCache(next);
  emitPrivacyUpdated({ key, value, all: next });
}

export async function resetPrivacyToDefaults() {
  // Firestore removed - local cache only
  const defaults = {
    lastSeen: 'everyone',
    profilePhotoVisibility: 'everyone',
    aboutVisibility: 'everyone',
    statusVisibility: 'contacts',
    groupPrivacy: 'contacts',
    readReceipts: true,
  };
  writeCache(defaults);
  emitPrivacyUpdated({ reset: true, all: defaults });
}

// Firestore removed - live sync not available
let liveUnsub = null;
export function ensurePrivacyLiveSync() {
  // Live sync disabled
  return null;
}
