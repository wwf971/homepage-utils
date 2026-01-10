/**
 * Format timestamp to YYYYMMDD_HHMMSSss+TZ format
 */
export const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';
  
  try {
    // Handle MongoDB date object format
    let dateValue = timestamp;
    
    // If it's an object with $date property (MongoDB extended JSON format)
    if (typeof timestamp === 'object' && timestamp.$date) {
      dateValue = timestamp.$date;
    }
    
    // Convert to number if it's a string
    if (typeof dateValue === 'string') {
      dateValue = Number(dateValue);
    }
    
    // Handle microseconds (16 digits) - convert to milliseconds
    if (typeof dateValue === 'number' && dateValue > 1e15) {
      dateValue = Math.floor(dateValue / 1000); // Convert microseconds to milliseconds
    }
    
    const date = new Date(dateValue);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp value:', timestamp, 'Type:', typeof timestamp);
      return 'Invalid date';
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(2, '0').substring(0, 2);
    
    // Get timezone offset in format +HH or -HH
    const tzOffset = -date.getTimezoneOffset();
    const tzHours = Math.floor(Math.abs(tzOffset) / 60);
    const tzSign = tzOffset >= 0 ? '+' : '-';
    const tzString = `${tzSign}${String(tzHours).padStart(2, '0')}`;
    
    return `${year}${month}${day}_${hours}${minutes}${seconds}${milliseconds}${tzString}`;
  } catch (e) {
    console.error('Error formatting timestamp:', e, 'Value:', timestamp);
    return 'Invalid date';
  }
};

/**
 * Format file size in bytes to human-readable format
 */
export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

