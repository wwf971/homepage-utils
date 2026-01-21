/**
 * mongoStore.js - MongoDB CRUD operations and database/collection management
 * 
 * Contains:
 * - MongoDB atoms and state management
 * - Basic CRUD functions for MongoDB documents (update, delete, create, etc.)
 * - Database and collection listing and searching
 * - Path format conversion utilities
 * 
 * Note: useMongoDocEditor hook is in mongoEdit.js
 */

import { atom } from 'jotai';
import { convertPathToMongoDotNotation } from '../../../../2025/react-comp-misc/src/layout/json/pathUtils';
import { getBackendServerUrl } from '../remote/backendServerStore';

// Re-export useMongoDocEditor from mongoEdit.js for backwards compatibility
export { useMongoDocEditor } from './mongoEdit';

// ========== MongoDB Configuration Atoms ==========
export const mongoAppConfigAtom = atom([]);
export const mongoLocalConfigAtom = atom([]);
export const mongoRemoteConfigAtom = atom([]);
export const mongoRemoteSettingsAtom = atom({});
export const mongoComputedConfigAtom = atom([]);
export const mongoConfigErrorAtom = atom(null);

// ========== MongoDB Databases & Collections Atoms ==========
export const mongoDatabasesAtom = atom([]);
export const mongoSelectedDatabaseAtom = atom(null);
export const mongoCollectionsAtom = atom([]);
export const mongoSelectedCollectionAtom = atom(null);

// ========== MongoDB Documents Atoms ==========
export const mongoDocsAtom = atom([]);
export const mongoDocsPageAtom = atom(1);
export const mongoDocsTotalAtom = atom(0);
export const mongoDocsPageSizeAtom = atom(20);

// ========== MongoDB Configuration API ==========

/**
 * Fetch MongoDB app config (from application.properties)
 */
