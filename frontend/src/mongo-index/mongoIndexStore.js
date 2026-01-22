/**
 * mongoIndexStore.js - Mongo-Index system API calls and state management
 * 
 * Contains:
 * - Mongo-Index atoms and state management
 * - CRUD functions for mongo-index operations
 * - Index listing and management
 * - Caching for index data
 */

import { atom } from 'jotai';
import { getBackendServerUrl } from '../remote/backendServerStore';

// ========== Mongo-Index State Atoms ==========
export const mongoIndicesAtom = atom([]);
export const mongoIndicesLoadingAtom = atom(false);
export const mongoIndicesErrorAtom = atom(null);

// ========== Mongo-Index API Functions ==========

/**
 * Fetch all mongo indices
 */
export async function fetchMongoIndices() {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo-index/list`);
    const result = await response.json();
    
    if (result.code === 0 && result.data) {
      return { code: 0, data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to fetch indices' };
  } catch (error) {
    console.error('Failed to fetch mongo indices:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Create a new mongo index
 * 
 * @param {string} name - Index name
 * @param {string} esIndex - Elasticsearch index name
 * @param {Array} collections - Array of {database, collection} objects
 * @returns {Promise<{code: number, message?: string, data?: any}>}
 */
export async function createMongoIndex(name, esIndex, collections) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo-index/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name.trim(),
        esIndex: esIndex.trim(),
        collections: collections.filter(c => c.database && c.collection)
      })
    });
    
    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: result.message || 'Index created successfully', data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to create index' };
  } catch (error) {
    console.error('Failed to create mongo index:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Update an existing mongo index
 * 
 * @param {string} indexName - Index name
 * @param {Object} updates - Updates object {esIndex?, collections?}
 * @returns {Promise<{code: number, message?: string, data?: any}>}
 */
export async function updateMongoIndex(indexName, updates) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo-index/${encodeURIComponent(indexName)}/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    
    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: result.message || 'Index updated successfully', data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to update index' };
  } catch (error) {
    console.error('Failed to update mongo index:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Delete a mongo index
 * 
 * @param {string} indexName - Index name
 * @returns {Promise<{code: number, message?: string}>}
 */
export async function deleteMongoIndex(indexName) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo-index/${encodeURIComponent(indexName)}/delete`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: result.message || 'Index deleted successfully' };
    }
    return { code: -1, message: result.message || 'Failed to delete index' };
  } catch (error) {
    console.error('Failed to delete mongo index:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Get indices monitoring a specific collection
 * 
 * @param {string} dbName - Database name
 * @param {string} collName - Collection name
 * @returns {Promise<{code: number, data?: string[], message?: string}>}
 */
export async function getIndicesOfCollection(dbName, collName) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/mongo-index/db/${encodeURIComponent(dbName)}/coll/${encodeURIComponent(collName)}/index/list`
    );
    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, data: Array.from(result.data || []) };
    }
    return { code: -1, message: result.message || 'Failed to get indices' };
  } catch (error) {
    console.error('Failed to get indices of collection:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Delete a collection using mongo-index API (also removes from indices)
 * 
 * @param {string} dbName - Database name
 * @param {string} collName - Collection name
 * @returns {Promise<{code: number, message?: string}>}
 */
export async function deleteCollectionWithIndex(dbName, collName) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/mongo-index/db/${encodeURIComponent(dbName)}/coll/${encodeURIComponent(collName)}/delete`,
      { method: 'DELETE' }
    );
    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: result.message || 'Collection deleted successfully' };
    }
    return { code: -1, message: result.message || 'Failed to delete collection' };
  } catch (error) {
    console.error('Failed to delete collection with index:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}
