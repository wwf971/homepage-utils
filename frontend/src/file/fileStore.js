import { makeAutoObservable, runInAction } from 'mobx';
import { updateDocField } from '../mongo/mongoStore';
import { getBackendServerUrl } from '../remote/dataStore';

/**
 * MobX store for file access points and file caching
 */
class FileStore {
  // File access points state
  fileAccessPoints = [];
  fileAccessPointsMetadata = {
    database: 'note',
    collection: 'note',
    ids: []
  };
  fileAccessPointsLoading = false;
  fileAccessPointsError = null;

  // Unified file cache - stores all file information by composite key "fileAccessPointId:fileId"
  fileCache = {};

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Set file access points
   */
  setFileAccessPoints(accessPoints) {
    this.fileAccessPoints = accessPoints;
  }

  /**
   * Set file access points metadata
   */
  setFileAccessPointsMetadata(metadata) {
    this.fileAccessPointsMetadata = metadata;
  }

  /**
   * Set loading state
   */
  setFileAccessPointsLoading(loading) {
    this.fileAccessPointsLoading = loading;
  }

  /**
   * Set error state
   */
  setFileAccessPointsError(error) {
    this.fileAccessPointsError = error;
  }

  /**
   * Clear file cache
   */
  clearFileCache() {
    this.fileCache = {};
    console.log('File cache cleared');
  }

  /**
   * Generate cache key for file
   */
  getFileCacheKey(fileAccessPointId, fileId) {
    return `${fileAccessPointId}:${fileId}`;
  }

  /**
   * Merge file information into cache (incremental updates)
   */
  mergeFileInfoIntoCache(fileAccessPointId, fileId, fileInfo) {
    if (!fileInfo) return;
    
    const cacheKey = this.getFileCacheKey(fileAccessPointId, fileId);
    const existing = this.fileCache[cacheKey] || {};
    this.fileCache[cacheKey] = { ...existing, ...fileInfo };
  }

  /**
   * Get cached file information
   */
  getCachedFile(fileAccessPointId, fileId) {
    const cacheKey = this.getFileCacheKey(fileAccessPointId, fileId);
    return this.fileCache[cacheKey] || null;
  }

  /**
   * Fetch file access points using MongoDB document API with query filter
   */
  async fetchFileAccessPoints() {
    try {
      const backendUrl = getBackendServerUrl();
      console.log('Fetching file access points from:', `${backendUrl}/file_access_point/mongo_docs/`);
      const mongoDocsResponse = await fetch(`${backendUrl}/file_access_point/mongo_docs/`);
      
      console.log('Response status:', mongoDocsResponse.status);
      console.log('Response headers:', mongoDocsResponse.headers.get('content-type'));
      
      const contentType = mongoDocsResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
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
        fetch(`${backendUrl}/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/doc/query?id=${encodeURIComponent(id)}`)
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
      console.log('[ERROR] Failed to fetch file access points:', error);
      return { code: -2, message: error.message || 'Network error' };
    }
  }

  /**
   * Fetch the computed base directory from backend
   */
  async fetchComputedBaseDir(fileAccessPointId) {
    try {
      const backendUrl = getBackendServerUrl();
      const response = await fetch(`${backendUrl}/file_access_point/${encodeURIComponent(fileAccessPointId)}/base_dir/`);
      
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
      console.log('[ERROR] Failed to fetch computed base directory:', error);
      return { code: -2, message: error.message || 'Network error' };
    }
  }

  /**
   * List files with caching
   */
  async fetchFileList(fileAccessPointId, path = '', page = 0, pageSize = 50) {
    try {
      const backendUrl = getBackendServerUrl();
      const response = await fetch(
        `${backendUrl}/file_access_point/${encodeURIComponent(fileAccessPointId)}/files/?path=${encodeURIComponent(path)}&page=${page}&pageSize=${pageSize}`
      );
      
      const result = await response.json();

      if (result.code === 0 && result.data) {
        // Cache all returned file information
        runInAction(() => {
          result.data.forEach(file => {
            const fileId = file.id || file.path;
            if (fileId) {
              this.mergeFileInfoIntoCache(fileAccessPointId, fileId, file);
            }
          });
        });
        
        return { code: 0, data: result.data };
      } else {
        return { code: -1, message: result.message || 'Failed to load files' };
      }
    } catch (error) {
      console.log('[ERROR] Failed to fetch file list:', error);
      return { code: -2, message: error.message || 'Network error' };
    }
  }

  /**
   * Fetch file data (metadata and optionally content) with caching
   */
  async fetchFileData(fileAccessPointId, fileId) {
    try {
      const encodedFileId = fileId.split('/').map(segment => encodeURIComponent(segment)).join('/');
      const backendUrl = getBackendServerUrl();
      const url = `${backendUrl}/file_access_point/${encodeURIComponent(fileAccessPointId)}/${encodedFileId}`;
      
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
      runInAction(() => {
        if (metadata) {
          const cacheInfo = { ...metadata };
          if (fileBytes) {
            cacheInfo.fileBytes = fileBytes;
          }
          this.mergeFileInfoIntoCache(fileAccessPointId, fileId, cacheInfo);
        }
      });
      
      return { code: 0, data: { metadata, fileBytes } };
    } catch (error) {
      console.log('[ERROR] Failed to fetch file data:', error);
      return { code: -2, message: error.message || 'Network error' };
    }
  }

  /**
   * Rename file and update cache
   */
  async renameFile(fileAccessPointId, fileId, newName) {
    try {
      const encodedFileId = fileId.split('/').map(segment => encodeURIComponent(segment)).join('/');
      const backendUrl = getBackendServerUrl();
      const response = await fetch(
        `${backendUrl}/file_access_point/${encodeURIComponent(fileAccessPointId)}/${encodedFileId}/rename`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName })
        }
      );

      const result = await response.json();

      if (result.code === 0) {
        // Update cache with new file information
        runInAction(() => {
          if (result.data) {
            this.mergeFileInfoIntoCache(fileAccessPointId, fileId, result.data);
          }
        });
        
        return { code: 0, data: result.data, message: 'Success' };
      } else {
        return { code: -1, message: result.message || 'Failed to rename file' };
      }
    } catch (error) {
      console.log('[ERROR] Failed to rename file:', error);
      return { code: -2, message: error.message || 'Network error' };
    }
  }
}

// Create singleton instance
const fileStore = new FileStore();

export default fileStore;

/**
 * Update a file access point field using MongoDB document operations
 */
export async function updateFileAccessPointField(database, collection, docId, fieldPath, value) {
  return await updateDocField(database, collection, docId, fieldPath, value);
}

// Export functions that components can use
export const fetchFileAccessPoints = () => fileStore.fetchFileAccessPoints();
export const fetchComputedBaseDir = (fileAccessPointId) => fileStore.fetchComputedBaseDir(fileAccessPointId);
export const fetchFileList = (fileAccessPointId, path, page, pageSize) => fileStore.fetchFileList(fileAccessPointId, path, page, pageSize);
export const fetchFileData = (fileAccessPointId, fileId) => fileStore.fetchFileData(fileAccessPointId, fileId);
export const renameFile = (fileAccessPointId, fileId, newName) => fileStore.renameFile(fileAccessPointId, fileId, newName);
export const getCachedFile = (cache, fileAccessPointId, fileId) => {
  // For backwards compatibility, ignore cache param and use store
  return fileStore.getCachedFile(fileAccessPointId, fileId);
};
export const clearFileCache = () => fileStore.clearFileCache();
