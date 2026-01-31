import React, { useEffect } from 'react'
import { observer } from 'mobx-react-lite'
import { SpinningCircle, RefreshIcon } from '@wwf971/react-comp-misc'
import { mongoAppStore } from './mongoAppStore'
import './mongoApp.css'

const MongoAppListAll = observer(() => {
  const store = mongoAppStore

  useEffect(() => {
    store.fetchAllApps()
  }, [])

  const handleRefresh = () => {
    store.fetchAllApps()
  }

  const handleAppClick = (appId) => {
    store.selectApp(appId)
  }

  if (store.isLoadingAllApps) {
    return (
      <div className="mongo-app-list-container">
        <div className="mongo-app-list-header">
          <div className="mongo-app-list-title">Mongo Apps</div>
        </div>
        <div className="mongo-app-loading">
          <SpinningCircle width={24} height={24} />
          <span>Loading apps...</span>
        </div>
      </div>
    )
  }

  if (store.allAppsError) {
    return (
      <div className="mongo-app-list-container">
        <div className="mongo-app-list-header">
          <div className="mongo-app-list-title">Mongo Apps</div>
          <button className="mongo-app-icon-button" onClick={handleRefresh} title="Refresh">
            <RefreshIcon width={16} height={16} />
          </button>
        </div>
        <div className="mongo-app-error">
          Error: {store.allAppsError}
        </div>
      </div>
    )
  }

  return (
    <div className="mongo-app-list-container">
      <div className="mongo-app-list-header">
        <div className="mongo-app-list-title">Mongo Apps ({store.allApps.length})</div>
        <button className="mongo-app-icon-button" onClick={handleRefresh} title="Refresh">
          <RefreshIcon width={16} height={16} />
        </button>
      </div>
      
      {store.allApps.length === 0 ? (
        <div className="mongo-app-empty">No apps found</div>
      ) : (
        <div className="mongo-app-list">
          {store.allApps.map((app) => (
            <div
              key={app.appId}
              className={`mongo-app-item ${store.selectedAppId === app.appId ? 'mongo-app-item-selected' : ''}`}
              onClick={() => handleAppClick(app.appId)}
            >
              <div className="mongo-app-item-name">{app.appName}</div>
              <div className="mongo-app-item-id">{app.appId}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

export default MongoAppListAll
