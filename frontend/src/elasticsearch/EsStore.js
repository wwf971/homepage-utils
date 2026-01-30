import { atom } from 'jotai';
import { getBackendServerUrl } from '../remote/dataStore';

/**
 * Elasticsearch and Mongo-Index unified cache store
 * 
 * Manages local cache for:
 * - Pure Elasticsearch indices
 * - Mongo-Index entries (ES indices with MongoDB collection monitoring)
 * 
 * All indices are stored in a unified atom with isMongoIndex flag
 */

// ========== Cache TTLs ==========
const INDICES_CACHE_TTL = 60000; // 1 minute
const INDEX_INFO_CACHE_TTL = 300000; // 5 minutes

// ========== Index Atoms - Individual atom per index ==========
/**
 * Map of index name -> atom for that specific index
 * Each index atom stores:
 * - name: string (ES index name)
 * - isMongoIndex: boolean
 * - mongoData: { name, esIndex, collections } (only if isMongoIndex=true)
 * - timestamp: number (for cache TTL)
 * - ...other ES-specific metadata
 */
export const esIndexAtoms = new Map();

/**
 * Get or create atom for a specific index
 */
export function getIndexAtom(indexName) {
  if (!esIndexAtoms.has(indexName)) {
    esIndexAtoms.set(indexName, atom(null));
  }
  return esIndexAtoms.get(indexName);
}

/**
 * Delete atom for a specific index (for garbage collection)
 */
export function deleteEsIndexAtom(indexName) {
  esIndexAtoms.delete(indexName);
}

// ========== Index Names List Atom ==========
/**
 * Lightweight atom storing just the list of index names
 * This is separate from the individual index atoms for better performance
 */
export const esIndexNamesAtom = atom([]);
export const esIndexNamesTimestampAtom = atom(0);

// ========== Loading and Error State Atoms ==========
export const esIndicesLoadingAtom = atom(false);
export const esIndicesErrorAtom = atom(null);

// ========== Per-Index Info Cache Atoms ==========
/**
 * Map of index name -> atom for that index's detailed info
 * Each atom stores: { data, timestamp }
 */
export const esIndexInfoAtoms = new Map();

/**
 * Get or create info atom for a specific index
 */
export function getIndexInfoAtom(indexName) {
  if (!esIndexInfoAtoms.has(indexName)) {
    esIndexInfoAtoms.set(indexName, atom(null));
  }
  return esIndexInfoAtoms.get(indexName);
}

/**
 * Delete info atom for a specific index (for garbage collection)
 */
export function deleteEsIndexAtom(indexName) {
  esIndexInfoAtoms.delete(indexName);
}

// ========== Document Atoms - Individual atom per document ==========
/**
 * Map of "indexName:docId" -> atom for that specific document
 * Each document atom stores:
 * - _id: string
 * - _source: object (document content)
 * - timestamp: number (for cache TTL)
 * - ...other ES document metadata
 */
export const esDocAtoms = new Map();

/**
 * Get or create atom for a specific document
 */
export function getDocAtom(indexName, docId) {
  const key = `${indexName}:${docId}`;
  if (!esDocAtoms.has(key)) {
    esDocAtoms.set(key, atom(null));
  }
  return esDocAtoms.get(key);
}

/**
 * Delete atom for a specific document (for garbage collection)
 */
export function deleteDocAtom(indexName, docId) {
  const key = `${indexName}:${docId}`;
  esDocAtoms.delete(key);
}

/**
 * Delete all document atoms for an index (when index is deleted)
 */
