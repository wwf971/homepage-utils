import { makeAutoObservable, runInAction } from 'mobx';
import { getBackendServerUrl } from '../remote/dataStore';
import { getTimezoneInt } from '../utils/utils';

class GroovyApiStore {
  // Scripts keyed by ID
  scripts = {};
  
  // Loading states
  loading = false;

  constructor() {
    makeAutoObservable(this);
  }

  // Fetch all scripts
  async fetchScripts(forceRefresh = false) {
    this.loading = true;
    
    try {
      const backendUrl = getBackendServerUrl();
      const res = await fetch(`${backendUrl}/groovy-api/list`);
      const result = await res.json();
      
      if (result.code === 0) {
        runInAction(() => {
          this.scripts = result.data;
          this.loading = false;
        });
        return { success: true, data: result.data };
      } else {
        runInAction(() => {
          this.loading = false;
        });
        return { success: false, error: result.message };
      }
    } catch (err) {
      runInAction(() => {
        this.loading = false;
      });
      return { success: false, error: 'Failed to load scripts: ' + err.message };
    }
  }

  // Fetch a specific script by ID
  async fetchScript(id, forceRefresh = false) {
    if (!forceRefresh && this.scripts[id]) {
      return { success: true, data: this.scripts[id] };
    }

    this.loading = true;
    
    try {
      const backendUrl = getBackendServerUrl();
      const res = await fetch(`${backendUrl}/groovy-api/get/${id}`);
      const result = await res.json();
      
      if (result.code === 0) {
        runInAction(() => {
          this.scripts[id] = result.data;
          this.loading = false;
        });
        return { success: true, data: result.data };
      } else {
        runInAction(() => {
          this.loading = false;
        });
        return { success: false, error: result.message };
      }
    } catch (err) {
      runInAction(() => {
        this.loading = false;
      });
      return { success: false, error: 'Failed to load script: ' + err.message };
    }
  }

  // Upload or update a script
  async uploadScript(id, endpoint, scriptSource, description) {
    if (!endpoint || !endpoint.trim()) {
      return { success: false, error: 'Endpoint name is required' };
    }

    if (!scriptSource || !scriptSource.trim()) {
      return { success: false, error: 'Script source is required' };
    }

    this.loading = true;

    try {
      const backendUrl = getBackendServerUrl();
      const timezoneOffset = getTimezoneInt();
      const res = await fetch(`${backendUrl}/groovy-api/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: id || undefined,
          endpoint,
          scriptSource,
          description,
          timezoneOffset
        })
      });

      const result = await res.json();
      
      if (result.code === 0) {
        runInAction(() => {
          this.scripts[result.data.id] = result.data;
          this.loading = false;
        });
        
        return { success: true, message: result.message, data: result.data };
      } else {
        runInAction(() => {
          this.loading = false;
        });
        return { success: false, error: result.message };
      }
    } catch (err) {
      runInAction(() => {
        this.loading = false;
      });
      return { success: false, error: 'Failed to upload script: ' + err.message };
    }
  }

  // Delete a script
  async deleteScript(id) {
    this.loading = true;

    try {
      const backendUrl = getBackendServerUrl();
      const res = await fetch(`${backendUrl}/groovy-api/delete/${id}`, {
        method: 'DELETE'
      });

      const result = await res.json();
      
      if (result.code === 0) {
        runInAction(() => {
          delete this.scripts[id];
          this.loading = false;
        });
        return { success: true, message: 'Script deleted' };
      } else {
        runInAction(() => {
          this.loading = false;
        });
        return { success: false, error: result.message };
      }
    } catch (err) {
      runInAction(() => {
        this.loading = false;
      });
      return { success: false, error: 'Failed to delete script: ' + err.message };
    }
  }

  // Execute a script
  async executeScript(endpoint, params) {
    this.loading = true;

    try {
      const backendUrl = getBackendServerUrl();
      const res = await fetch(`${backendUrl}/groovy-api/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params || {})
      });

      const result = await res.json();
      
      runInAction(() => {
        this.loading = false;
      });
      
      return { success: true, data: result };
    } catch (err) {
      runInAction(() => {
        this.loading = false;
      });
      return { success: false, error: 'Failed to execute script: ' + err.message };
    }
  }

  // Get all scripts as an array
  get scriptsArray() {
    return Object.values(this.scripts);
  }

  // Reload all scripts (force refresh)
  async reload() {
    return await this.fetchScripts(true);
  }
}

// Create singleton instance
const groovyApiStore = new GroovyApiStore();
export default groovyApiStore;
