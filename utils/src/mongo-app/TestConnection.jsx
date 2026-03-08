import { observer } from 'mobx-react-lite'
import { useState } from 'react'
import { SpinningCircle } from '@wwf971/react-comp-misc'
import { useMongoAppStore } from './mongoAppStore.jsx'
import './MongoAppConfig.css'

const TestConnection = observer(() => {
  const store = useMongoAppStore()
  const [isEditingUrl, setIsEditingUrl] = useState(false)
  const [editUrlValue, setEditUrlValue] = useState(store.backendUrl)

  const handleEditUrl = () => {
    setEditUrlValue(store.backendUrl)
    setIsEditingUrl(true)
  }

  const handleSaveUrl = () => {
    if (editUrlValue.trim()) {
      store.setBackendUrl(editUrlValue.trim())
      setIsEditingUrl(false)
    }
  }

  const handleCancelUrl = () => {
    setEditUrlValue(store.backendUrl)
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
    <div className="config-panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
          <div className="config-value">{store.backendUrl || '(not set)'}</div>
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
          disabled={!store.backendUrl || store.isTestingConnection}
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
  )
})

export default TestConnection
