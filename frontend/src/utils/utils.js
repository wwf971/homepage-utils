/**
 * Get current timezone offset in hours
 * @returns {number} Timezone offset in hours (e.g., -8, 0, 9)
 */
export function getTimezoneInt() {
  const offsetMinutes = new Date().getTimezoneOffset();
  // getTimezoneOffset returns the opposite sign (negative for ahead of UTC)
  return -offsetMinutes / 60;
}

/**
 * Format timestamp to YYYYMMdd_HHmmssMS+TZ format
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @param {number} [timezoneOffset] - Timezone offset in hours (defaults to +00)
 * @returns {string} Formatted time string like "20260202_19382204+00"
 */
export function formatTimestamp(timestamp, timezoneOffset = 0) {
  if (!timestamp) return 'N/A';
  
  // Create date with the specified timezone offset
  const date = new Date(timestamp);
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
  const targetTime = new Date(utcTime + (timezoneOffset * 3600000));
  
  const year = targetTime.getUTCFullYear();
  const month = String(targetTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(targetTime.getUTCDate()).padStart(2, '0');
  const hours = String(targetTime.getUTCHours()).padStart(2, '0');
  const minutes = String(targetTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(targetTime.getUTCSeconds()).padStart(2, '0');
  const ms = String(targetTime.getUTCMilliseconds()).padStart(2, '0').slice(0, 2);
  
  // Format timezone as +HH or -HH
  const tzSign = timezoneOffset >= 0 ? '+' : '';
  const tzFormatted = `${tzSign}${String(Math.floor(timezoneOffset)).padStart(2, '0')}`;
  
  return `${year}${month}${day}_${hours}${minutes}${seconds}${ms}${tzFormatted}`;
}
