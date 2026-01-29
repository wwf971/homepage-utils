/**
 * Format timestamp in milliseconds to string format: 20260127_120023+09
 * @param {number} timestampMs - Timestamp in milliseconds
 * @param {number|null} timezoneOffset - Timezone offset in hours (-12 to 12), null means +00
 * @returns {string} Formatted timestamp
 */
export function formatTimestamp(timestampMs, timezoneOffset = null) {
  const offset = timezoneOffset !== null ? timezoneOffset : 0;
  
  // Create date object with timezone offset
  const date = new Date(timestampMs + offset * 60 * 60 * 1000);
  
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  
  const offsetStr = offset >= 0 ? `+${String(offset).padStart(2, '0')}` : String(offset).padStart(3, '0');
  
  return `${year}${month}${day}_${hours}${minutes}${seconds}${offsetStr}`;
}

/**
 * Convert ID value (long) to base36 string (0-9a-z)
 * @param {number} value - 64-bit integer value
 * @returns {string} Base36 representation
 */
export function longToBase36(value) {
  if (value === 0) return '0';
  
  const BASE36_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  let remaining = value;
  
  // Handle negative numbers as unsigned
  if (remaining < 0) {
    remaining = remaining >>> 0; // Convert to unsigned 32-bit
    // For full 64-bit support, we'd need BigInt
    const bigValue = BigInt.asUintN(64, BigInt(value));
    return bigValue.toString(36);
  }
  
  while (remaining > 0) {
    const digit = remaining % 36;
    result = BASE36_CHARS[digit] + result;
    remaining = Math.floor(remaining / 36);
  }
  
  return result;
}

/**
 * Extract timestamp from ms_48 ID
 * @param {number|string} ms48Id - ms_48 ID value (can be number or string)
 * @returns {number} Timestamp in milliseconds
 */
export function extractTimestampMs(ms48Id) {
  // High 48 bits contain the timestamp
  // Use BigInt for proper unsigned 64-bit handling
  const bigId = BigInt.asUintN(64, BigInt(ms48Id));
  const timestampMs = Number(bigId >> 16n);
  return timestampMs;
}
