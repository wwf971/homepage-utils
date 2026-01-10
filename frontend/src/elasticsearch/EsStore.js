import { getBackendServerUrl } from '../remote/dataStore';

/**
 * Elasticsearch cache store
 * Manages local cache for ES indices and their info to reduce server requests
 */

// Cache structure
const cache = {
  indices: {
    data: null,
    timestamp: null,
    ttl: 60000 // 1 minute
  },
  indexInfo: {}, // { indexName: { data, timestamp } }
  indexInfoTtl: 300000 // 5 minutes for individual index info
};

/**
 * Check if cached data is still valid
 */
function isCacheValid(timestamp, ttl) {
  if (!timestamp) return false;
  return Date.now() - timestamp < ttl;
}

/**
 * Fetch all Elasticsearch indices (with cache)
 * @param {boolean} forceRefresh - If true, bypass cache and fetch from server
 */
export async function fetchElasticsearchIndices(forceRefresh = false) {
  // Check cache first
  if (!forceRefresh && isCacheValid(cache.indices.timestamp, cache.indices.ttl)) {
    return { code: 0, data: cache.indices.data };
  }

  // Fetch from server
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/elasticsearch/indices/`);
    const result = await response.json();
    
    if (result.code === 0) {
      // Update cache
      cache.indices.data = result.data;
      cache.indices.timestamp = Date.now();
      return { code: 0, data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to fetch indices' };
  } catch (error) {
    console.error('Failed to fetch Elasticsearch indices:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch information about a specific Elasticsearch index (with cache)
 * @param {string} indexName - Name of the index
 * @param {boolean} forceRefresh - If true, bypass cache and fetch from server
 */
export async function fetchElasticsearchIndexInfo(indexName, forceRefresh = false) {
  // Check cache first
  const cached = cache.indexInfo[indexName];
  if (!forceRefresh && cached && isCacheValid(cached.timestamp, cache.indexInfoTtl)) {
    return { code: 0, data: cached.data };
  }

  // Fetch from server
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/elasticsearch/indices/${encodeURIComponent(indexName)}`);
    const result = await response.json();
    
    if (result.code === 0) {
      // Update cache
      cache.indexInfo[indexName] = {
        data: result.data,
        timestamp: Date.now()
      };
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
 */
export async function deleteElasticsearchIndex(indexName) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/elasticsearch/indices/${encodeURIComponent(indexName)}`, {
      method: 'DELETE'
    });
    const result = await response.json();
    
    if (result.code === 0) {
      // Invalidate caches
      invalidateIndicesCache();
      invalidateIndexInfoCache(indexName);
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
 */
export async function renameElasticsearchIndex(oldName, newName) {
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
      // Invalidate caches
      invalidateIndicesCache();
      invalidateIndexInfoCache(oldName);
      invalidateIndexInfoCache(newName);
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
 */
export async function createElasticsearchIndex(indexName, body = {}) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/elasticsearch/indices/`, {
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
      // Invalidate caches
      invalidateIndicesCache();
      return { code: 0, message: result.message || 'Index created successfully' };
    }
    return { code: -1, message: result.message || 'Failed to create index' };
  } catch (error) {
    console.error('Failed to create Elasticsearch index:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Invalidate indices cache
 */
export function invalidateIndicesCache() {
  cache.indices.data = null;
  cache.indices.timestamp = null;
}

/**
 * Invalidate index info cache for a specific index
 */
export function invalidateIndexInfoCache(indexName) {
  if (cache.indexInfo[indexName]) {
    delete cache.indexInfo[indexName];
  }
}

/**
 * Clear all caches
 */
export function clearAllCaches() {
  cache.indices.data = null;
  cache.indices.timestamp = null;
  cache.indexInfo = {};
}

/**
 * Fetch documents in an Elasticsearch index with pagination
 * @param {string} indexName - Name of the index
 * @param {number} page - Page number (1-based)
 * @param {number} pageSize - Number of documents per page
 */
export async function fetchElasticsearchDocuments(indexName, page = 1, pageSize = 20) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/elasticsearch/indices/${encodeURIComponent(indexName)}/docs/?page=${page}&pageSize=${pageSize}`
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
    console.error('Failed to fetch Elasticsearch documents:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Delete a document from an Elasticsearch index
 * @param {string} indexName - Name of the index
 * @param {string} docId - Document ID
 */
export async function deleteElasticsearchDocument(indexName, docId) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/elasticsearch/indices/${encodeURIComponent(indexName)}/docs/${encodeURIComponent(docId)}`,
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
    console.error('Failed to delete Elasticsearch document:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Create a document in an Elasticsearch index
 * @param {string} indexName - Name of the index
 * @param {object} body - Document body (optional, empty object creates empty doc)
 */
export async function createElasticsearchDocument(indexName, body = {}) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/elasticsearch/indices/${encodeURIComponent(indexName)}/docs/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body })
      }
    );
    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, data: result.data, message: result.message || 'Document created successfully' };
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
 */
export async function updateEsDocument(indexName, docId, newDoc) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/elasticsearch/indices/${encodeURIComponent(indexName)}/docs/${encodeURIComponent(docId)}`,
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
      return { code: 0, data: result.data, message: result.message || 'Document updated successfully' };
    }
    return { code: -1, message: result.message || 'Failed to update document' };
  } catch (error) {
    console.error('Failed to update Elasticsearch document:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

