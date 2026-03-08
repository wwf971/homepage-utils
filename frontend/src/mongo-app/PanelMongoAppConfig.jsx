import React, { useEffect } from 'react'
import { MongoAppSelector } from '@wwf971/homepage-utils-utils'
import MongoAppCard from './MongoAppCard'
import { mongoAppStore } from './mongoAppStore'
import '@wwf971/homepage-utils-utils/mongoApp.css'

const PanelMongoAppConfig = () => {
  const handleRefresh = () => mongoAppStore.fetchAllApps()

  const handleSelectApp = (selectedApp) => {
    mongoAppStore.selectApp(selectedApp?.appId || null)
  }

  const handleRenameApp = async (selectedApp, newName) => {
    const response = await fetch(`${mongoAppStore.apiBase}/${selectedApp.appId}/rename`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName }),
    })

    const result = await response.json()
    if (result.code === 0) {
      await mongoAppStore.fetchAllApps()
    }
    return result
  }

  const handleDeleteApp = async (selectedApp) => {
    const response = await fetch(`${mongoAppStore.apiBase}/${selectedApp.appId}/delete`, {
      method: 'DELETE',
    })

    const result = await response.json()
    if (result.code === 0) {
      await mongoAppStore.fetchAllApps()
      if (mongoAppStore.selectedAppId === selectedApp.appId) {
        mongoAppStore.selectApp(null)
      }
    }
    return result
  }

  useEffect(() => {
    handleRefresh()
  }, [])

  return (
    // left-right layout
    <div className="mongo-app-panel">
      <MongoAppSelector
        apps={mongoAppStore.allApps}
        selectedAppId={mongoAppStore.selectedAppId}
        isLoading={mongoAppStore.isLoadingAllApps}
        error={mongoAppStore.allAppsError}
        onRefresh={handleRefresh}
        onSelectApp={handleSelectApp}
        onRenameApp={handleRenameApp}
        onDeleteApp={handleDeleteApp}
      />
      <MongoAppCard title="Selected Mongo App Details" />
    </div>
  )
}

export default PanelMongoAppConfig
