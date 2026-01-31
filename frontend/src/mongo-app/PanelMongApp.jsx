import React from 'react'
import MongoAppListAll from './MongoAppListAll'
import MongoAppCard from './MongoAppCard'
import './mongoApp.css'

const PanelMongoApp = () => {
  return (
    <div className="mongo-app-panel">
      <MongoAppListAll />
      <MongoAppCard />
    </div>
  )
}

export default PanelMongoApp
