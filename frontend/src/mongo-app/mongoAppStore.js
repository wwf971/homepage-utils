import { makeAutoObservable, runInAction } from 'mobx'
import { getBackendServerUrl } from '../remote/backendServerStore'

class MongoAppStore {
  // All mongo apps cache
  allApps = []
  isLoadingAllApps = false
  allAppsError = null
  
  // Selected app
  selectedAppId = null
  selectedApp = null
  
  // Per-app state (for selected app)
  serverUrl = ''
  appId = ''
  appName = ''
  isLoadingAppId = false
  isCreatingApp = false
  isCheckingCollections = false
  appError = null
  collectionError = null
  indexError = null
  indexSuccess = null
  foundApps = []
  collectionStatus = {}
  appMetadata = null
  indexExists = false
  indexName = ''

  constructor() {
    makeAutoObservable(this)
    this.serverUrl = getBackendServerUrl()
  }

  // ============ Getters ============
  
  get isConfigured() {
    return this.serverUrl !== '' && this.appId !== ''
  }

  get apiBase() {
    return `${this.serverUrl}/mongo-app`
  }

  // ============ All Apps Management ============

  async fetchAllApps() {
    this.isLoadingAllApps = true
    this.allAppsError = null

    try {
      const response = await fetch(`${this.apiBase}/list`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch apps: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      runInAction(() => {
        if (result.code === 0 && result.data) {
          this.allApps = result.data
        } else {
          this.allAppsError = result.message || 'Failed to fetch apps'
        }
        this.isLoadingAllApps = false
      })
    } catch (error) {
      runInAction(() => {
        this.allAppsError = error instanceof Error ? error.message : 'Unknown error'
        this.isLoadingAllApps = false
      })
    }
  }

  selectApp(appId) {
    const app = this.allApps.find(a => a.appId === appId)
    if (app) {
      runInAction(() => {
        this.selectedAppId = appId
        this.selectedApp = app
        this.appId = app.appId
        this.appName = app.appName
        this.indexName = app.esIndex
        
        // Reset state
        this.appError = null
        this.collectionError = null
        this.indexError = null
        this.indexSuccess = null
        this.collectionStatus = {}
        this.appMetadata = null
      })
      
      // Fetch fresh metadata
      this.fetchAppMetadata()
      this.checkIndexExists()
    }
  }

  // ============ Actions ============

  setServerUrl(url) {
    this.serverUrl = url.trim()
  }

  setAppName(name) {
    this.appName = name.trim()
  }

  setAppId(id) {
    this.appId = id.trim()
  }

  clearAppError() {
    this.appError = null
  }

  clearCollectionError() {
    this.collectionError = null
  }

  clearIndexError() {
    this.indexError = null
  }

  clearIndexSuccess() {
    this.indexSuccess = null
  }

  // ============ Backend API ============

  async searchAppId() {
    if (!this.serverUrl || !this.appName) {
      this.appError = 'Server URL and app name are required'
      return
    }

    this.isLoadingAppId = true
    this.appError = null

    try {
      const response = await fetch(`${this.apiBase}/get-id/${encodeURIComponent(this.appName)}`)
      
      if (!response.ok) {
        throw new Error(`Failed to search app: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      runInAction(() => {
        if (result.code === 0 && result.data) {
          this.foundApps = result.data
          
          // Auto-select if exactly one app found
          if (this.foundApps.length === 1) {
            this.appId = this.foundApps[0].appId
          }
        } else {
          this.appError = result.message || 'Failed to search app'
        }
        this.isLoadingAppId = false
      })
    } catch (error) {
      runInAction(() => {
        this.appError = error instanceof Error ? error.message : 'Unknown error'
        this.isLoadingAppId = false
      })
    }
  }

  async createApp() {
    if (!this.serverUrl || !this.appName) {
      this.appError = 'Server URL and app name are required'
      return
    }

    this.isCreatingApp = true
    this.appError = null

    try {
      const response = await fetch(`${this.apiBase}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName: this.appName }),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to create app: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      runInAction(() => {
        if (result.code === 0 && result.data) {
          this.appId = result.data.appId
          // Refresh the list
          this.fetchAllApps()
        } else {
          this.appError = result.message || 'Failed to create app'
        }
        this.isCreatingApp = false
      })
    } catch (error) {
      runInAction(() => {
        this.appError = error instanceof Error ? error.message : 'Unknown error'
        this.isCreatingApp = false
      })
    }
  }

  async checkCollections(collectionNames) {
    if (!this.isConfigured) {
      this.collectionError = 'App not configured'
      return
    }

    this.isCheckingCollections = true
    this.collectionError = null

    try {
      const checks = await Promise.all(
        collectionNames.map(async (collName) => {
          const response = await fetch(`${this.apiBase}/${this.appId}/coll/exists/${encodeURIComponent(collName)}`)
          
          if (!response.ok) {
            throw new Error(`Failed to check collection ${collName}`)
          }
          
          const result = await response.json()
          return { collName, exists: result.data?.exists || false }
        })
      )

      runInAction(() => {
        this.collectionStatus = {}
        checks.forEach(({ collName, exists }) => {
          this.collectionStatus[collName] = exists
        })
        this.isCheckingCollections = false
      })
    } catch (error) {
      runInAction(() => {
        this.collectionError = error instanceof Error ? error.message : 'Unknown error'
        this.isCheckingCollections = false
      })
    }
  }

  async createCollection(collectionName) {
    if (!this.isConfigured) {
      this.collectionError = 'App not configured'
      return false
    }

    try {
      const response = await fetch(`${this.apiBase}/${this.appId}/coll/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionName }),
      })
      
      if (!response.ok) {
        throw new Error(`Failed to create collection: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (result.code === 0) {
        runInAction(() => {
          this.collectionStatus[collectionName] = true
        })
        return true
      } else {
        this.collectionError = result.message || 'Failed to create collection'
        return false
      }
    } catch (error) {
      this.collectionError = error instanceof Error ? error.message : 'Unknown error'
      return false
    }
  }

  async fetchAppMetadata() {
    if (!this.isConfigured) return

    try {
      const response = await fetch(`${this.apiBase}/${this.appId}/config`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (result.code === 0) {
        runInAction(() => {
          this.appMetadata = result.data
        })
      }
    } catch (error) {
      console.error('Failed to fetch app metadata:', error)
    }
  }

  async checkIndexExists() {
    if (!this.isConfigured) return

    try {
      const response = await fetch(`${this.apiBase}/${this.appId}/index/exists`)
      
      if (!response.ok) {
        throw new Error(`Failed to check index: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (result.code === 0) {
        runInAction(() => {
          this.indexExists = result.data?.exists || false
          this.indexName = result.data?.indexName || ''
        })
      } else {
        console.error('Failed to check index:', result.message)
      }
    } catch (error) {
      console.error('Failed to check index:', error)
    }
  }

  async createIndex() {
    if (!this.isConfigured) {
      this.indexError = 'App not configured'
      return false
    }

    this.indexError = null
    this.indexSuccess = null

    try {
      const response = await fetch(`${this.apiBase}/${this.appId}/index/create`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error(`Failed to create index: ${response.statusText}`)
      }
      
      const result = await response.json()
      
      if (result.code === 0) {
        runInAction(() => {
          this.indexExists = true
          this.indexSuccess = 'Index created successfully'
        })
        // Re-check to verify
        await this.checkIndexExists()
        return true
      } else {
        this.indexError = result.message || 'Failed to create index'
        return false
      }
    } catch (error) {
      this.indexError = error instanceof Error ? error.message : 'Unknown error'
      return false
    }
  }

  // ============ Utility ============

  saveToLocalStorage() {
    // No-op in this store since we don't need localStorage for the app list view
  }

  loadFromLocalStorage() {
    // No-op in this store since we don't need localStorage for the app list view
  }

  reset() {
    this.selectedAppId = null
    this.selectedApp = null
    this.serverUrl = getBackendServerUrl()
    this.appId = ''
    this.appName = ''
    this.isLoadingAppId = false
    this.isCreatingApp = false
    this.isCheckingCollections = false
    this.appError = null
    this.collectionError = null
    this.indexError = null
    this.indexSuccess = null
    this.foundApps = []
    this.collectionStatus = {}
    this.appMetadata = null
    this.indexExists = false
    this.indexName = ''
  }
}

export const mongoAppStore = new MongoAppStore()

