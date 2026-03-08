import { observer } from 'mobx-react-lite'
import { reaction } from 'mobx'
import { useEffect, useRef } from 'react'
import { PanelToggle } from '@wwf971/react-comp-misc'
import { StoreProvider, ExternalStoreProvider, useMongoAppStore } from './mongoAppStore.jsx'
import TestConnection from './TestConnection.jsx'
import MongoAppGroovyApi from './groovy-api/MongoAppGroovyApi.jsx'
import MongoAppGroovyApiTest from './groovy-api/MongoAppGroovyApiTest.jsx'
import MongoAppCollectionConfig from './MongoAppCollectionConfig.jsx'
import MongoAppEsConfig from './MongoAppEsConfig.jsx'
import MongoAppMetadata from './MongoAppMetadata.jsx'
import MongoAppSelector from './MongoAppSelector.jsx'
import './MongoAppConfig.css'

const MongoAppConfigInner = observer(({ collections, onConfigChange, panelsExistence, title = 'Configuration', appId = '', appName = '' }) => {
  const store = useMongoAppStore()
  const hasInitialized = useRef(false)
  const collectionsRef = useRef(collections)
  const isAppAvailable = !!store.appId
  const shouldShowMissingAppMessage = !!store.backendUrl
    && !isAppAvailable
    && !store.isTestingConnection
    && !store.isLoadingAppId
    && !store.connectionError

  collectionsRef.current = collections

  useEffect(() => {
    if (!store || hasInitialized.current) return

    hasInitialized.current = true

    const initConfig = async () => {
      if (panelsExistence.showTestConnection && typeof store.testConnection === 'function' && store.backendUrl) {
        try {
          const connected = await store.testConnection()
          if (!connected) {
            return
          }

          if (store.appId && typeof store.validateAppId === 'function') {
            const isAppIdValid = await store.validateAppId(store.appId)
            if (!isAppIdValid && store.appName && typeof store.searchAppId === 'function') {
              await store.searchAppId()
            }
          } else if (store.appName && typeof store.searchAppId === 'function') {
            await store.searchAppId()
          }
        } catch (error) {
          console.error('Error during initialization:', error)
        }
      }
    }

    initConfig()
  }, [])

  useEffect(() => {
    const dispose = reaction(
      () => ({
        appId: store.appId,
        backendUrl: store.backendUrl,
      }),
      ({ appId: currentAppId, backendUrl }) => {
        if (currentAppId && backendUrl) {
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

  useEffect(() => {
    if (store.isConfigured && collections && collections.length > 0) {
      store.checkCollections(collections)
    }
  }, [store, store.isConfigured, collections.length])

  useEffect(() => {
    if (!onConfigChange) return

    const dispose = reaction(
      () => ({
        backendUrl: store.backendUrl,
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

  useEffect(() => {
    if (store.isConfigured && store.connectionSuccess) {
      window.dispatchEvent(new CustomEvent('app-configured'))
    }
  }, [store.isConfigured, store.connectionSuccess])

  useEffect(() => {
    if (shouldShowMissingAppMessage && typeof store.fetchAllApps === 'function') {
      store.fetchAllApps()
    }
  }, [shouldShowMissingAppMessage, store])

  return (
    <div className="config-container">
      {title && (
        <div className="config-title">{title}</div>
      )}

      {panelsExistence.showTestConnection && (
        <PanelToggle title="Server URL" defaultExpanded={!store.backendUrl}>
          <TestConnection />
        </PanelToggle>
      )}
      {shouldShowMissingAppMessage && (
        <>
          <div className="config-panel-content">
            <div className="config-message-box config-message-error-box">
              <strong>App Not Found</strong>
              <div className="config-message-error-text">
                {appId && appName
                  ? `App id "${appId}" was not found, and app name "${appName}" was also not found.`
                  : appId
                    ? `App id "${appId}" was not found.`
                    : `App "${store.appName}" was not found. Create the app or select an existing app ID first.`}
              </div>
            </div>
          </div>
          <PanelToggle title="Available Mongo Apps" defaultExpanded={true}>
            <MongoAppSelector
              title="Select one app to continue"
              apps={store.allApps}
              isLoading={store.isLoadingAllApps}
              error={store.allAppsError}
              selectedAppId={store.appId}
              onRefresh={() => store.fetchAllApps()}
              onSelectApp={(selectedApp) => {
                if (!selectedApp?.appId) return
                store.setAppId(selectedApp.appId)
                if (selectedApp.appName) {
                  store.setAppName(selectedApp.appName)
                }
                store.clearAppError()
              }}
            />
          </PanelToggle>
        </>
      )}
      {isAppAvailable && (
        <>
          {panelsExistence.showAppMetadata && (
            <PanelToggle title="App Metadata" defaultExpanded={false}>
              <MongoAppMetadata />
            </PanelToggle>
          )}
          {panelsExistence.showCollections && (
            <PanelToggle title="MongoDB Collections" defaultExpanded={true}>
              <MongoAppCollectionConfig store={store} collections={collections} />
            </PanelToggle>
          )}
          {panelsExistence.showEsIndices && (
            <PanelToggle title="Elasticsearch Indices" defaultExpanded={false}>
              <MongoAppEsConfig store={store} />
            </PanelToggle>
          )}
          {panelsExistence.showGroovyApi && (
            <PanelToggle title="Groovy API Scripts" defaultExpanded={true}>
              <MongoAppGroovyApi store={store} />
            </PanelToggle>
          )}
          {panelsExistence.showGroovyApiTest && (
            <PanelToggle title="Groovy API Scripts Test" defaultExpanded={true}>
              <MongoAppGroovyApiTest store={store} />
            </PanelToggle>
          )}
        </>
      )}
    </div>
  )
})

const MongoAppConfig = ({
  collections = [],
  appId = '',
  appName = '',
  backendUrlDefault = '',
  localStorageKey = 'mongo-app-config',
  onConfigChange = null,
  externalStore = null,
  panelsExistence = null,
  title = 'Configuration',
}) => {
  const panelsExistenceResolved = panelsExistence || {
    showTestConnection: true,
    showAppMetadata: true,
    showCollections: true,
    showEsIndices: true,
    showGroovyApi: true,
    showGroovyApiTest: true,
  }

  if (externalStore) {
    return (
      <ExternalStoreProvider store={externalStore}>
        <MongoAppConfigInner
          collections={collections}
          onConfigChange={onConfigChange}
          panelsExistence={panelsExistenceResolved}
          title={title}
          appId={appId}
          appName={appName}
        />
      </ExternalStoreProvider>
    )
  }

  return (
    <StoreProvider
      appId={appId}
      appName={appName}
      backendUrlDefault={backendUrlDefault}
      localStorageKey={localStorageKey}
    >
      <MongoAppConfigInner
        collections={collections}
        onConfigChange={onConfigChange}
        panelsExistence={panelsExistenceResolved}
        title={title}
        appId={appId}
        appName={appName}
      />
    </StoreProvider>
  )
}

export default MongoAppConfig

