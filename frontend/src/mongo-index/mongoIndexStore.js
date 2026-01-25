/**
 * mongoIndexStore.js - Mongo-Index system API calls
 * 
 * This store extends EsStore with mongo-index specific operations.
 * Mongo-indices are just Elasticsearch indices with additional MongoDB collection monitoring.
 * 
 * The unified cache in EsStore stores all indices (both pure ES and mongo-indices).
 * This file only provides mongo-index specific CRUD operations.
 */

import { 
  fetchAllEsIndices, 
  esIndexAtoms,
  getIndexAtom,
  deleteIndexAtom,
  esIndexNamesAtom,
  esIndexNamesTimestampAtom,
  esIndicesLoadingAtom,
  esIndicesErrorAtom
} from '../elasticsearch/EsStore';
import { atom } from 'jotai';
import { getBackendServerUrl } from '../remote/backendServerStore';

// Re-export for backwards compatibility
export const mongoIndicesLoadingAtom = esIndicesLoadingAtom;
export const mongoIndicesErrorAtom = esIndicesErrorAtom;

// No derived atom needed - just use esIndexNamesAtom directly
// Each wrapper component will check if the index is a mongo-index
// This maintains fine-grained reactivity

// ========== Mongo-Index API Functions ==========

/**
 * Fetch all indices (both ES and mongo-indices)
 * The individual index atoms will be populated by fetchAllEsIndices
 * Components should use mongoIndexNamesAtom to get the filtered list
 * 
 * @param {boolean} forceRefresh - If true, bypass cache
 * @param {Function} getAtomValue - Jotai getter
 * @param {Function} setAtomValue - Jotai setter
 * @returns {Promise<{code: number, message?: string}>}
 */
export async function fetchMongoIndices(forceRefresh = false, getAtomValue = null, setAtomValue = null) {
  // Just fetch all indices - the derived atom will filter for mongo-indices
  const result = await fetchAllEsIndices(forceRefresh, getAtomValue, setAtomValue);
  
  // Return simplified result (no data needed - it's in atoms)
  return { 
    code: result.code, 
    message: result.message 
  };
}

/**
 * Create a new mongo index
 * 
 * @param {string} name - Index name
 * @param {string} esIndex - Elasticsearch index name
 * @param {Array} collections - Array of {database, collection} objects
 * @param {Function} setAtomValue - Jotai setter function (optional)
 * @param {Function} getAtomValue - Jotai getter function (optional)
 * @returns {Promise<{code: number, message?: string, data?: any}>}
 */
