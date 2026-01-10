/**
 * mongoUtils.js - Utility functions for MongoDB path handling and document operations
 */

/**
 * Convert JsonComp path format to MongoDB dot notation
 * - "user.name" → "user.name" (unchanged)
 * - "tags..0" → "tags.0"
 * - "items..1.name" → "items.1.name"
 */
export function convertPathToMongoDotNotation(path) {
  return path.replace(/\.\./g, '.');
}

/**
 * Extract document ID string from various MongoDB _id formats
 * Handles: string, {$oid: "..."}, ObjectId with toString()
 */
export function extractDocId(doc) {
  if (!doc || !doc._id) return null;
  
  const id = doc._id;
  
  // Handle string directly
  if (typeof id === 'string') return id;
  
  // Handle {$oid: "..."}
  if (id && typeof id === 'object' && id.$oid) return id.$oid;
  
  // Handle ObjectId with toString method that actually returns the ID
  if (id && typeof id === 'object' && typeof id.toString === 'function') {
    const str = id.toString();
    // Avoid default "[object Object]"
    if (str !== '[object Object]') return str;
  }
  
  return null;
}

/**
 * Parse a path string into uniform segments
 * Each segment is either {type: 'obj', key: string} or {type: 'arr', index: number}
 * 
 * Examples:
 *   "user.name" → [{type: 'obj', key: 'user'}, {type: 'obj', key: 'name'}]
 *   "content..1.key" → [{type: 'obj', key: 'content'}, {type: 'arr', index: 1}, {type: 'obj', key: 'key'}]
 *   "tags..2" → [{type: 'obj', key: 'tags'}, {type: 'arr', index: 2}]
 * 
 * @param {string} path - The path with . and .. separators
 * @returns {Array<{type: 'obj'|'arr', key?: string, index?: number}>} - Array of parsed segments
 */
export function parsePathToSegments(path) {
  const segments = [];
  let i = 0;
  let token = '';
  let expectingArrayIndex = false;
  
  while (i <= path.length) {
    const char = i < path.length ? path[i] : null;
    
    if (char === '.' && i + 1 < path.length && path[i + 1] === '.') {
      // Found ".." - current token is complete, next token will be array index
      if (token) {
        if (expectingArrayIndex) {
          segments.push({type: 'arr', index: parseInt(token)});
        } else {
          segments.push({type: 'obj', key: token});
        }
        token = '';
      }
      expectingArrayIndex = true;
      i += 2; // Skip both dots
    } else if (char === '.') {
      // Found single "." - current token is complete, next token will be object key
      if (token) {
        if (expectingArrayIndex) {
          segments.push({type: 'arr', index: parseInt(token)});
        } else {
          segments.push({type: 'obj', key: token});
        }
        token = '';
      }
      expectingArrayIndex = false;
      i += 1;
    } else if (char === null) {
      // End of path - flush remaining token
      if (token) {
        if (expectingArrayIndex) {
          segments.push({type: 'arr', index: parseInt(token)});
        } else {
          segments.push({type: 'obj', key: token});
        }
      }
      break;
    } else {
      // Regular character - accumulate token
      token += char;
      i += 1;
    }
  }
  
  return segments;
}

/**
 * Navigate to a parent array in a document using a path like "content..1.src..0"
 * Returns the parent array and doesn't include the last index
 * 
 * @param {Object} doc - The document to navigate through
 * @param {string} path - The path with .. separators (e.g., "content..1.src..0")
 * @returns {Array|null} - The parent array, or null if navigation fails
 */
export function navigateToParentArray(doc, path) {
  const parts = path.split('..');
  let current = doc;
  
  // Navigate through all parts except the last one
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    
    if (i === 0 && part) {
      // First part: navigate through object keys
      const objKeys = part.split('.').filter(k => k !== '');
      for (const key of objKeys) {
        current = current[key];
        if (!current) return null;
      }
    } else if (i > 0) {
      // Middle parts: could be "1" or "1.src" (array index followed by object keys)
      const segments = part.split('.');
      
      // First segment is array index
      const arrayIndex = parseInt(segments[0]);
      if (!Array.isArray(current)) return null;
      current = current[arrayIndex];
      if (!current) return null;
      
      // Remaining segments are object keys
      for (let j = 1; j < segments.length; j++) {
        const key = segments[j];
        if (key) {
          current = current[key];
          if (!current) return null;
        }
      }
    }
  }
  
  return Array.isArray(current) ? current : null;
}

/**
 * Check if a path ends with an array index (e.g., "tags..0" or "content..1.src..2")
 * Returns true if the last separator in the path is ".." (array index)
 * Returns false if the last separator is "." (object key) or if there's no separator
 * 
 * Examples:
 *   "tags..0" → true (array item)
 *   "content..1.src" → false (object property)
 *   "content..1.src..2" → true (array item)
 *   "user.name" → false (object property)
 * 
 * @param {string} path - The path to check
 * @returns {boolean} - True if path ends with array index
 */
export function isPathToArrayItem(path) {
  if (!path) return false;
  const lastDot = path.lastIndexOf('.');
  return lastDot > 0 && path[lastDot - 1] === '.';
}

