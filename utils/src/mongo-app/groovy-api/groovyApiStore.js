/**
 * MobX store for Groovy API scripts
 * 
 * Architecture:
 * - Manages groovy API scripts for a mongo app
 * - Caches scripts and folders locally
 * - Handles all backend API requests
 * 
 * Single Source of Truth:
 * - Scripts: groovyApiStore.scripts (Map: scriptId -> script)
 * - Folders: groovyApiStore.folders (Array)
 */

import { makeAutoObservable, runInAction } from 'mobx';

class GroovyApiStore {
  // Scripts cache (Map for O(1) lookup)
  scripts = new Map();
  
  // Folders configuration
  folders = [];
  
  // Folder-scanned scripts (in-memory, non-persistent from backend)
  folderScannedScripts = [];
  
  // Loading states
  isLoadingScripts = false;
  isLoadingFolders = false;
  
  // Errors
  scriptsError = null;
  foldersError = null;
  
  constructor() {
    makeAutoObservable(this);
  }

  // ============ Scripts Management ============

  /**
   * Set scripts from server response
   */
  setScripts(scriptsObj) {
    this.scripts.clear();
    Object.entries(scriptsObj || {}).forEach(([id, script]) => {
      this.scripts.set(id, script);
    });
  }

  /**
   * Add or update a single script
   */
  setScript(scriptId, script) {
    this.scripts.set(scriptId, script);
  }

  /**
   * Remove a script
   */
  removeScript(scriptId) {
    this.scripts.delete(scriptId);
  }

  /**
   * Get script by ID (from database scripts)
   */
  getScript(scriptId) {
    return this.scripts.get(scriptId);
  }
  
  /**
   * Get folder-scanned script by ID (format: "folder-scanned:endpoint")
   */
  getScriptScannedFromFolder(scriptId) {
    if (!scriptId.startsWith('folder-scanned:')) return null;
    const endpoint = scriptId.substring('folder-scanned:'.length);
    return this.folderScannedScripts.find(script => script.endpoint === endpoint);
  }

  /**
   * Get all scripts as array
   */
  getAllScripts() {
    return Array.from(this.scripts.values());
  }

  /**
   * Fetch folder-scanned scripts (in-memory from backend)
   */
  async fetchFolderScannedScripts(serverUrl, appId) {
    if (!appId || !serverUrl) return { code: -1, message: 'Missing appId or serverUrl' };
    
    try {
      const response = await fetch(`${serverUrl}/mongo-app/${appId}/api-folders/scripts`);
      const result = await response.json();
      
      if (result.code === 0) {
        runInAction(() => {
          this.folderScannedScripts = result.data || [];
        });
        return { code: 0, data: result.data };
      } else {
        return { code: -1, message: result.message };
      }
    } catch (err) {
      return { code: -2, message: err.message };
    }
  }

  /**
   * Fetch scripts from server (both database and folder-scanned)
   */
  async fetchScripts(serverUrl, appId) {
    if (!appId || !serverUrl) return { code: -1, message: 'Missing appId or serverUrl' };
    
    runInAction(() => {
      this.isLoadingScripts = true;
      this.scriptsError = null;
    });
    
    try {
      // Fetch both database scripts and folder-scanned scripts
      const [dbScriptsResponse, folderScriptsResponse] = await Promise.all([
        fetch(`${serverUrl}/mongo-app/${appId}/api-config/list`),
        fetch(`${serverUrl}/mongo-app/${appId}/api-folders/scripts`)
      ]);
      
      const dbResult = await dbScriptsResponse.json();
      const folderResult = await folderScriptsResponse.json();
      
      if (dbResult.code === 0) {
        runInAction(() => {
          this.setScripts(dbResult.data || {});
          this.folderScannedScripts = folderResult.code === 0 ? (folderResult.data || []) : [];
          this.isLoadingScripts = false;
        });
        return { code: 0, data: dbResult.data };
      } else {
        runInAction(() => {
          this.scriptsError = dbResult.message || 'Failed to fetch scripts';
          this.isLoadingScripts = false;
        });
        return { code: -1, message: dbResult.message };
      }
    } catch (err) {
      runInAction(() => {
        this.scriptsError = err.message;
        this.isLoadingScripts = false;
      });
      return { code: -2, message: err.message };
    }
  }

