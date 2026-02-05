import { observer } from 'mobx-react-lite'
import { reaction } from 'mobx'
import { useEffect, useRef } from 'react'
import { PanelToggle, SpinningCircle, RefreshIcon } from '@wwf971/react-comp-misc'
import { StoreProvider, ExternalStoreProvider, useMongoAppStore } from './mongoAppStore.jsx'
import TestConnection from './TestConnection.jsx'
import MongoAppGroovyApi from './mongoAppGroovyApi.jsx'
import MongoAppGroovyApiTest from './mongoAppGroovyApiTest.jsx'
import MongoAppCollectionConfig from './MongoAppCollectionConfig.jsx'
import './MongoAppConfig.css'

// App ID Management Panel
const AppIdPanel = observer(() => {
  const store = useMongoAppStore()
  
  return (
    <div className="config-panel-content">
      <div className="config-row">
        <label className="config-label">App Name:</label>
        <input
          type="text"
          className="config-input"
          value={store.appName}
          onChange={(e) => store.setAppName(e.target.value)}
          placeholder="jp-learn"
        />
      </div>

      <div className="config-row">
        <label className="config-label">App ID:</label>
        <input
          type="text"
          className="config-input"
          value={store.appId}
          readOnly
          placeholder="Will be generated or searched"
        />
      </div>

      <div className="config-button-row">
        <button
          className="config-button config-button-primary"
          onClick={() => store.searchAppId()}
          disabled={!store.serverUrl || !store.appName || store.isLoadingAppId}
        >
          {store.isLoadingAppId ? (
            <>
              <SpinningCircle width={14} height={14} color="white" />
              <span>Searching...</span>
            </>
          ) : (
            'Search App ID'
          )}
        </button>

        <button
          className="config-button config-button-primary"
          onClick={() => store.createApp()}
          disabled={!store.serverUrl || !store.appName || store.isCreatingApp}
        >
          {store.isCreatingApp ? (
            <>
              <SpinningCircle width={14} height={14} color="white" />
              <span>Creating...</span>
            </>
          ) : (
            'Create App'
          )}
        </button>
      </div>

      {store.foundApps.length > 0 && (
        <div className="config-found-apps">
          <div className="config-label">Found Apps:</div>
          {store.foundApps.map((app) => (
            <div key={app.appId} className="config-app-item">
              <div className="config-app-info">
                <div className="config-app-name">{app.appName}</div>
                <div className="config-app-id">{app.appId}</div>
              </div>
              {app.appId !== store.appId && (
                <button
                  className="config-button-small"
                  onClick={() => store.setAppId(app.appId)}
                >
                  Select
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {store.appError && (
        <div className="config-message-box config-message-error-box">
          <strong>Error</strong>
          <div className="config-message-error-text">{store.appError}</div>
        </div>
      )}
    </div>
  )
})

// App Metadata Panel
const AppMetadataPanel = observer(() => {
  const store = useMongoAppStore()
  if (!store.appMetadata) return null
  
  return (
    <div className="config-panel-content">
        <div className="config-metadata">
          <div className="config-metadata-item">
            <span className="config-metadata-label">App ID:</span>
            <span className="config-metadata-value">{store.appMetadata.appId}</span>
          </div>
          <div className="config-metadata-item">
            <span className="config-metadata-label">App Name:</span>
            <span className="config-metadata-value">{store.appMetadata.appName}</span>
          </div>
          <div className="config-metadata-item">
            <span className="config-metadata-label">ES Index:</span>
            <span className="config-metadata-value">{store.appMetadata.esIndex}</span>
          </div>
          <div className="config-metadata-item">
            <span className="config-metadata-label">Collections:</span>
            <span className="config-metadata-value">
              {store.appMetadata.collections?.length || 0} collection(s)
            </span>
          </div>
          <div className="config-metadata-item">
            <span className="config-metadata-label">Created:</span>
            <span className="config-metadata-value">
              {new Date(store.appMetadata.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
  )
})

// Elasticsearch Index Status Panel
const EsIndexPanel = observer(() => {
  const store = useMongoAppStore()
  if (!store.isConfigured) return null
  
  return (
    <div className="config-panel-content">
        <div className="config-metadata">
          <div className="config-metadata-item">
            <span className="config-metadata-label">Index Name:</span>
            <span className="config-metadata-value">{store.indexName}</span>
          </div>
          <div className="config-metadata-item">
            <span className="config-metadata-label">Status:</span>
            {store.indexExists ? (
              <>
                <span className="config-status-ok">Exists</span>
                <button
                  className="config-button-icon"
                  onClick={() => store.checkIndexExists()}
                  title="Refresh index status"
                >
                  <RefreshIcon width={16} height={16} />
                </button>
              </>
            ) : (
              <>
                <span className="config-status-error">Not Found</span>
                <button
                  className="config-button-small config-button-small-primary config-inline-gap"
                  onClick={() => store.createIndex()}
                >
                  Create
                </button>
              </>
            )}
          </div>
        </div>

        {store.indexSuccess && (
          <div className="config-message-box config-message-success-box">
            <strong>Success</strong>
            <div className="config-message-success-text">{store.indexSuccess}</div>
          </div>
        )}

        {store.indexError && (
          <div className="config-message-box config-message-error-box">
            <strong>Error</strong>
            <div className="config-message-error-text">{store.indexError}</div>
          </div>
        )}
      </div>
  )
})

// Collections Status Panel
const CollectionsPanel = observer(({ collections }) => {
  const store = useMongoAppStore()
  if (!store.isConfigured) return null
  
  return (
    <div className="config-panel-content">
      {store.isCheckingCollections ? (
        <div className="config-loading">Checking collections...</div>
      ) : (
        <div className="config-collections">
          {collections.map((collName) => {
            const exists = store.collectionStatus[collName]
            return (
              <div key={collName} className="config-collection-item">
                <div className="config-collection-name">{collName}</div>
                <div className="config-collection-status">
                  {exists ? (
                    <span className="config-status-ok">Exists</span>
                  ) : (
                    <button
                      className="config-button-small config-button-small-primary"
                      onClick={() => store.createCollection(collName)}
                    >
                      Create
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {store.collectionError && (
        <div className="config-message-box config-message-error-box">
          <strong>Error</strong>
          <div className="config-message-error-text">{store.collectionError}</div>
        </div>
      )}
    </div>
  )
})

const MongoAppConfigInner = observer(({ collections, onConfigChange, panels_existence }) => {
  const store = useMongoAppStore()
  const hasInitialized = useRef(false)
  const collectionsRef = useRef(collections)
  
  // Keep collections ref up to date
  collectionsRef.current = collections
  
  // Auto-test connection and search on mount
  useEffect(() => {
    if (!store || hasInitialized.current) return
    
    hasInitialized.current = true
    
    const initConfig = async () => {
      // Only test connection if panels_existence is enabled and method exists
      if (panels_existence.showTestConnection && typeof store.testConnection === 'function' && store.serverUrl) {
        try {
          // Test connection first
          const connected = await store.testConnection()

          // If connected and appName set but no appId, search for it
          if (connected && store.appName && !store.appId && typeof store.searchAppId === 'function') {
            await store.searchAppId()
          }
        } catch (error) {
          console.error('Error during initialization:', error)
        }
      }
    }

    initConfig()
  }, [])

  // Auto-check collections, metadata, and index when appId changes
  useEffect(() => {
    const dispose = reaction(
      () => ({ 
        appId: store.appId, 
        serverUrl: store.serverUrl
      }),
      ({ appId, serverUrl }) => {
        if (appId && serverUrl) {
          const currentCollections = collectionsRef.current
          if (currentCollections && currentCollections.length > 0) {
            store.checkCollections(currentCollections)
          }
          store.fetchAppMetadata()
          store.checkIndexExists()
        }
      },
      { fireImmediately: true }
    )
    
    return () => dispose()
  }, [store])

  // Check collections when they become available
  useEffect(() => {
    if (store.isConfigured && collections && collections.length > 0) {
      store.checkCollections(collections)
    }
  }, [store, store.isConfigured, collections.length])

  // Notify parent when configuration changes
  useEffect(() => {
    if (!onConfigChange) return
    
    const dispose = reaction(
      () => ({
        serverUrl: store.serverUrl,
        appId: store.appId,
        appName: store.appName,
        isConfigured: store.isConfigured,
      }),
      (config) => {
        onConfigChange(config)
      },
      { fireImmediately: true }
    )
    
    return () => dispose()
  }, [store, onConfigChange])

  // Trigger word pairs load when app is configured
  useEffect(() => {
    if (store.isConfigured && store.connectionSuccess) {
      // Signal that app is ready - other components can listen to this
      window.dispatchEvent(new CustomEvent('app-configured'))
    }
  }, [store.isConfigured, store.connectionSuccess])

  return (
    <div className="config-container">
      <div className="config-title">Configuration</div>

      {panels_existence.showTestConnection && (
        <PanelToggle title="Server URL" defaultExpanded={!store.serverUrl}>
          <TestConnection />
        </PanelToggle>
      )}
      {panels_existence.showAppIdManagement && (
        <PanelToggle title="App ID Management" defaultExpanded={!store.appId}>
          <AppIdPanel />
        </PanelToggle>
      )}
      {panels_existence.showAppMetadata && (
        <PanelToggle title="App Metadata" defaultExpanded={false}>
          <AppMetadataPanel />
        </PanelToggle>
      )}
      {panels_existence.showIndexStatus && (
        <PanelToggle title="Elasticsearch Index" defaultExpanded={false}>
          <EsIndexPanel />
        </PanelToggle>
      )}
      {panels_existence.showCollections && (
        <PanelToggle title="Collections" defaultExpanded={true}>
          <MongoAppCollectionConfig store={store} collections={collections} />
        </PanelToggle>
      )}
      {panels_existence.showGroovyApi && (
        <PanelToggle title="Groovy API Scripts" defaultExpanded={true}>
          <MongoAppGroovyApi store={store} />
        </PanelToggle>
      )}
      {panels_existence.showGroovyApiTest && (
        <PanelToggle title="Test MongoApp Groovy APIs" defaultExpanded={true}>
          <MongoAppGroovyApiTest store={store} />
        </PanelToggle>
      )}
    </div>
  )
})

// component that is exported
const MongoAppConfig = ({ 
  collections = [], 
  appName = '', 
  defaultServerUrl = '', 
  localStorageKey = 'mongo-app-config',
  onConfigChange = null,
  externalStore = null,
  panels_existence = null
}) => {
  const panelsExistence = panels_existence || {
    showTestConnection: true,
    showAppIdManagement: true,
    showAppMetadata: true,
    showIndexStatus: true,
    showCollections: true,
    showGroovyApi: true,
    showGroovyApiTest: true
  }

  // If external store is provided, use ExternalStoreProvider
  if (externalStore) {
    return (
      <ExternalStoreProvider store={externalStore}>
        <MongoAppConfigInner collections={collections} onConfigChange={onConfigChange} panels_existence={panelsExistence} />
      </ExternalStoreProvider>
    )
  }

  // Otherwise use internal StoreProvider
  return (
    <StoreProvider appName={appName} defaultServerUrl={defaultServerUrl} localStorageKey={localStorageKey}>
      <MongoAppConfigInner collections={collections} onConfigChange={onConfigChange} panels_existence={panelsExistence} />
    </StoreProvider>
  )
}

export default MongoAppConfig
