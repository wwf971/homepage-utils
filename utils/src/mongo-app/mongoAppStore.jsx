import { makeAutoObservable, runInAction } from 'mobx'
import { createContext, useContext, useMemo } from 'react'

class MongoAppStore {
  // App configuration
  serverUrl = ''
  appId = ''
  appName = ''
  
  // UI state
  isLoadingAppId = false
  isCreatingApp = false
  isCheckingCollections = false
  isTestingConnection = false
  connectionSuccess = false
  
  // Errors
  connectionError = null
  appError = null
  collectionError = null
  indexError = null
  
  // App search results
  foundApps = []
  
  // Collection status
  collectionStatus = {}
  
  // App metadata
  appMetadata = null
  
  // Index status
  indexExists = false
  indexName = ''
  indexSuccess = null

  // Config
  localStorageKey = 'mongo-app-config'

  constructor(config = {}) {
    makeAutoObservable(this)
    
    // Set defaults from config
    this.appName = config.appName || ''
    this.serverUrl = config.defaultServerUrl || ''
    this.localStorageKey = config.localStorageKey || 'mongo-app-config'
    
    // Load from localStorage
    this.loadFromLocalStorage()
  }

  // ============ Getters ============
  
  get isConfigured() {
    return this.serverUrl !== '' && this.appId !== ''
  }

  get apiBase() {
    return `${this.serverUrl}/mongo-app`
  }

  // ============ Actions ============

  setServerUrl(url) {
    this.serverUrl = url.trim()
    this.saveToLocalStorage()
  }

  setAppName(name) {
    this.appName = name.trim()
    this.saveToLocalStorage()
  }

  setAppId(id) {
    this.appId = id.trim()
    this.saveToLocalStorage()
  }

  clearConnectionError() {
    this.connectionError = null
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

  async testConnection() {
    if (!this.serverUrl) {
      this.connectionError = 'Server URL is required'
      return false
    }

    this.isTestingConnection = true
    this.connectionError = null
    this.connectionSuccess = false

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(`${this.serverUrl}/actuator/health`, {
        method: 'GET',
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }
      
      const result = await response.json()
      const success = result.status === 'UP'
      
      runInAction(() => {
        if (success) {
          this.connectionSuccess = true
        } else {
          this.connectionError = 'Server is not healthy'
        }
        this.isTestingConnection = false
      })
      
      return success
    } catch (error) {
      runInAction(() => {
        let errorMsg = 'Unknown error'
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            errorMsg = 'Connection timeout'
          } else if (error.message === 'Failed to fetch') {
            errorMsg = 'Cannot reach server. Check URL and network.'
          } else {
            errorMsg = error.message
          }
        }
        this.connectionError = errorMsg
        this.connectionSuccess = false
        this.isTestingConnection = false
      })
      return false
    }
  }

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
            this.saveToLocalStorage()
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
          this.saveToLocalStorage()
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

  loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(this.localStorageKey)
      if (stored) {
        const config = JSON.parse(stored)
        // Only override if values exist in storage
        if (config.serverUrl && config.serverUrl.includes('://')) {
          this.serverUrl = config.serverUrl
        }
        if (config.appId) {
          this.appId = config.appId
        }
        if (config.appName) {
          this.appName = config.appName
        }
      }
    } catch (error) {
      console.error('Failed to load config from localStorage:', error)
    }
  }

  saveToLocalStorage() {
    try {
      const config = {
        serverUrl: this.serverUrl,
        appId: this.appId,
        appName: this.appName,
      }
      localStorage.setItem(this.localStorageKey, JSON.stringify(config))
    } catch (error) {
      console.error('Failed to save config to localStorage:', error)
    }
  }

  reset() {
    this.serverUrl = ''
    this.appId = ''
    this.appName = ''
    this.isLoadingAppId = false
    this.isCreatingApp = false
    this.isCheckingCollections = false
    this.isTestingConnection = false
    this.connectionSuccess = false
    this.connectionError = null
    this.appError = null
    this.collectionError = null
    this.indexError = null
    this.foundApps = []
    this.collectionStatus = {}
    this.appMetadata = null
    this.indexExists = false
    this.indexName = ''
    localStorage.removeItem(this.localStorageKey)
  }
}

// Create context
export const StoreContext = createContext(null)

// Create provider component
export const StoreProvider = ({ children, appName, defaultServerUrl, localStorageKey }) => {
  // Create store instance only once using useMemo
  const store = useMemo(
    () => new MongoAppStore({ appName, defaultServerUrl, localStorageKey }),
    [appName, defaultServerUrl, localStorageKey]
  )
  
  return (
    <StoreContext.Provider value={store}>
      {children}
    </StoreContext.Provider>
  )
}

// Custom hook to use the store
export const useMongoAppStore = () => {
  const store = useContext(StoreContext)
  if (!store) {
    throw new Error('useMongoAppStore must be used within StoreProvider')
  }
  return store
}
