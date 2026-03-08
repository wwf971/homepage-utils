import { makeAutoObservable, runInAction } from 'mobx'
import { createContext, useContext, useMemo } from 'react'

class MongoAppStore {
  backendUrl = ''
  appId = ''
  appName = ''
  allApps = []

  isLoadingAppId = false
  isCreatingApp = false
  isCheckingCollections = false
  isTestingConnection = false
  isLoadingAllApps = false
  connectionSuccess = false

  connectionError = null
  appError = null
  collectionError = null
  indexError = null
  allAppsError = null

  foundApps = []
  collectionsInfo = {}
  appMetadata = null

  allMongoIndices = []
  isLoadingMongoIndices = false
  mongoIndicesError = null

  localStorageKey = 'mongo-app-config'

  constructor(config = {}) {
    makeAutoObservable(this)

    this.appId = config.appId || ''
    this.appName = config.appName || ''
    this.backendUrl = config.backendUrlDefault || ''
    this.localStorageKey = config.localStorageKey || 'mongo-app-config'

    this.loadFromLocalStorage({
      preserveBackendUrl: !!config.backendUrlDefault,
      preserveAppId: !!config.appId,
      preserveAppName: !!config.appName,
    })
  }

  get isConfigured() {
    return this.backendUrl !== '' && this.appId !== ''
  }

  get apiBase() {
    return `${this.backendUrl}/mongo-app`
  }

