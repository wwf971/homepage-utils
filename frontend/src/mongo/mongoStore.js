/**
 * mongoStore.js - MongoDB CRUD operations and database/collection management
 * 
 * Contains:
 * - Basic CRUD functions for MongoDB documents (update, delete, create, etc.)
 * - Database and collection listing and searching
 * - Path format conversion utilities
 * 
 * Note: useMongoDocEditor hook is in mongoEdit.js
 */

import { convertPathToMongoDotNotation } from '../../../../2025/react-comp-misc/src/layout/json/pathUtils';
import { getBackendServerUrl } from '../remote/dataStore';

// Re-export useMongoDocEditor from mongoEdit.js for backwards compatibility
export { useMongoDocEditor } from './mongoEdit';

/**
 * Update a field value in a MongoDB document
 * 
 * @param {string} database - Database name
 * @param {string} collection - Collection name
 * @param {string} docId - Document _id
 * @param {string} path - Field path in JsonComp format
 * @param {any} value - New value
 * @returns {Promise<{code: number, message?: string, data?: any}>}
 */
export async function updateDocField(database, collection, docId, path, value) {
  try {
    const mongoPath = convertPathToMongoDotNotation(path);
    
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'setValue',
          path: mongoPath,
          value: value
        })
      }
    );

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Field updated successfully', data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to update field' };
  } catch (error) {
    console.error('Failed to update document field:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Replace multiple fields in a MongoDB document at once (useful for root-level operations)
 * 
 * @param {string} database - Database name
 * @param {string} collection - Collection name
 * @param {string} docId - Document _id
 * @param {Object} fields - Fields to replace (excluding _id)
 * @returns {Promise<{code: number, message?: string, data?: any}>}
 */
export async function replaceDocFields(database, collection, docId, fields) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'replaceFields',
          path: '',
          value: fields
        })
      }
    );

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Fields replaced successfully', data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to replace fields' };
  } catch (error) {
    console.error('Failed to replace document fields:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Delete a field from a MongoDB document
 * 
 * @param {string} database - Database name
 * @param {string} collection - Collection name
 * @param {string} docId - Document _id
 * @param {string} path - Field path in JsonComp format
 * @returns {Promise<{code: number, message?: string, data?: any}>}
 */
export async function deleteDocField(database, collection, docId, path) {
  try {
    const mongoPath = convertPathToMongoDotNotation(path);
    
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'deleteField',
          path: mongoPath
        })
      }
    );

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Field deleted successfully', data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to delete field' };
  } catch (error) {
    console.error('Failed to delete document field:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Create a new field in a MongoDB document with optional ordering
 * 
 * @param {string} database - Database name
 * @param {string} collection - Collection name
 * @param {string} docId - Document _id
 * @param {string} path - Field path in JsonComp format (parent path)
 * @param {string} key - New field key
 * @param {any} value - New field value
 * @param {Object} currentDoc - Current document for reconstructing with correct order
 * @param {number} insertIndex - Index where to insert the new field (0-based)
 * @param {boolean} respectIndex - Whether to preserve field order (default: false, appends to end)
 * @returns {Promise<{code: number, message?: string, data?: any}>}
 */
export async function createDocField(database, collection, docId, path, key, value, currentDoc = null, insertIndex = -1, respectIndex = false) {
  try {
    // If we need to respect insertion order
    if (respectIndex && insertIndex >= 0 && currentDoc) {
      // Get the parent object from current document
      let parentObj = currentDoc;
      if (path) {
        const pathParts = path.split('.').filter(p => p !== '');
        for (const part of pathParts) {
          parentObj = parentObj[part];
        }
      }
      
      // Reconstruct object with new field at correct index
      const orderedObj = {};
      const entries = Object.entries(parentObj).filter(([k]) => !k.startsWith('__pseudo__'));
      
      let currentIndex = 0;
      for (const [k, v] of entries) {
        if (currentIndex === insertIndex) {
          orderedObj[key] = value;
        }
        orderedObj[k] = v;
        currentIndex++;
      }
      
      // If insertIndex is at the end or beyond
      if (insertIndex >= entries.length) {
        orderedObj[key] = value;
      }
      
      // For root-level (empty path), we need to merge with the entire document
      // For nested paths, we can replace just that object
      let finalPath, finalValue;
      if (!path || path === '') {
        // Root level - use special handling or just add the field normally
        // Since MongoDB doesn't allow empty path for $set, fall back to simple $set with the key
        finalPath = convertPathToMongoDotNotation(key);
        finalValue = value;
        console.warn('Root-level ordered insert not fully supported by MongoDB - using simple $set');
      } else {
        // Nested path - replace the parent object
        finalPath = convertPathToMongoDotNotation(path);
        finalValue = orderedObj;
      }
      
      // Replace the entire parent object (or use simple $set for root)
      const backendUrl = getBackendServerUrl();
    const response = await fetch(
        `${backendUrl}/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'setValue',
            path: finalPath,
            value: finalValue
          })
        }
      );

      const result = await response.json();
      
      if (result.code === 0) {
        return { code: 0, message: 'Field created successfully', data: result.data };
      }
      return { code: -1, message: result.message || 'Failed to create field' };
    } else {
      // No ordering needed - simple $set (appends to end)
      const fullPath = path ? `${path}.${key}` : key;
      const mongoPath = convertPathToMongoDotNotation(fullPath);
      
      const backendUrl = getBackendServerUrl();
    const response = await fetch(
        `${backendUrl}/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'setValue',
            path: mongoPath,
            value: value
          })
        }
      );

      const result = await response.json();
      
      if (result.code === 0) {
        return { code: 0, message: 'Field created successfully', data: result.data };
      }
      return { code: -1, message: result.message || 'Failed to create field' };
    }
  } catch (error) {
    console.error('Failed to create document field:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Add an item to an array in a MongoDB document
 * 
 * @param {string} database - Database name
 * @param {string} collection - Collection name
 * @param {string} docId - Document _id
 * @param {string} arrayPath - Array path in JsonComp format (e.g., "tags" or "user.roles")
 * @param {any} value - Value to add
 * @param {number} position - Position to insert at (optional, defaults to end)
 * @returns {Promise<{code: number, message?: string, data?: any}>}
 */
export async function addArrayItem(database, collection, docId, arrayPath, value, position = -1) {
  try {
    const mongoPath = convertPathToMongoDotNotation(arrayPath);
    
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'addArrayItem',
          path: mongoPath,
          value: value,
          position: position
        })
      }
    );

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Array item added successfully', data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to add array item' };
  } catch (error) {
    console.error('Failed to add array item:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Remove an item from an array in a MongoDB document
 * 
 * @param {string} database - Database name
 * @param {string} collection - Collection name
 * @param {string} docId - Document _id
 * @param {string} path - Full path including array index (e.g., "tags..0" or "items..1.name")
 * @returns {Promise<{code: number, message?: string, data?: any}>}
 */
export async function removeArrayItem(database, collection, docId, path) {
  try {
    const mongoPath = convertPathToMongoDotNotation(path);
    
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'removeArrayItem',
          path: mongoPath
        })
      }
    );

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Array item removed successfully', data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to remove array item' };
  } catch (error) {
    console.error('Failed to remove array item:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * List all databases in the MongoDB instance
 * Cached to avoid repeated calls
 * 
 * @returns {Promise<{code: number, data?: string[], message?: string}>}
 */
let databaseListCache = null;
let databaseListTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds

export async function listDatabases() {
  try {
    // Return cached result if fresh
    const now = Date.now();
    if (databaseListCache && (now - databaseListTimestamp) < CACHE_DURATION) {
      return { code: 0, data: databaseListCache };
    }

    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo/db/`);
    const result = await response.json();
    
    if (result.code === 0) {
      databaseListCache = result.data;
      databaseListTimestamp = now;
      return { code: 0, data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to list databases' };
  } catch (error) {
    console.error('Failed to list databases:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * List all collections in a database
 * Cached per database to avoid repeated calls
 * 
 * @param {string} databaseName - Database name
 * @returns {Promise<{code: number, data?: string[], message?: string}>}
 */
const collectionListCache = new Map();
const collectionListTimestamps = new Map();

export async function listCollections(databaseName) {
  try {
    if (!databaseName) {
      return { code: -1, message: 'Database name is required' };
    }

    // Return cached result if fresh
    const now = Date.now();
    const cached = collectionListCache.get(databaseName);
    const timestamp = collectionListTimestamps.get(databaseName) || 0;
    
    if (cached && (now - timestamp) < CACHE_DURATION) {
      return { code: 0, data: cached };
    }

    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo/db/${encodeURIComponent(databaseName)}/coll/`);
    const result = await response.json();
    
    if (result.code === 0) {
      collectionListCache.set(databaseName, result.data);
      collectionListTimestamps.set(databaseName, now);
      return { code: 0, data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to list collections' };
  } catch (error) {
    console.error('Failed to list collections:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Search databases by query string (client-side filtering)
 * 
 * @param {string} query - Search query
 * @returns {Promise<{code: number, data?: string[], message?: string}>}
 */
export async function searchDatabases(query) {
  const result = await listDatabases();
  if (result.code !== 0) {
    return result;
  }
  
  if (!query || query.trim() === '') {
    return { code: 0, data: result.data };
  }
  
  const lowerQuery = query.toLowerCase();
  const filtered = result.data.filter(db => db.toLowerCase().includes(lowerQuery));
  return { code: 0, data: filtered };
}

/**
 * Search collections by query string (client-side filtering)
 * 
 * @param {string} databaseName - Database name
 * @param {string} query - Search query
 * @returns {Promise<{code: number, data?: string[], message?: string}>}
 */
export async function searchCollections(databaseName, query) {
  const result = await listCollections(databaseName);
  if (result.code !== 0) {
    return result;
  }
  
  if (!query || query.trim() === '') {
    return { code: 0, data: result.data };
  }
  
  const lowerQuery = query.toLowerCase();
  const filtered = result.data.filter(coll => coll.toLowerCase().includes(lowerQuery));
  return { code: 0, data: filtered };
}

/**
 * Custom hook for editing MongoDB documents
 * 
 * @param {string} database - Database name
 * @param {string} collection - Collection name
 * @param {Object} document - The document being edited
 * @returns {Object} { handleChange, isUpdating }
 */
