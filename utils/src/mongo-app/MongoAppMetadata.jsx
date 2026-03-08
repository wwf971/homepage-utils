import { observer } from 'mobx-react-lite'
import { formatTimestamp, getTimezoneInt } from '@wwf971/homepage-utils-utils/utils'
import { useMongoAppStore } from './mongoAppStore.jsx'

const MongoAppMetadata = observer(() => {
  const store = useMongoAppStore()
  if (!store.appMetadata) {
    return null
  }

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

export default MongoAppMetadata