export function deleteAllDocAtomsForIndex(indexName) {
  const keysToDelete = [];
  for (const key of esDocAtoms.keys()) {
    if (key.startsWith(`${indexName}:`)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => esDocAtoms.delete(key));
}

// ========== Document List Atoms (per index) ==========
/**
 * Map of indexName -> atom for document IDs list
 * Stores: { docIds: string[], total: number, page: number, pageSize: number, timestamp: number }
 */
export const esDocListAtoms = new Map();

/**
 * Get or create document list atom for an index
 */
export function getDocListAtom(indexName) {
  if (!esDocListAtoms.has(indexName)) {
    esDocListAtoms.set(indexName, atom({ docIds: [], total: 0, page: 1, pageSize: 20, timestamp: 0 }));
  }
  return esDocListAtoms.get(indexName);
}

/**
 * Delete document list atom for an index (for garbage collection)
 */
export function deleteDocListAtom(indexName) {
  esDocListAtoms.delete(indexName);
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(timestamp, ttl) {
  if (!timestamp) return false;
  return Date.now() - timestamp < ttl;
}

/**
 * Fetch all Elasticsearch indices from ES server (pure ES indices only)
 * @returns {Promise<{code: number, data?: Array, message?: string}>}
 */
async function fetchPureEsIndices() {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/elasticsearch/indices/list`);
    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, data: result.data || [] };
    }
    return { code: -1, message: result.message || 'Failed to fetch ES indices' };
  } catch (error) {
    console.error('Failed to fetch Elasticsearch indices:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch all mongo-index entries from MongoDB
 * @returns {Promise<{code: number, data?: Array, message?: string}>}
 */
async function fetchMongoIndexEntries() {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/mongo-index/list`);
    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, data: result.data || [] };
    }
    return { code: -1, message: result.message || 'Failed to fetch mongo indices' };
  } catch (error) {
    console.error('Failed to fetch mongo indices:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch all indices (both pure ES and mongo-indices) and merge them
 * Populates individual atoms for each index
 * 
 * @param {boolean} forceRefresh - If true, bypass cache and fetch from server
 * @param {Function} getAtomValue - Jotai getter function (from useAtomValue)
 * @param {Function} setAtomValue - Jotai setter function (from useSetAtom)
 * @returns {Promise<{code: number, data?: Array, message?: string}>}
 */
export async function fetchAllEsIndices(forceRefresh = false, getAtomValue = null, setAtomValue = null) {
  // If we have getter/setter, check cache (check the names list cache)
  if (!forceRefresh && getAtomValue && setAtomValue) {
    const cachedNames = getAtomValue(esIndexNamesAtom);
    const cachedTimestamp = getAtomValue(esIndexNamesTimestampAtom);
    
    if (cachedNames.length > 0 && isCacheValid(cachedTimestamp, INDICES_CACHE_TTL)) {
      // Return cached indices by reading individual atoms
      const cachedIndices = cachedNames.map(name => {
        const indexAtom = getIndexAtom(name);
        return getAtomValue(indexAtom);
      }).filter(Boolean);
      
      return { code: 0, data: cachedIndices };
    }
  }

  // Fetch from both sources
  try {
    const [esResult, mongoResult] = await Promise.all([
      fetchPureEsIndices(),
      fetchMongoIndexEntries()
    ]);

    // Handle ES indices
    const esIndices = esResult.code === 0 ? esResult.data : [];
    
    // Handle mongo-index entries
    const mongoIndices = mongoResult.code === 0 ? mongoResult.data : [];
    
    // Create a map of ES index name (lowercase) -> mongo-index data
    // Use lowercase for case-insensitive matching since ES index names are case-insensitive
    const mongoIndexMap = new Map();
    mongoIndices.forEach(mi => {
      if (mi.esIndex) {
        const lowerCaseEsIndex = mi.esIndex.toLowerCase();
        mongoIndexMap.set(lowerCaseEsIndex, mi);
      }
    });

    // Create a Set of ES index names (lowercase) for quick lookup
    const esIndexNamesSet = new Set(
      esIndices.map(esIndex => {
        const name = typeof esIndex === 'string' ? esIndex : esIndex.name;
        return name.toLowerCase();
      })
    );

    // Merge: mark ES indices that are mongo-indices
    const mergedIndices = esIndices.map(esIndex => {
      const indexName = typeof esIndex === 'string' ? esIndex : esIndex.name;
      const mongoData = mongoIndexMap.get(indexName.toLowerCase());
      
      const indexData = {
        name: indexName,
        isMongoIndex: !!mongoData,
        mongoData: mongoData || null,
        timestamp: Date.now(),
        ...(typeof esIndex === 'object' ? esIndex : {})
      };
      
      // Store in individual atom
      if (setAtomValue) {
        const indexAtom = getIndexAtom(indexName);
        setAtomValue(indexAtom, indexData);
      }
      
      return indexData;
    });

    // Add mongo-index entries whose ES indices don't exist yet
    // Use case-insensitive comparison
    mongoIndices.forEach(mi => {
      if (mi.esIndex && !esIndexNamesSet.has(mi.esIndex.toLowerCase())) {
        const indexData = {
          name: mi.esIndex,
          isMongoIndex: true,
          mongoData: mi,
          timestamp: Date.now(),
          esIndexMissing: true  // Flag to indicate ES index doesn't exist
        };
        
        // Store in individual atom
        if (setAtomValue) {
          const indexAtom = getIndexAtom(mi.esIndex);
          setAtomValue(indexAtom, indexData);
        }
        
        mergedIndices.push(indexData);
      }
    });

    // Update names list cache
    if (setAtomValue) {
      const indexNames = mergedIndices.map(idx => idx.name);
      setAtomValue(esIndexNamesAtom, indexNames);
      setAtomValue(esIndexNamesTimestampAtom, Date.now());
    }

    return { code: 0, data: mergedIndices };
  } catch (error) {
    console.error('Failed to fetch all indices:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Legacy function name for backwards compatibility
 * @deprecated Use fetchAllEsIndices instead
 */
export async function fetchEsIndices(forceRefresh = false) {
  return fetchAllEsIndices(forceRefresh);
}

/**
 * Fetch information about a specific Elasticsearch index (with cache)
 * @param {string} indexName - Name of the index
 * @param {boolean} forceRefresh - If true, bypass cache and fetch from server
 * @param {Function} getAtomValue - Jotai getter function
 * @param {Function} setAtomValue - Jotai setter function
 */
export async function fetchEsIndexInfo(indexName, forceRefresh = false, getAtomValue = null, setAtomValue = null) {
  // Check cache first - read from individual atom
  if (!forceRefresh && getAtomValue && setAtomValue) {
    const infoAtom = getIndexInfoAtom(indexName);
    const cached = getAtomValue(infoAtom);
    
    if (cached && isCacheValid(cached.timestamp, INDEX_INFO_CACHE_TTL)) {
      return { code: 0, data: cached.data };
    }
  }

  // Fetch from server
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/elasticsearch/indices/${encodeURIComponent(indexName)}`);
    const result = await response.json();
    
    if (result.code === 0) {
      // Update cache in individual atom
      if (setAtomValue) {
        const infoAtom = getIndexInfoAtom(indexName);
        setAtomValue(infoAtom, {
          data: result.data,
          timestamp: Date.now()
        });
      }
      
      return { code: 0, data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to fetch index info' };
  } catch (error) {
    console.error('Failed to fetch Elasticsearch index info:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Delete an Elasticsearch index
 * @param {string} indexName - Name of the index to delete
 * @param {Function} setAtomValue - Jotai setter function (optional)
 * @param {Function} getAtomValue - Jotai getter function (optional)
 */
export async function deleteElasticsearchIndex(indexName, setAtomValue = null, getAtomValue = null) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/elasticsearch/indices/${encodeURIComponent(indexName)}/delete`, {
      method: 'DELETE'
    });
    const result = await response.json();
    
    if (result.code === 0) {
      // Garbage collect all atoms related to this index
      deleteEsIndexAtom(indexName);
      deleteEsIndexAtom(indexName);
      deleteAllDocAtomsForIndex(indexName);
      deleteDocListAtom(indexName);
      
      // Remove from index names list
      if (setAtomValue && getAtomValue) {
        const currentNames = getAtomValue(esIndexNamesAtom) || [];
        setAtomValue(esIndexNamesAtom, currentNames.filter(name => name !== indexName));
        setAtomValue(esIndexNamesTimestampAtom, Date.now());
      }
      
      return { code: 0, message: result.message || 'Index deleted successfully' };
    }
    return { code: -1, message: result.message || 'Failed to delete index' };
  } catch (error) {
    console.error('Failed to delete Elasticsearch index:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Rename an Elasticsearch index
 * @param {string} oldName - Current name of the index
 * @param {string} newName - New name for the index
 * @param {Function} setAtomValue - Jotai setter function (optional)
 * @param {Function} getAtomValue - Jotai getter function (optional)
 */
export async function renameEsIndex(oldName, newName, setAtomValue = null, getAtomValue = null) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/elasticsearch/indices/${encodeURIComponent(oldName)}/rename/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ newName })
    });
    const result = await response.json();
    
    if (result.code === 0) {
      // Garbage collect all atoms related to old index
      deleteEsIndexAtom(oldName);
      deleteEsIndexAtom(oldName);
      deleteAllDocAtomsForIndex(oldName);
      deleteDocListAtom(oldName);
      
      // Also delete atoms for new name in case they exist
      deleteEsIndexAtom(newName);
      deleteEsIndexAtom(newName);
      deleteAllDocAtomsForIndex(newName);
      deleteDocListAtom(newName);
      
      // Update index names list: replace old with new
      if (setAtomValue && getAtomValue) {
        const currentNames = getAtomValue(esIndexNamesAtom) || [];
        const updatedNames = currentNames.map(name => name === oldName ? newName : name);
        setAtomValue(esIndexNamesAtom, updatedNames);
        
        // Create atom for the new index
        const indexAtom = getIndexAtom(newName);
        setAtomValue(indexAtom, {
          name: newName,
          isMongoIndex: false,
          timestamp: Date.now()
        });
        
        setAtomValue(esIndexNamesTimestampAtom, Date.now());
      }
      
      return { code: 0, message: result.message || 'Index renamed successfully' };
    }
    return { code: -1, message: result.message || 'Failed to rename index' };
  } catch (error) {
    console.error('Failed to rename Elasticsearch index:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Create a new Elasticsearch index
 * @param {string} indexName - Name of the index to create
 * @param {object} body - Index body (settings and mappings)
 * @param {Function} setAtomValue - Jotai setter function (optional)
 * @param {Function} getAtomValue - Jotai getter function (optional)
 */
export async function createEsIndex(indexName, body = {}, setAtomValue = null, getAtomValue = null) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/elasticsearch/indices/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        indexName,
        body
      })
    });
    const result = await response.json();
    
    if (result.code === 0) {
      // Directly add new index to cache instead of invalidating
      if (setAtomValue && getAtomValue) {
        // Add to index names list
        const currentNames = getAtomValue(esIndexNamesAtom) || [];
        if (!currentNames.includes(indexName)) {
          setAtomValue(esIndexNamesAtom, [...currentNames, indexName]);
        }
        
        // Create individual atom for the new index
        const indexAtom = getIndexAtom(indexName);
        setAtomValue(indexAtom, {
          name: indexName,
          isMongoIndex: false,
          timestamp: Date.now()
        });
        
        // Update timestamp to reflect cache is fresh
        setAtomValue(esIndexNamesTimestampAtom, Date.now());
      }
      return { code: 0, message: result.message || 'Index created successfully' };
    }
    return { code: -1, message: result.message || 'Failed to create index' };
  } catch (error) {
    console.error('Failed to create Elasticsearch index:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Invalidate indices cache (forces a refetch from server)
 * 
 * NOTE: This is rarely needed! Most CRUD operations update the cache directly
 * for instant UI feedback. Only use this if you need to force a full refetch
 * (e.g., after external changes or error recovery).
 * 
 * @param {Function} setAtomValue - Jotai setter function
 * @param {Function} getAtomValue - Jotai getter function
 */
export function invalidateIndicesCache(setAtomValue, getAtomValue = null) {
  if (setAtomValue) {
    // Just reset the timestamp to force refetch
    setAtomValue(esIndexNamesTimestampAtom, 0);
  }
}

/**
 * Invalidate index info cache for a specific index
 * @param {string} indexName - Name of the index
 */
export function invalidateIndexCache(indexName) {
  // Individual atom approach: just delete the atom for garbage collection
  deleteEsIndexAtom(indexName);
}

/**
 * Clear all caches (including garbage collecting all individual atoms)
 * @param {Function} setAtomValue - Jotai setter function
 */
export function clearAllCaches(setAtomValue) {
  if (setAtomValue) {
    setAtomValue(esIndexNamesAtom, []);
    setAtomValue(esIndexNamesTimestampAtom, 0);
  }
  
  // Garbage collect all individual atoms
  esIndexAtoms.clear();
  esIndexInfoAtoms.clear();
  esDocAtoms.clear();
  esDocListAtoms.clear();
}

/**
 * Fetch documents in an Elasticsearch index with pagination
 * Populates individual atoms for each document
 * 
 * @param {string} indexName - Name of the index
 * @param {number} page - Page number (1-based)
 * @param {number} pageSize - Number of documents per page
 * @param {boolean} forceRefresh - If true, bypass cache
 * @param {Function} getAtomValue - Jotai getter function
 * @param {Function} setAtomValue - Jotai setter function
 * @returns {Promise<{code: number, message?: string}>}
 */
export async function fetchEsDocs(indexName, page = 1, pageSize = 20, forceRefresh = false, getAtomValue = null, setAtomValue = null) {
  // Check cache first
  if (!forceRefresh && getAtomValue && setAtomValue) {
    const docListAtom = getDocListAtom(indexName);
    const cachedList = getAtomValue(docListAtom);
    
    if (cachedList.docIds.length > 0 && 
        cachedList.page === page && 
        cachedList.pageSize === pageSize &&
        isCacheValid(cachedList.timestamp, INDICES_CACHE_TTL)) {
      // Cache is valid
      return { code: 0 };
    }
  }

  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/elasticsearch/indices/${encodeURIComponent(indexName)}/docs/?page=${page}&pageSize=${pageSize}`
    );
    const result = await response.json();
    
    if (result.code === 0 && result.data) {
      const documents = result.data.documents || [];
      const docIds = [];
      
      // Populate individual document atoms
      documents.forEach(doc => {
        const docId = doc._id;
        docIds.push(docId);
        
        if (setAtomValue) {
          const docAtom = getDocAtom(indexName, docId);
          setAtomValue(docAtom, {
            ...doc,
            timestamp: Date.now()
          });
        }
      });
      
      // Update document list atom
      if (setAtomValue) {
        const docListAtom = getDocListAtom(indexName);
        setAtomValue(docListAtom, {
          docIds,
          total: result.data.total || 0,
          page: result.data.page || page,
          pageSize: result.data.pageSize || pageSize,
          timestamp: Date.now()
        });
      }
      
      return { code: 0 };
    }
    return { code: -1, message: result.message || 'Failed to fetch documents' };
  } catch (error) {
    console.error('Failed to fetch Elasticsearch documents:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Delete a document from an Elasticsearch index
 * @param {string} indexName - Name of the index
 * @param {string} docId - Document ID
 * @param {Function} setAtomValue - Jotai setter function (optional)
 * @param {Function} getAtomValue - Jotai getter function (optional)
 */
export async function deleteEsDoc(indexName, docId, setAtomValue = null, getAtomValue = null) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/elasticsearch/indices/${encodeURIComponent(indexName)}/docs/${encodeURIComponent(docId)}/delete`,
      {
        method: 'DELETE'
      }
    );
    const result = await response.json();
    
    if (result.code === 0) {
      // Garbage collect document atom
      deleteDocAtom(indexName, docId);
      
      // Remove from document list
      if (setAtomValue && getAtomValue) {
        const docListAtom = getDocListAtom(indexName);
        const currentList = getAtomValue(docListAtom);
        if (currentList && currentList.docIds) {
          setAtomValue(docListAtom, {
            ...currentList,
            docIds: currentList.docIds.filter(id => id !== docId),
            total: Math.max(0, (currentList.total || 0) - 1),
            timestamp: Date.now()
          });
        }
      }
      
      return { code: 0, message: result.message || 'Document deleted successfully' };
    }
    return { code: -1, message: result.message || 'Failed to delete document' };
  } catch (error) {
    console.error('Failed to delete Elasticsearch document:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Create a document in an Elasticsearch index
 * @param {string} indexName - Name of the index
 * @param {object} body - Document body (optional, empty object creates empty doc)
 * @param {Function} setAtomValue - Jotai setter function (optional)
 * @param {Function} getAtomValue - Jotai getter function (optional)
 */
export async function createEsDoc(indexName, body = {}, setAtomValue = null, getAtomValue = null) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/elasticsearch/indices/${encodeURIComponent(indexName)}/docs/create`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body })
      }
    );
    const result = await response.json();
    
    if (result.code === 0 && result.data) {
      const newDoc = result.data;
      const docId = newDoc._id;
      
      // Store the new document in its atom
      if (setAtomValue && docId) {
        const docAtom = getDocAtom(indexName, docId);
        setAtomValue(docAtom, {
          ...newDoc,
          timestamp: Date.now()
        });
      }
      
      // Invalidate document list cache (new doc added)
      if (setAtomValue && getAtomValue) {
        const docListAtom = getDocListAtom(indexName);
        const currentList = getAtomValue(docListAtom);
        setAtomValue(docListAtom, {
          ...currentList,
          timestamp: 0  // Force refresh on next fetch
        });
      }
      
      return { code: 0, docId, message: result.message || 'Document created successfully' };
    }
    return { code: -1, message: result.message || 'Failed to create document' };
  } catch (error) {
    console.error('Failed to create Elasticsearch document:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Search documents in a character-level Elasticsearch index
 * @param {string} indexName - Name of the index
 * @param {object} searchParams - Search parameters
 *   - query: string - Search query
 *   - search_in_paths: boolean - Search in field names
 *   - search_in_values: boolean - Search in field values
 */
export async function searchEsDocs(indexName, searchParams) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/elasticsearch/indices/${encodeURIComponent(indexName)}/search/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(searchParams)
      }
    );
    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, data: result.data };
    }
    return { code: -1, message: result.message || 'Search failed' };
  } catch (error) {
    console.error('Failed to search Elasticsearch documents:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Update a document in an Elasticsearch index (full rewrite)
 * @param {string} indexName - Name of the index
 * @param {string} docId - Document ID
 * @param {object} newDoc - New document content
 * @param {Function} setAtomValue - Jotai setter function (optional)
 */
export async function updateEsDoc(indexName, docId, newDoc, setAtomValue = null) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/elasticsearch/indices/${encodeURIComponent(indexName)}/docs/${encodeURIComponent(docId)}/update`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body: newDoc })
      }
    );
    const result = await response.json();
    
    if (result.code === 0) {
      // Update individual document atom
      if (setAtomValue && result.data) {
        const docAtom = getDocAtom(indexName, docId);
        setAtomValue(docAtom, {
          _id: docId,
          _source: result.data._source || newDoc,
          ...result.data,
          timestamp: Date.now()
        });
      }
      
      return { code: 0, data: result.data, message: result.message || 'Document updated successfully' };
    }
    return { code: -1, message: result.message || 'Failed to update document' };
  } catch (error) {
    console.error('Failed to update Elasticsearch document:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

