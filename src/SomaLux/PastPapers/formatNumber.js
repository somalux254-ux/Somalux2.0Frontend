/**
 * Format large numbers with K suffix (like X.com)
 * Examples:
 * - 500 -> "500"
 * - 1000 -> "1K"
 * - 1500 -> "1.5K"
 * - 10000 -> "10K"
 * - 1500000 -> "1.5M"
 */
export function formatNumber(num) {
  if (!num || num < 1000) {
    return String(num || 0);
  }

  if (num < 1000000) {
    // Format as K (thousands)
    const k = num / 1000;
    return k % 1 !== 0 ? k.toFixed(1) + 'K' : k.toFixed(0) + 'K';
  }

  // Format as M (millions)
  const m = num / 1000000;
  return m % 1 !== 0 ? m.toFixed(1) + 'M' : m.toFixed(0) + 'M';
}