export async function createMongoIndex(name, esIndex, collections, setAtomValue = null, getAtomValue = null) {
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
    
    if (result.code === 0 && result.data) {
      // Directly add new mongo-index to cache
      if (setAtomValue && getAtomValue) {
        const esIndexName = result.data.esIndex || esIndex.trim();
        
        // Add ES index name to names list if not already present
        const currentNames = getAtomValue(esIndexNamesAtom) || [];
        if (!currentNames.includes(esIndexName)) {
          setAtomValue(esIndexNamesAtom, [...currentNames, esIndexName]);
        }
        
        // Create/update individual atom for this index
        const indexAtom = getIndexAtom(esIndexName);
        setAtomValue(indexAtom, {
          name: esIndexName,
          isMongoIndex: true,
          mongoData: result.data,
          timestamp: Date.now()
        });
        
        setAtomValue(esIndexNamesTimestampAtom, Date.now());
      }
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
 * @param {Function} setAtomValue - Jotai setter function (optional)
 * @param {Function} getAtomValue - Jotai getter function (optional)
 * @returns {Promise<{code: number, message?: string, data?: any}>}
 */
export async function updateMongoIndex(indexName, updates, setAtomValue = null, getAtomValue = null) {
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
    
    if (result.code === 0 && result.data) {
      // Update the specific ES index atom with new data
      if (getAtomValue && setAtomValue) {
        const esIndexName = result.data.esIndex;
        const indexAtom = getIndexAtom(esIndexName);
        
        setAtomValue(indexAtom, {
          name: esIndexName,
          isMongoIndex: true,
          mongoData: result.data,
          timestamp: Date.now()
        });
        
        setAtomValue(esIndexNamesTimestampAtom, Date.now());
      }
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
 * @param {Function} setAtomValue - Jotai setter function (optional)
 * @param {Function} getAtomValue - Jotai getter function (optional)
 * @returns {Promise<{code: number, message?: string}>}
 */
export async function deleteMongoIndex(indexName, setAtomValue = null, getAtomValue = null) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo-index/${encodeURIComponent(indexName)}/delete`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (result.code === 0) {
      // Find and remove the ES index from cache
      if (getAtomValue && setAtomValue) {
        const allNames = getAtomValue(esIndexNamesAtom) || [];
        let esIndexNameToDelete = null;
        
        // Find the ES index name associated with this mongo-index
        for (const name of allNames) {
          const indexAtom = getIndexAtom(name);
          const indexData = getAtomValue(indexAtom);
          if (indexData?.mongoData?.name === indexName) {
            esIndexNameToDelete = name;
            // Garbage collect the ES index atom
            deleteIndexAtom(name);
            break;
          }
        }
        
        // Remove from names list
        if (esIndexNameToDelete) {
          setAtomValue(esIndexNamesAtom, allNames.filter(name => name !== esIndexNameToDelete));
          setAtomValue(esIndexNamesTimestampAtom, Date.now());
        }
      }
      
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

// ========== Index Stats Cache ==========
const STATS_CACHE_TTL = 30000; // 30 seconds

/**
 * Map of indexName -> atom for stats
 * Each atom stores: { data, timestamp }
 */
export const mongoIndexStatsAtoms = new Map();

/**
 * Get or create stats atom for a specific index
 */
export function getIndexStatsAtom(indexName) {
  if (!mongoIndexStatsAtoms.has(indexName)) {
    mongoIndexStatsAtoms.set(indexName, atom(null));
  }
  return mongoIndexStatsAtoms.get(indexName);
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(timestamp, ttl) {
  if (!timestamp) return false;
  return Date.now() - timestamp < ttl;
}

/**
 * Fetch index stats with cache
 * 
 * @param {string} indexName - Index name
 * @param {boolean} forceRefresh - If true, bypass cache
 * @param {Function} getAtomValue - Jotai getter function
 * @param {Function} setAtomValue - Jotai setter function
 * @returns {Promise<{code: number, data?: any, message?: string}>}
 */
export async function fetchIndexStats(indexName, forceRefresh = false, getAtomValue = null, setAtomValue = null) {
  // Check cache first
  if (!forceRefresh && getAtomValue && setAtomValue) {
    const statsAtom = getIndexStatsAtom(indexName);
    const cached = getAtomValue(statsAtom);
    
    if (cached && isCacheValid(cached.timestamp, STATS_CACHE_TTL)) {
      return { code: 0, data: cached.data };
    }
  }

  // Fetch from server
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo-index/${encodeURIComponent(indexName)}/stats`);
    const result = await response.json();
    
    if (result.code === 0) {
      // Update cache
      if (setAtomValue) {
        const statsAtom = getIndexStatsAtom(indexName);
        setAtomValue(statsAtom, {
          data: result.data,
          timestamp: Date.now()
        });
      }
      
      return { code: 0, data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to fetch stats' };
  } catch (error) {
    console.error('Failed to fetch index stats:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Rebuild index for a specific collection
 * 
 * @param {string} indexName - Index name
 * @param {string} dbName - Database name
 * @param {string} collName - Collection name
 * @param {Integer} maxDocs - Maximum number of documents to rebuild (null for all)
 * @param {Function} setAtomValue - Jotai setter function (optional)
 * @returns {Promise<{code: number, data?: any, message?: string}>}
 */
export async function rebuildIndexForMongoCollection(indexName, dbName, collName, maxDocs = null, setAtomValue = null) {
  try {
    const backendUrl = getBackendServerUrl();
    const url = maxDocs 
      ? `${backendUrl}/mongo-index/${encodeURIComponent(indexName)}/rebuild-collection/${encodeURIComponent(dbName)}/${encodeURIComponent(collName)}?maxDocs=${maxDocs}`
      : `${backendUrl}/mongo-index/${encodeURIComponent(indexName)}/rebuild-collection/${encodeURIComponent(dbName)}/${encodeURIComponent(collName)}`;
    
    const response = await fetch(url, {
      method: 'POST'
    });
    const result = await response.json();
    
    if (result.code === 0) {
      // Invalidate stats cache
      if (setAtomValue) {
        const statsAtom = getIndexStatsAtom(indexName);
        setAtomValue(statsAtom, null);
      }
      
      return { code: 0, data: result.data, message: result.message || 'Collection rebuilt successfully' };
    }
    return { code: -1, message: result.message || 'Failed to rebuild collection' };
  } catch (error) {
    console.error('Failed to rebuild collection:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}
