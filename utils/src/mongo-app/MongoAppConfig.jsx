import { observer } from 'mobx-react-lite'
import { reaction } from 'mobx'
import { useEffect, useRef } from 'react'
import { PanelToggle, SpinningCircle, RefreshIcon } from '@wwf971/react-comp-misc'
import { formatTimestamp, getTimezoneInt } from '@wwf971/homepage-utils-utils/utils'
import { StoreProvider, ExternalStoreProvider, useMongoAppStore } from './mongoAppStore.jsx'
import TestConnection from './TestConnection.jsx'
import MongoAppGroovyApi from './groovy-api/MongoAppGroovyApi.jsx'
import MongoAppGroovyApiTest from './groovy-api/MongoAppGroovyApiTest.jsx'
import MongoAppCollectionConfig from './MongoAppCollectionConfig.jsx'
import MongoAppEsConfig from './MongoAppEsConfig.jsx'
import './MongoAppConfig.css'

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
            <span className="config-metadata-label">Collections:</span>
            <span className="config-metadata-value">
              {store.appMetadata.collections?.length || 0} collection(s)
            </span>
          </div>
          <div className="config-metadata-item">
            <span className="config-metadata-label">Created:</span>
            <span className="config-metadata-value">
              {formatTimestamp(store.appMetadata.createdAt, getTimezoneInt())}
            </span>
          </div>
        </div>
      </div>
  )
})

const MongoAppConfigInner = observer(({ collections, onConfigChange, panels_existence, title = 'Configuration' }) => {
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
      {title && (
        <div className="config-title">{title}</div>
      )}

      {panels_existence.showTestConnection && (
        <PanelToggle title="Server URL" defaultExpanded={!store.serverUrl}>
          <TestConnection />
        </PanelToggle>
      )}
      {panels_existence.showAppMetadata && (
        <PanelToggle title="App Metadata" defaultExpanded={false}>
          <AppMetadataPanel />
        </PanelToggle>
      )}
      {panels_existence.showCollections && (
        <PanelToggle title="Collections" defaultExpanded={true}>
          <MongoAppCollectionConfig store={store} collections={collections} />
        </PanelToggle>
      )}
      {panels_existence.showEsIndices && (
        <PanelToggle title="ES Indices" defaultExpanded={false}>
          <MongoAppEsConfig store={store} />
        </PanelToggle>
      )}
      {panels_existence.showGroovyApi && (
        <PanelToggle title="Groovy API Scripts" defaultExpanded={true}>
          <MongoAppGroovyApi store={store} />
        </PanelToggle>
      )}
      {panels_existence.showGroovyApiTest && (
        <PanelToggle title="Groovy API Scripts Test" defaultExpanded={true}>
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
  panels_existence = null,
  title = 'Configuration'
}) => {
  const panelsExistence = panels_existence || {
    showTestConnection: true,
    showAppMetadata: true,
    showCollections: true,
    showEsIndices: true,
    showGroovyApi: true,
    showGroovyApiTest: true
  }

  // If external store is provided, use ExternalStoreProvider
  if (externalStore) {
    return (
      <ExternalStoreProvider store={externalStore}>
        <MongoAppConfigInner collections={collections} onConfigChange={onConfigChange} panels_existence={panelsExistence} title={title} />
      </ExternalStoreProvider>
    )
  }

  // Otherwise use internal StoreProvider
  return (
    <StoreProvider appName={appName} defaultServerUrl={defaultServerUrl} localStorageKey={localStorageKey}>
      <MongoAppConfigInner collections={collections} onConfigChange={onConfigChange} panels_existence={panelsExistence} title={title} />
    </StoreProvider>
  )
}

export default MongoAppConfig
