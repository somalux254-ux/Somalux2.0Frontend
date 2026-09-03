export const parseTimestamp = (ts) => {
  if (!ts) {
    console.warn('parseTimestamp: No timestamp provided, using current time as fallback', { ts });
    return new Date(); // Fallback to current time
  }

  // Firestore Timestamp object
  if (typeof ts === 'object' && (ts._seconds !== undefined || ts.seconds !== undefined)) {
    const seconds = ts._seconds ?? ts.seconds;
    const nanos = ts._nanoseconds ?? ts.nanoseconds ?? 0;
    const date = new Date(seconds * 1000 + nanos / 1e6);
    if (isNaN(date.getTime())) {
      console.warn('parseTimestamp: Invalid Firestore timestamp, using current time', { ts });
      return new Date();
    }
    return date;
  }

  // Already a Date
  if (ts instanceof Date) {
    if (isNaN(ts.getTime())) {
      console.warn('parseTimestamp: Invalid Date object, using current time', { ts });
      return new Date();
    }
    return ts;
  }

  // Milliseconds (number)
  if (typeof ts === 'number') {
    const date = new Date(ts);
    if (isNaN(date.getTime())) {
      console.warn('parseTimestamp: Invalid number timestamp, using current time', { ts });
      return new Date();
    }
    return date;
  }

  // ISO string
  if (typeof ts === 'string') {
    const parsed = new Date(ts);
    if (!isNaN(parsed.getTime())) return parsed;
    console.warn('parseTimestamp: Failed to parse string timestamp, using current time', { ts });
    return new Date();
  }

  console.warn('parseTimestamp: Invalid timestamp format, using current time', { ts });
  return new Date();
};