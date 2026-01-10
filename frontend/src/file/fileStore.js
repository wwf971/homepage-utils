import { atom } from 'jotai';
import { updateDocumentField } from '../mongo/mongoStore';
import { getBackendServerUrl } from '../remote/dataStore';

// File access points atom - stores array of file access point documents
export const fileAccessPointsAtom = atom([]);

// Metadata atom - stores database/collection info
export const fileAccessPointsMetadataAtom = atom({
  database: 'note',
  collection: 'note',
  ids: []
});

// Loading/error state
export const fileAccessPointsLoadingAtom = atom(false);
export const fileAccessPointsErrorAtom = atom(null);

// Unified file cache - stores all file information (metadata, content, etc.) by composite key "accessPointId:fileId"
// Each entry can contain: id, name, size, contentType, lastModified, path, fileBytes, isDirectory, etc.
// The cache is incremental - partial information is merged with existing data
export const fileCacheAtom = atom({});

/**
 * Fetch file access points using MongoDB document API with query filter
 * 1. Get mongo docs info (database, collection, IDs) from backend
 * 2. Query MongoDB for documents where type="file_access_point"
 */
export async function fetchFileAccessPoints() {
  try {
    // Get MongoDB document location info
    const backendUrl = getBackendServerUrl();
    console.log('Fetching file access points from:', `${backendUrl}/file_access_point/mongo_docs/`);
    const mongoDocsResponse = await fetch(`${backendUrl}/file_access_point/mongo_docs/`);
    
    console.log('Response status:', mongoDocsResponse.status);
    console.log('Response headers:', mongoDocsResponse.headers.get('content-type'));
    
    const contentType = mongoDocsResponse.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // Log the actual response text for debugging
      const responseText = await mongoDocsResponse.text();
      console.error('Non-JSON response received:', responseText.substring(0, 500));
      throw new Error('Server returned non-JSON response. Endpoint may not exist or server error occurred.');
    }
    
    const mongoDocsResult = await mongoDocsResponse.json();
    
    if (mongoDocsResult.code !== 0) {
      return { code: -1, message: mongoDocsResult.message || 'Failed to load mongo docs info' };
    }
    
    const { database, collection, ids } = mongoDocsResult.data;
    
    // Fetch each document by ID
    const fetchPromises = ids.map(id => 
      fetch(`${backendUrl}/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/?id=${id}`)
        .then(res => res.json())
        .then(result => result.code === 0 ? result.data : null)
    );
    
    const documents = await Promise.all(fetchPromises);
    const data = documents.filter(Boolean);
    
    return { 
      code: 0, 
      data: data,
      metadata: { database, collection, ids }
    };
  } catch (error) {
    console.error('Failed to fetch file access points:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Update a file access point field using MongoDB document operations
 * File access points are stored in MongoDB "note" collection with type="file_access_point"
 * 
 * @param {string} database - Database name
 * @param {string} collection - Collection name
 * @param {string} docId - Document id (not _id)
 * @param {string} fieldPath - Field path (e.g., "name", "setting.type", "setting.dir_path_base")
 * @param {any} value - New value
 */
export async function updateFileAccessPointField(database, collection, docId, fieldPath, value) {
  return await updateDocumentField(database, collection, docId, fieldPath, value);
}

/**
 * Fetch the computed base directory from backend
 * Forces backend to re-read config and compute the base directory
 * 
 * @param {string} accessPointId - File access point ID
 * @returns {Promise<{code: number, data?: string, message?: string}>}
 */
export async function fetchComputedBaseDir(accessPointId) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(`${backendUrl}/file_access_point/${encodeURIComponent(accessPointId)}/base_dir/`);
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Server returned non-JSON response');
    }
    
    const result = await response.json();
    
    if (result.code !== 0) {
      return { code: -1, message: result.message || 'Failed to fetch computed base directory' };
    }
    
    return { code: 0, data: result.data, message: result.message };
  } catch (error) {
    console.error('Failed to fetch computed base directory:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Generate cache key for file
 * @param {string} accessPointId
 * @param {string} fileId
 * @returns {string}
 */
function getFileCacheKey(accessPointId, fileId) {
  return `${accessPointId}:${fileId}`;
}

/**
 * Merge file information into cache (incremental updates)
 * @param {Function} setCache - Jotai setter for fileCacheAtom
 * @param {string} accessPointId
 * @param {string} fileId
 * @param {object} fileInfo - Partial or complete file information
 */
function mergeFileInfoIntoCache(setCache, accessPointId, fileId, fileInfo) {
  if (!fileInfo) return;
  
  const cacheKey = getFileCacheKey(accessPointId, fileId);
  setCache((prevCache) => {
    const existing = prevCache[cacheKey] || {};
    return {
      ...prevCache,
      [cacheKey]: { ...existing, ...fileInfo }
    };
  });
}

/**
 * Get cached file information
 * @param {object} cache - Current cache state
 * @param {string} accessPointId
 * @param {string} fileId
 * @returns {object|null}
 */
export function getCachedFile(cache, accessPointId, fileId) {
  const cacheKey = getFileCacheKey(accessPointId, fileId);
  return cache[cacheKey] || null;
}

/**
 * List files with caching
 * Makes API request and caches all returned file information
 * 
 * @param {string} accessPointId - File access point ID
 * @param {string} path - Path to list (default: "")
 * @param {number} page - Page number (default: 0)
 * @param {number} pageSize - Page size (default: 50)
 * @param {Function} setCache - Jotai setter for fileCacheAtom
 * @returns {Promise<{code: number, data?: Array, message?: string}>}
 */
export async function fetchFileList(accessPointId, path = '', page = 0, pageSize = 50, setCache) {
  try {
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/file_access_point/${encodeURIComponent(accessPointId)}/files/?path=${encodeURIComponent(path)}&page=${page}&pageSize=${pageSize}`
    );
    
    const result = await response.json();

    if (result.code === 0 && result.data) {
      // Cache all returned file information
      if (setCache) {
        result.data.forEach(file => {
          const fileId = file.id || file.path;
          if (fileId) {
            mergeFileInfoIntoCache(setCache, accessPointId, fileId, file);
          }
        });
      }
      
      return { code: 0, data: result.data };
    } else {
      return { code: -1, message: result.message || 'Failed to load files' };
    }
  } catch (error) {
    console.error('Failed to fetch file list:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch file data (metadata and optionally content) with caching
 * Uses POST to get both metadata and file bytes (if available)
 * Updates the cache with all fetched information
 * 
 * @param {string} accessPointId - File access point ID
 * @param {string} fileId - File ID (custom id or path)
 * @param {Function} setCache - Jotai setter for fileCacheAtom
 * @returns {Promise<{code: number, data?: {metadata: object, fileBytes?: string}, message?: string}>}
 */
export async function fetchFileData(accessPointId, fileId, setCache) {
  try {
    // Don't encode slashes in fileId, as they are part of the path structure
    // Only encode individual path segments
    const encodedFileId = fileId.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const backendUrl = getBackendServerUrl();
    const url = `${backendUrl}/file_access_point/${encodeURIComponent(accessPointId)}/${encodedFileId}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load file: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.code !== 0) {
      return { code: -1, message: result.message || 'Failed to load file' };
    }

    const { metadata, fileBytes } = result.data;
    
    // Merge metadata and fileBytes into cache
    if (setCache && metadata) {
      const cacheInfo = { ...metadata };
      if (fileBytes) {
        cacheInfo.fileBytes = fileBytes;
      }
      mergeFileInfoIntoCache(setCache, accessPointId, fileId, cacheInfo);
    }
    
    return { code: 0, data: { metadata, fileBytes } };
  } catch (error) {
    console.error('Failed to fetch file data:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Rename file and update cache
 * 
 * @param {string} accessPointId - File access point ID
 * @param {string} fileId - File ID (custom id or path)
 * @param {string} newName - New file name
 * @param {Function} setCache - Jotai setter for fileCacheAtom
 * @returns {Promise<{code: number, data?: object, message?: string}>}
 */
export async function renameFile(accessPointId, fileId, newName, setCache) {
  try {
    // Don't encode slashes in fileId for local/external types
    const encodedFileId = fileId.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const backendUrl = getBackendServerUrl();
    const response = await fetch(
      `${backendUrl}/file_access_point/${encodeURIComponent(accessPointId)}/${encodedFileId}/rename`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      }
    );

    const result = await response.json();

    if (result.code === 0) {
      // Update cache with new file information
      if (setCache && result.data) {
        mergeFileInfoIntoCache(setCache, accessPointId, fileId, result.data);
      }
      
      return { code: 0, data: result.data, message: 'Success' };
    } else {
      return { code: -1, message: result.message || 'Failed to rename file' };
    }
  } catch (error) {
    console.error('Failed to rename file:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