  /**
   * Create a new script
   */
  async createScript(serverUrl, appId, scriptData) {
    try {
      const timezone = -new Date().getTimezoneOffset() / 60;
      const response = await fetch(`${serverUrl}/mongo-app/${appId}/api-config/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scriptData, timezone })
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        // Refresh scripts to get the new one
        await this.fetchScripts(serverUrl, appId);
      }
      
      return result;
    } catch (err) {
      return { code: -2, message: err.message };
    }
  }

  /**
   * Update a script
   */
  async updateScript(serverUrl, appId, scriptId, scriptData) {
    try {
      const timezone = -new Date().getTimezoneOffset() / 60;
      const response = await fetch(`${serverUrl}/mongo-app/${appId}/api-config/update/${scriptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...scriptData, timezone })
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        // Refresh scripts
        await this.fetchScripts(serverUrl, appId);
      }
      
      return result;
    } catch (err) {
      return { code: -2, message: err.message };
    }
  }

  /**
   * Delete a script
   */
  async deleteScript(serverUrl, appId, scriptId) {
    try {
      const response = await fetch(`${serverUrl}/mongo-app/${appId}/api-config/delete/${scriptId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        runInAction(() => {
          this.removeScript(scriptId);
        });
      }
      
      return result;
    } catch (err) {
      return { code: -2, message: err.message };
    }
  }

  /**
   * Refresh a file-based script
   */
  async refreshScript(serverUrl, appId, scriptId) {
    try {
      const response = await fetch(`${serverUrl}/mongo-app/${appId}/api-config/${scriptId}/refresh`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        // Refresh scripts
        await this.fetchScripts(serverUrl, appId);
      }
      
      return result;
    } catch (err) {
      return { code: -2, message: err.message };
    }
  }

  // ============ Folders Management ============

  /**
   * Set folders from server response
   */
  setFolders(foldersArray) {
    this.folders = foldersArray || [];
  }

  /**
   * Fetch folders from server
   */
  async fetchFolders(serverUrl, appId) {
    if (!appId || !serverUrl) return { code: -1, message: 'Missing appId or serverUrl' };
    
    runInAction(() => {
      this.isLoadingFolders = true;
      this.foldersError = null;
    });
    
    try {
      const response = await fetch(`${serverUrl}/mongo-app/${appId}/api-folders/list`);
      const result = await response.json();
      
      if (result.code === 0) {
        runInAction(() => {
          this.setFolders(result.data || []);
          this.isLoadingFolders = false;
        });
        return { code: 0, data: result.data };
      } else {
        runInAction(() => {
          this.foldersError = result.message || 'Failed to fetch folders';
          this.isLoadingFolders = false;
        });
        return { code: -1, message: result.message };
      }
    } catch (err) {
      runInAction(() => {
        this.foldersError = err.message;
        this.isLoadingFolders = false;
      });
      return { code: -2, message: err.message };
    }
  }

  /**
   * Add a folder
   */
  async addFolder(serverUrl, appId, fileAccessPointId, path) {
    try {
      const response = await fetch(`${serverUrl}/mongo-app/${appId}/api-folders/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileAccessPointId, path })
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        // Refresh folders
        await this.fetchFolders(serverUrl, appId);
      }
      
      return result;
    } catch (err) {
      return { code: -2, message: err.message };
    }
  }

  /**
   * Remove a folder
   */
  async removeFolder(serverUrl, appId, fileAccessPointId, path) {
    try {
      const response = await fetch(`${serverUrl}/mongo-app/${appId}/api-folders/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileAccessPointId, path })
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        // Refresh both folders and scripts (scripts from folder will be deleted)
        await Promise.all([
          this.fetchFolders(serverUrl, appId),
          this.fetchScripts(serverUrl, appId)
        ]);
      }
      
      return result;
    } catch (err) {
      return { code: -2, message: err.message };
    }
  }

  /**
   * Scan folders and load scripts
   */
  async scanFolders(serverUrl, appId) {
    try {
      const response = await fetch(`${serverUrl}/mongo-app/${appId}/api-folders/scan`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        // Refresh scripts
        await this.fetchScripts(serverUrl, appId);
      }
      
      return result;
    } catch (err) {
      return { code: -2, message: err.message };
    }
  }

  /**
   * Scan a specific folder and load scripts
   */
  async scanFolder(serverUrl, appId, fileAccessPointId, path) {
    try {
      const response = await fetch(`${serverUrl}/mongo-app/${appId}/api-folders/scan-one`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileAccessPointId, path })
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        // Refresh scripts
        await this.fetchScripts(serverUrl, appId);
      }
      
      return result;
    } catch (err) {
      return { code: -2, message: err.message };
    }
  }

  // ============ Categorization ============

  /**
   * Categorize scripts into inline, single file, and folder-based
   */
  categorizeScripts() {
    const scriptsArray = this.getAllScripts();
    const inline = [];
    const singleFile = [];
    const folderBased = new Map(); // folderKey -> { folder, scripts }

    const isFileBasedScript = (scriptSource) => {
      return scriptSource && typeof scriptSource === 'object' && scriptSource.storageType === 'fileAccessPoint';
    };

    // Process database scripts
    scriptsArray.forEach(script => {
      if (!isFileBasedScript(script.scriptSource)) {
        inline.push(script);
      } else {
        // Check if this script belongs to a managed folder
        const scriptFapId = script.scriptSource.fileAccessPointId;
        const scriptPath = script.scriptSource.path;
        
        let belongsToFolder = false;
        for (const folder of this.folders) {
          const folderPath = folder.path || '';
          const folderKey = `${folder.fileAccessPointId}:${folderPath}`;
          
          // Check if script path starts with folder path
          if (scriptFapId === folder.fileAccessPointId) {
            if (folderPath === '') {
              // Root folder - all files match
              belongsToFolder = true;
              if (!folderBased.has(folderKey)) {
                folderBased.set(folderKey, { folder, scripts: [] });
              }
              folderBased.get(folderKey).scripts.push(script);
              break;
            } else if (scriptPath.startsWith(folderPath + '/')) {
              belongsToFolder = true;
              if (!folderBased.has(folderKey)) {
                folderBased.set(folderKey, { folder, scripts: [] });
              }
              folderBased.get(folderKey).scripts.push(script);
              break;
            }
          }
        }
        
        if (!belongsToFolder) {
          singleFile.push(script);
        }
      }
    });

    // Process folder-scanned scripts (in-memory)
    this.folderScannedScripts.forEach(script => {
      const scriptFapId = script.fileAccessPointId;
      const scriptFolderPath = script.folderPath || '';
      const folderKey = `${scriptFapId}:${scriptFolderPath}`;
      
      // Find matching folder
      const folder = this.folders.find(f => 
        f.fileAccessPointId === scriptFapId && (f.path || '') === scriptFolderPath
      );
      
      if (folder) {
        if (!folderBased.has(folderKey)) {
          folderBased.set(folderKey, { folder, scripts: [] });
        }
        // Convert folder-scanned script format to match DB script format for display
        const displayScript = {
          id: `folder-scanned:${script.endpoint}`,
          endpoint: script.endpoint,
          scriptSource: {
            storageType: 'fileAccessPoint',
            fileAccessPointId: script.fileAccessPointId,
            path: script.path,
            cachedContent: script.fileContent || '' // Use fileContent from backend
          },
          source: 'folder-scanned',
          description: `Auto-loaded from folder: ${script.path}`
        };
        folderBased.get(folderKey).scripts.push(displayScript);
      }
    });

    return { inline, singleFile, folderBased };
  }

  /**
   * Clear all data
   */
  clear() {
    this.scripts.clear();
    this.folders = [];
    this.scriptsError = null;
    this.foldersError = null;
  }
}

// Create singleton instance
const groovyApiStore = new GroovyApiStore();

export default groovyApiStore;
