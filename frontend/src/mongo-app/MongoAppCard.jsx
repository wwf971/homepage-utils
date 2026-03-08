import React, { useMemo } from 'react'
import { observer } from 'mobx-react-lite'
import { MongoAppConfig as MongoAppConfigPanel} from '@wwf971/homepage-utils-utils'
import { mongoAppStore } from './mongoAppStore'
// CSS imported in PanelMongoAppConfig.jsx

const EMPTY_ARRAY = []
const SECTIONS_EXISTENCE = {
  showTestConnection: false,
  showAppMetadata: true,
  showCollections: true,
  showEsIndices: true,
  showGroovyApi: true,
  showGroovyApiTest: true
}

const MongoAppCard = observer(({ title = 'Configuration' }) => {
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
    // make MongoAppConfigPanel use data from the store provided by us, instead of using its own store
    <div className="mongo-app-card-container">
      <MongoAppConfigPanel
        externalStore={store}
        collections={collections}
        panelsExistence={SECTIONS_EXISTENCE}
        title={title}
      />
    </div>
  )
})

export default MongoAppCard
