import React, { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { SpinningCircle } from '@wwf971/react-comp-misc'
import { mongoAppStore } from './mongoAppStore'
import '@wwf971/homepage-utils-utils/mongoApp.css'

const PanelMongoAppCreate = observer(() => {
  const store = mongoAppStore
  const [appName, setAppName] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [nameCheckResult, setNameCheckResult] = useState(null)
  const [createError, setCreateError] = useState(null)
  const [createSuccess, setCreateSuccess] = useState(null)

  const handleCheckName = async () => {
    if (!appName.trim()) {
      setNameCheckResult(null)
      return
    }

    setIsChecking(true)
    setNameCheckResult(null)
    
    const result = await store.checkAppNameExists(appName.trim())
    
    setIsChecking(false)
    setNameCheckResult(result)
  }

  const handleCreateApp = async () => {
    if (!appName.trim()) {
      setCreateError('App name is required')
      return
    }

    setCreateError(null)
    setCreateSuccess(null)

    const result = await store.createMongoApp(appName.trim())

    if (result.code === 0) {
      setCreateSuccess(`App "${appName}" created successfully with ID: ${result.data.appId}`)
      setAppName('')
      setNameCheckResult(null)
    } else {
      setCreateError(result.message || 'Failed to create app')
    }
  }

  const handleNameChange = (e) => {
    setAppName(e.target.value)
    setNameCheckResult(null)
    setCreateError(null)
    setCreateSuccess(null)
  }

  return (
    <div style={{ padding: '12px' }}>
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
          Create New Mongo App
        </div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
          App Name
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={appName}
            onChange={handleNameChange}
            placeholder="Enter app name..."
            style={{
              flex: 1,
              padding: '8px',
              fontSize: '13px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCheckName()
              }
            }}
          />
          <button
            onClick={handleCheckName}
            disabled={!appName.trim() || isChecking}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              backgroundColor: appName.trim() && !isChecking ? '#2196F3' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: appName.trim() && !isChecking ? 'pointer' : 'not-allowed',
              minWidth: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {isChecking ? (
              <>
                <SpinningCircle width={14} height={14} color="white" />
                <span>Checking...</span>
              </>
            ) : (
              'Check'
            )}
          </button>
        </div>
      </div>

      {nameCheckResult && (
        <div style={{
          marginBottom: '16px',
          padding: '10px',
          borderRadius: '4px',
          backgroundColor: nameCheckResult.exists ? '#fff3cd' : '#d4edda',
          border: `1px solid ${nameCheckResult.exists ? '#ffc107' : '#28a745'}`,
          fontSize: '13px'
        }}>
          {nameCheckResult.exists ? (
            <div>
              <div style={{ fontWeight: '500', marginBottom: '4px', color: '#856404' }}>
                Warning: {nameCheckResult.apps.length} app(s) with this name already exist
              </div>
              <div style={{ fontSize: '12px', color: '#856404' }}>
                You can still create a new app with this name (they will have different IDs):
              </div>
              <ul style={{ margin: '6px 0 0 20px', padding: 0 }}>
                {nameCheckResult.apps.map((app, idx) => (
                  <li key={idx} style={{ color: '#856404', fontFamily: 'monospace', fontSize: '11px' }}>
                    ID: {app.appId}, Created: {new Date(app.createdAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div style={{ color: '#155724', fontWeight: '500' }}>
              No existing apps with this name
            </div>
          )}
        </div>
      )}

      {createError && (
        <div style={{
          marginBottom: '8px',
          padding: '10px',
          borderRadius: '4px',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          fontSize: '13px',
          color: '#721c24'
        }}>
          Error: {createError}
        </div>
      )}

      {createSuccess && (
        <div style={{
          marginBottom: '8px',
          padding: '10px',
          borderRadius: '4px',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          fontSize: '13px',
          color: '#155724'
        }}>
          {createSuccess}
        </div>
      )}

      <div>
        <button
          onClick={handleCreateApp}
          disabled={!appName.trim() || store.isCreatingApp}
          style={{
            padding: '6px 12px',
            fontSize: '14px',
            fontWeight: '500',
            backgroundColor: appName.trim() && !store.isCreatingApp ? '#4CAF50' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: appName.trim() && !store.isCreatingApp ? 'pointer' : 'not-allowed',
            minWidth: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          {store.isCreatingApp ? (
            <>
              <SpinningCircle width={16} height={16} color="white" />
              <span>Creating...</span>
            </>
          ) : (
            'Create App'
          )}
        </button>
      </div>
    </div>
  )
})

export default PanelMongoAppCreate