  setBackendUrl(url) {
    this.backendUrl = url.trim()
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

  async fetchAllApps() {
    if (!this.backendUrl) {
      this.allAppsError = 'Server URL is required'
      return
    }

    this.isLoadingAllApps = true
    this.allAppsError = null

    try {
      const response = await fetch(`${this.apiBase}/list`)

      if (!response.ok) {
        throw new Error(`Failed to fetch apps: ${response.statusText}`)
      }

      const result = await response.json()

      runInAction(() => {
        if (result.code === 0 && Array.isArray(result.data)) {
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

  async testConnection() {
    if (!this.backendUrl) {
      this.connectionError = 'Server URL is required'
      return false
    }

    this.isTestingConnection = true
    this.connectionError = null
    this.connectionSuccess = false

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${this.backendUrl}/actuator/health`, {
        method: 'GET',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      const isSuccess = result.status === 'UP'

      runInAction(() => {
        if (isSuccess) {
          this.connectionSuccess = true
        } else {
          this.connectionError = 'Server is not healthy'
        }
        this.isTestingConnection = false
      })

      return isSuccess
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
    if (!this.backendUrl || !this.appName) {
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

  async validateAppId(targetAppId = this.appId) {
    if (!this.backendUrl || !targetAppId) {
      this.appError = 'Server URL and app id are required'
      return false
    }

    this.isLoadingAppId = true
    this.appError = null

    try {
      const response = await fetch(`${this.apiBase}/${encodeURIComponent(targetAppId)}/config`)

      if (!response.ok) {
        throw new Error(`Failed to check app id: ${response.statusText}`)
      }

      const result = await response.json()

      runInAction(() => {
        if (result.code === 0 && result.data) {
          this.appId = targetAppId
          if (result.data.appName) {
            this.appName = result.data.appName
          }
          this.appMetadata = result.data
          this.saveToLocalStorage()
        } else {
          this.appId = ''
          this.appError = result.message || `App id not found: ${targetAppId}`
          this.saveToLocalStorage()
        }
        this.isLoadingAppId = false
      })

      return result.code === 0 && !!result.data
    } catch (error) {
      runInAction(() => {
        this.appId = ''
        this.appError = error instanceof Error ? error.message : 'Unknown error'
        this.isLoadingAppId = false
        this.saveToLocalStorage()
      })
      return false
    }
  }

  async createMongoApp() {
    if (!this.backendUrl || !this.appName) {
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
        checks.forEach(({ collName, exists }) => {
          if (!this.collectionsInfo[collName]) {
            this.collectionsInfo[collName] = {}
          }
          this.collectionsInfo[collName].exists = exists
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
          if (!this.collectionsInfo[collectionName]) {
            this.collectionsInfo[collectionName] = {}
          }
          this.collectionsInfo[collectionName].exists = true
          if (this.appMetadata) {
            const currentCollections = Array.isArray(this.appMetadata.collections) ? this.appMetadata.collections : []
            if (!currentCollections.includes(collectionName)) {
              this.appMetadata = {
                ...this.appMetadata,
                collections: [...currentCollections, collectionName],
              }
            }
          }
        })
        await this.fetchAllCollections()
        return true
      }

      this.collectionError = result.message || 'Failed to create collection'
      return false
    } catch (error) {
      this.collectionError = error instanceof Error ? error.message : 'Unknown error'
      return false
    }
  }

  async deleteCollection(collectionName) {
    if (!this.isConfigured) {
      this.collectionError = 'App not configured'
      return false
    }

    this.collectionError = null

    try {
      const response = await fetch(
        `${this.apiBase}/${this.appId}/coll/${encodeURIComponent(collectionName)}/delete`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error(`Failed to delete collection: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.code === 0) {
        runInAction(() => {
          const nextCollectionsInfo = { ...this.collectionsInfo }
          delete nextCollectionsInfo[collectionName]
          this.collectionsInfo = nextCollectionsInfo
          if (this.appMetadata) {
            const currentCollections = Array.isArray(this.appMetadata.collections) ? this.appMetadata.collections : []
            this.appMetadata = {
              ...this.appMetadata,
              collections: currentCollections.filter((name) => name !== collectionName),
            }
          }
        })

        await this.fetchAllCollections()
        return true
      }

      this.collectionError = result.message || 'Failed to delete collection'
      return false
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

  async fetchAllCollections() {
    if (!this.isConfigured) return

    this.collectionError = null

    try {
      const response = await fetch(`${this.apiBase}/${this.appId}/coll/get-detail`)

      if (!response.ok) {
        throw new Error(`Failed to fetch collections: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.code === 0) {
        runInAction(() => {
          this.collectionsInfo = result.data || {}
        })
      } else {
        this.collectionError = result.message || 'Failed to fetch collections'
      }
    } catch (error) {
      this.collectionError = error instanceof Error ? error.message : 'Unknown error'
    }
  }

  async fetchAllMongoIndices(force = false) {
    if (!this.backendUrl) return
    if (!force && this.allMongoIndices.length > 0) return

    this.isLoadingMongoIndices = true
    this.mongoIndicesError = null

    try {
      const response = await fetch(`${this.backendUrl}/mongo-index/list`)

      if (!response.ok) {
        throw new Error(`Failed to fetch mongo-indices: ${response.statusText}`)
      }

      const result = await response.json()

      runInAction(() => {
        if (result.code === 0 && Array.isArray(result.data)) {
          this.allMongoIndices = result.data
        } else {
          this.mongoIndicesError = result.message || 'Failed to fetch mongo-indices'
        }
        this.isLoadingMongoIndices = false
      })
    } catch (error) {
      runInAction(() => {
        this.mongoIndicesError = error instanceof Error ? error.message : 'Unknown error'
        this.isLoadingMongoIndices = false
      })
    }
  }

  loadFromLocalStorage(options = {}) {
    const preserveBackendUrl = !!options.preserveBackendUrl
    const preserveAppId = !!options.preserveAppId
    const preserveAppName = !!options.preserveAppName

    try {
      const stored = localStorage.getItem(this.localStorageKey)
      if (stored) {
        const config = JSON.parse(stored)
        if (!preserveBackendUrl && config.backendUrl && config.backendUrl.includes('://')) {
          this.backendUrl = config.backendUrl
        }
        if (!preserveAppId && config.appId) {
          this.appId = config.appId
        }
        if (!preserveAppName && config.appName) {
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
        backendUrl: this.backendUrl,
        appId: this.appId,
        appName: this.appName,
      }
      localStorage.setItem(this.localStorageKey, JSON.stringify(config))
    } catch (error) {
      console.error('Failed to save config to localStorage:', error)
    }
  }

  reset() {
    this.backendUrl = ''
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
    this.allAppsError = null
    this.foundApps = []
    this.allApps = []
    this.isLoadingAllApps = false
    this.collectionsInfo = {}
    this.appMetadata = null
    localStorage.removeItem(this.localStorageKey)
  }
}

export const StoreContext = createContext(null)

export const StoreProvider = ({ children, appId, appName, backendUrlDefault, localStorageKey }) => {
  const store = useMemo(
    () => new MongoAppStore({ appId, appName, backendUrlDefault, localStorageKey }),
    [appId, appName, backendUrlDefault, localStorageKey]
  )

  return (
    <StoreContext.Provider value={store}>
      {children}
    </StoreContext.Provider>
  )
}

export const useMongoAppStore = () => {
  const store = useContext(StoreContext)
  if (!store) {
    throw new Error('useMongoAppStore must be used within StoreProvider or ExternalStoreProvider')
  }
  return store
}

export const ExternalStoreProvider = ({ children, store }) => {
  return (
    <StoreContext.Provider value={store}>
      {children}
    </StoreContext.Provider>
  )
}