export async function fetchMongoAppConfig() {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo/config/app/`);
    const result = await response.json();
    if (result.code === 0 && result.data) {
      const configArray = Object.entries(result.data).map(([key, value]) => ({
        key: key,
        value: String(value)
      }));
      return { code: 0, data: configArray };
    }
    return { code: -1, message: result.message || 'Invalid response' };
  } catch (error) {
    console.log('[ERROR]Failed to fetch MongoDB app config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch MongoDB local config from SQLite
 */
export async function fetchMongoLocalConfig() {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/local_config/category/mongo/`);
    const result = await response.json();
    if (result.code === 0 && result.data) {
      const configArray = Object.entries(result.data).map(([key, value]) => ({
        key: key.replace('mongo.', ''),
        value: String(value)
      }));
      return { code: 0, data: configArray };
    }
    return { code: -1, message: 'Invalid response' };
  } catch (error) {
    console.log('[ERROR]Failed to fetch MongoDB local config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch MongoDB computed config (merged)
 */
export async function fetchMongoComputedConfig() {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo/config/`);
    const result = await response.json();
    if (result.code === 0 && result.data) {
      const configArray = Object.entries(result.data).map(([key, value]) => ({
        key: key,
        value: String(value)
      }));
      
      // Store keys globally for EditableValueComp
      if (!window.__computedConfigKeys) {
        window.__computedConfigKeys = {};
      }
      window.__computedConfigKeys.mongo = configArray.map(item => item.key);
      
      return { code: 0, data: configArray };
    }
    return { code: -1, message: 'Invalid response' };
  } catch (error) {
    console.log('[ERROR]Failed to fetch MongoDB computed config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch MongoDB remote config
 */
export async function fetchMongoRemoteConfig() {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo/remote_config/`);
    const result = await response.json();
    if (result.code === 0 && result.data) {
      const configArray = Object.entries(result.data).map(([key, value]) => ({
        key: key,
        value: String(value)
      }));
      return { code: 0, data: configArray };
    }
    return { code: -1, message: 'Invalid response' };
  } catch (error) {
    console.log('[ERROR]Failed to fetch MongoDB remote config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch MongoDB remote config settings
 */
export async function fetchMongoRemoteSettings() {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo/remote_config/settings/`);
    const result = await response.json();
    if (result.code === 0 && result.data) {
      return { code: 0, data: result.data };
    }
    return { code: -1, message: 'Invalid response' };
  } catch (error) {
    console.log('[ERROR]Failed to fetch MongoDB remote settings:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Update MongoDB remote config setting
 */
export async function updateMongoRemoteSetting(key, value) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo/remote_config/settings/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: key,
        value: value
      })
    });

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Success' };
    }
    return { code: -1, message: result.message || 'Update failed' };
  } catch (error) {
    console.log('[ERROR]Failed to update MongoDB remote setting:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Update MongoDB remote config (saves to MongoDB)
 */
export async function updateMongoRemoteConfig(key, value) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo/remote_config/set/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: key,
        value: value
      })
    });

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Success' };
    }
    return { code: -1, message: result.message || 'Update failed' };
  } catch (error) {
    console.log('[ERROR]Failed to update MongoDB remote config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Update MongoDB config (saves to local override)
 */
export async function updateMongoConfig(key, value) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo/config/set/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: key,
        value: value
      })
    });

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Success' };
    }
    return { code: -1, message: result.message || 'Update failed' };
  } catch (error) {
    console.log('[ERROR]Failed to update MongoDB config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

// ========== MongoDB Database & Collection API ==========

/**
 * Fetch all MongoDB databases
 */
export async function fetchMongoDatabases() {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo/db/`);
    const result = await response.json();
    
    if (result.code === 0 && result.data) {
      return { code: 0, data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to fetch databases' };
  } catch (error) {
    console.log('[ERROR]Failed to fetch MongoDB databases:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch collections in a specific MongoDB database
 */
export async function fetchMongoCollections(databaseName) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo/db/${encodeURIComponent(databaseName)}/coll/`);
    const result = await response.json();
    
    if (result.code === 0 && result.data) {
      return { code: 0, data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to fetch collections' };
  } catch (error) {
    console.log('[ERROR]Failed to fetch MongoDB collections:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Create a new collection in a MongoDB database
 */
export async function createMongoCollection(databaseName, collectionName) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo/db/${encodeURIComponent(databaseName)}/coll/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: collectionName
      })
    });

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: result.message || 'Collection created successfully' };
    }
    return { code: -1, message: result.message || 'Failed to create collection' };
  } catch (error) {
    console.log('[ERROR]Failed to create MongoDB collection:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

// ========== MongoDB Document API ==========

/**
 * Fetch documents in a specific MongoDB collection with pagination
 */
export async function fetchMongoDocuments(databaseName, collectionName, page = 1, pageSize = 20) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/mongo/db/${encodeURIComponent(databaseName)}/coll/${encodeURIComponent(collectionName)}/docs/?page=${page}&pageSize=${pageSize}`
    );
    const result = await response.json();
    
    if (result.code === 0 && result.data) {
      return { 
        code: 0, 
        data: result.data.documents || [], 
        total: result.data.total || 0,
        page: result.data.page || page,
        pageSize: result.data.pageSize || pageSize
      };
    }
    return { code: -1, message: result.message || 'Failed to fetch documents' };
  } catch (error) {
    console.error('Failed to fetch MongoDB documents:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Create an empty document in a MongoDB collection
 */
export async function createMongoDocument(databaseName, collectionName) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/mongo/db/${encodeURIComponent(databaseName)}/coll/${encodeURIComponent(collectionName)}/docs/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, data: result.data, message: result.message || 'Document created successfully' };
    }
    return { code: -1, message: result.message || 'Failed to create document' };
  } catch (error) {
    console.error('Failed to create MongoDB document:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Delete a document from a MongoDB collection
 */
export async function deleteMongoDocument(databaseName, collectionName, docId) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/mongo/db/${encodeURIComponent(databaseName)}/coll/${encodeURIComponent(collectionName)}/docs/${encodeURIComponent(docId)}/`,
      {
        method: 'DELETE'
      }
    );

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: result.message || 'Document deleted successfully' };
    }
    return { code: -1, message: result.message || 'Failed to delete document' };
  } catch (error) {
    console.error('Failed to delete MongoDB document:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

// ========== MongoDB Document Field Operations ==========

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
 * Clear all MongoDB caches
 */
export function clearMongoCache() {
  databaseListCache = null;
  databaseListTimestamp = 0;
  collectionListCache.clear();
  collectionListTimestamps.clear();
  console.log('MongoDB cache cleared');
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
