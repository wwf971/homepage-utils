import { observer } from 'mobx-react-lite'
import { useEffect, useState } from 'react'
import { PanelWithToggle, SpinningCircle } from '@wwf971/react-comp-misc'
import { StoreProvider, useMongoAppStore } from './mongoAppStore.jsx'
import './MongoAppConfig.css'

// Separate component for Server URL panel to prevent unnecessary re-renders
const ServerUrlPanel = observer(() => {
  const store = useMongoAppStore()
  const [isEditingUrl, setIsEditingUrl] = useState(false)
  const [editUrlValue, setEditUrlValue] = useState(store.serverUrl)

  const handleEditUrl = () => {
    setEditUrlValue(store.serverUrl)
    setIsEditingUrl(true)
  }

  const handleSaveUrl = () => {
    if (editUrlValue.trim()) {
      store.setServerUrl(editUrlValue.trim())
      setIsEditingUrl(false)
    }
  }

  const handleCancelUrl = () => {
    setEditUrlValue(store.serverUrl)
    setIsEditingUrl(false)
  }

  const handleUrlKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveUrl()
    } else if (e.key === 'Escape') {
      handleCancelUrl()
    }
  }

  return (
    <PanelWithToggle title="Server URL" defaultExpanded={!store.serverUrl}>
      <div className="config-panel-content">
        {isEditingUrl ? (
          <div className="config-row">
            <label className="config-label">Server URL:</label>
            <input
              type="text"
              className="config-input config-input-editing"
              value={editUrlValue}
              onChange={(e) => setEditUrlValue(e.target.value)}
              onKeyDown={handleUrlKeyDown}
              placeholder="http://localhost:8080"
              autoFocus
            />
            <button
              className="config-button config-button-primary"
              onClick={handleSaveUrl}
            >
              Save
            </button>
            <button
              className="config-button config-button-secondary"
              onClick={handleCancelUrl}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="config-row">
            <label className="config-label">Server URL:</label>
            <div className="config-value">{store.serverUrl || '(not set)'}</div>
            <button
              className="config-button config-button-edit"
              onClick={handleEditUrl}
            >
              Edit
            </button>
          </div>
        )}

        <div className="config-button-row">
          <button
            className="config-button config-button-primary"
            onClick={() => store.testConnection()}
            disabled={!store.serverUrl || store.isTestingConnection}
          >
            {store.isTestingConnection ? (
              <>
                <SpinningCircle width={14} height={14} color="white" />
                <span>Testing...</span>
              </>
            ) : (
              'Test Connection'
            )}
          </button>
        </div>

        {store.connectionSuccess && (
          <div className="config-message-box config-message-success-box">
            <strong>Success</strong>
            <div className="config-message-success-text">Connected to backend server successfully</div>
          </div>
        )}

        {store.connectionError && (
          <div className="config-message-box config-message-error-box">
            <strong>Failed</strong>
            <div className="config-message-error-text">{store.connectionError}</div>
          </div>
        )}
      </div>
    </PanelWithToggle>
  )
})

// App ID Management Panel
const AppIdPanel = observer(() => {
  const store = useMongoAppStore()
  
  return (
  <PanelWithToggle title="App ID Management" defaultExpanded={!store.appId}>
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
  </PanelWithToggle>
  )
})

// App Metadata Panel
const AppMetadataPanel = observer(() => {
  const store = useMongoAppStore()
  if (!store.appMetadata) return null
  
  return (
    <PanelWithToggle title="App Metadata" defaultExpanded={false}>
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
    </PanelWithToggle>
  )
})

// Elasticsearch Index Status Panel
const EsIndexPanel = observer(() => {
  const store = useMongoAppStore()
  if (!store.isConfigured) return null
  
  return (
    <PanelWithToggle title="Elasticsearch Index" defaultExpanded={false}>
      <div className="config-panel-content">
        <div className="config-metadata">
          <div className="config-metadata-item">
            <span className="config-metadata-label">Index Name:</span>
            <span className="config-metadata-value">{store.indexName}</span>
          </div>
          <div className="config-metadata-item">
            <span className="config-metadata-label">Status:</span>
            {store.indexExists ? (
              <span className="config-status-ok">Exists</span>
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
    </PanelWithToggle>
  )
})

// Collections Status Panel
const CollectionsPanel = observer(({ collections }) => {
  const store = useMongoAppStore()
  if (!store.isConfigured) return null
  
  return (
    <PanelWithToggle title="Collections Status" defaultExpanded={true}>
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
  </PanelWithToggle>
  )
})

const MongoAppConfigInner = observer(({ collections, onConfigChange }) => {
  const store = useMongoAppStore()
  
  // Auto-test connection and search on mount
  useEffect(() => {
    const initConfig = async () => {
      if (store.serverUrl) {
        // Test connection first
        const connected = await store.testConnection()

        // If connected and appName set but no appId, search for it
        if (connected && store.appName && !store.appId) {
          await store.searchAppId()
        }
      }
    }

    initConfig()
  }, [])

  // Auto-check collections, metadata, and index when appId changes
  useEffect(() => {
    if (store.isConfigured) {
      store.checkCollections(collections)
      store.fetchAppMetadata()
      store.checkIndexExists()
    }
  }, [store.appId, store.isConfigured, collections])

  // Notify parent when configuration changes
  useEffect(() => {
    if (onConfigChange) {
      onConfigChange({
        serverUrl: store.serverUrl,
        appId: store.appId,
        appName: store.appName,
        isConfigured: store.isConfigured,
      })
    }
  }, [store.serverUrl, store.appId, store.appName, store.isConfigured, onConfigChange])

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

      <ServerUrlPanel />
      <AppIdPanel />
      <AppMetadataPanel />
      <EsIndexPanel />
      <CollectionsPanel collections={collections} />
    </div>
  )
})

// Main exported component with provider
const MongoAppConfig = ({ 
  collections = [], 
  appName = '', 
  defaultServerUrl = '', 
  localStorageKey = 'mongo-app-config',
  onConfigChange = null
}) => {
  return (
    <StoreProvider appName={appName} defaultServerUrl={defaultServerUrl} localStorageKey={localStorageKey}>
      <MongoAppConfigInner collections={collections} onConfigChange={onConfigChange} />
    </StoreProvider>
  )
}

export default MongoAppConfig
