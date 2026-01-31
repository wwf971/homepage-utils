import React, { useMemo } from 'react'
import { observer } from 'mobx-react-lite'
import { MongoAppConfig } from '@wwf971/homepage-utils-utils'
import { mongoAppStore } from './mongoAppStore'
import './mongoApp.css'

const EMPTY_ARRAY = []
const SECTIONS_EXISTENCE = {
  showTestConnection: false,
  showAppIdManagement: false,
  showAppMetadata: true,
  showIndexStatus: true,
  showCollections: true
}

const MongoAppCard = observer(() => {
  const store = mongoAppStore

  // Use useMemo to prevent creating new array reference on every render
  // Must be called before any conditional returns (React Hooks rule)
  const collections = useMemo(() => {
    return store.appMetadata?.collections || EMPTY_ARRAY
  }, [store.appMetadata?.collections])

  if (!store.selectedAppId) {
    return (
      <div className="mongo-app-card-container">
        <div className="mongo-app-card-empty">
          Select an app from the list to view details
        </div>
      </div>
    )
  }

  return (
    <div className="mongo-app-card-container">
      <MongoAppConfig
        externalStore={store}
        collections={collections}
        panels_existence={SECTIONS_EXISTENCE}
      />
    </div>
  )
})

export default MongoAppCard
