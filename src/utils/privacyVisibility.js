// Simple visibility helpers for privacy-controlled fields
// Usage: pass the target user's privacy object and whether the viewer is a contact

export function canViewField(privacy = {}, field, isContact = false) {
  const rule = (privacy && privacy[field]) ?? 'everyone';
  if (rule === 'everyone') return true;
  if (rule === 'contacts') return !!isContact;
  if (rule === 'nobody') return false;
  // boolean fields like readReceipts are not processed here
  return true;
}

export function getMaskedProfilePhoto(photoURL, privacy = {}, isContact = false) {
  return canViewField(privacy, 'profilePhotoVisibility', isContact) ? photoURL : null;
}

export function allowLastSeen(privacy = {}, isContact = false) {
  return canViewField(privacy, 'lastSeen', isContact);
}

export function allowAbout(privacy = {}, isContact = false) {
  return canViewField(privacy, 'aboutVisibility', isContact);
}

export function allowStatus(privacy = {}, isContact = false) {
  return canViewField(privacy, 'statusVisibility', isContact);
}
