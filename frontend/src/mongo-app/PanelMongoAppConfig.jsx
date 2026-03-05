import React from 'react'
import { MongoAppListAll } from '@wwf971/homepage-utils-utils'
import MongoAppCard from './MongoAppCard'
import { mongoAppStore } from './mongoAppStore'
import '@wwf971/homepage-utils-utils/mongoApp.css'

const PanelMongoAppConfig = () => {
  return (
    // left-right layout
    <div className="mongo-app-panel">
      <MongoAppListAll store={mongoAppStore} />
      <MongoAppCard title="Selected Mongo App Details" />
    </div>
  )
}

export default PanelMongoAppConfig
