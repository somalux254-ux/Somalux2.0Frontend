export const parseTimestamp = (ts) => {
  if (!ts) {
    return new Date(); // Fallback to current time
  }

  // Firestore Timestamp object
  if (typeof ts === 'object' && (ts._seconds !== undefined || ts.seconds !== undefined)) {
    const seconds = ts._seconds ?? ts.seconds;
    const nanos = ts._nanoseconds ?? ts.nanoseconds ?? 0;
    const date = new Date(seconds * 1000 + nanos / 1e6);
    if (isNaN(date.getTime())) {
      return new Date();
    }
    return date;
  }

  // Already a Date
  if (ts instanceof Date) {
    if (isNaN(ts.getTime())) {
      return new Date();
    }
    return ts;
  }

  // Milliseconds (number)
  if (typeof ts === 'number') {
    const date = new Date(ts);
    if (isNaN(date.getTime())) {
      return new Date();
    }
    return date;
  }

  // ISO string
  if (typeof ts === 'string') {
    const parsed = new Date(ts);
    if (!isNaN(parsed.getTime())) return parsed;
    return new Date();
  }

  return new Date();
};