import React, { useMemo, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { SpinningCircle, RefreshIcon, PanelPopup } from '@wwf971/react-comp-misc'
import Tag from '../ui/Tag.jsx'
import './mongoApp.css'

const MongoAppSelector = observer(({
  apps = [],
  selectedAppId = '',
  isLoading = false,
  error = null,
  title = 'Select One Mongo App',
  onSelectApp,
  onRefresh,
  onRenameApp,
  onDeleteApp,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('tags')
  const [renamePopup, setRenamePopup] = useState(null)
  const [deletePopup, setDeletePopup] = useState(null)
  const [popupLoading, setPopupLoading] = useState(false)
  const [popupMessage, setPopupMessage] = useState(null)

  const selectedApp = useMemo(
    () => apps.find((app) => app.appId === selectedAppId) || null,
    [apps, selectedAppId]
  )

  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) {
      return apps
    }

    const query = searchQuery.toLowerCase()
    return apps.filter((app) => {
      const appName = (app.appName || '').toLowerCase()
      const appId = (app.appId || '').toLowerCase()
      return appName.includes(query) || appId.includes(query)
    })
  }, [apps, searchQuery])

  const handleAppClick = (app) => {
    if (onSelectApp) {
      onSelectApp(app)
    }
  }

  const handleRenameConfirm = async (newName) => {
    if (!onRenameApp || !renamePopup) return
    if (!newName || !newName.trim()) {
      setPopupMessage({ text: 'Name cannot be empty', type: 'error' })
      return
    }

    setPopupLoading(true)
    setPopupMessage(null)

    try {
      const result = await onRenameApp(renamePopup, newName.trim())
      if (result?.code === 0) {
        setPopupMessage({ text: 'Renamed successfully', type: 'success' })
        setTimeout(() => {
          setRenamePopup(null)
          setPopupMessage(null)
        }, 1000)
      } else {
        setPopupMessage({ text: result?.message || 'Failed to rename', type: 'error' })
      }
    } catch (error) {
      setPopupMessage({ text: error instanceof Error ? error.message : 'Network error', type: 'error' })
    } finally {
      setPopupLoading(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!onDeleteApp || !deletePopup) return

    setPopupLoading(true)
    setPopupMessage(null)

    try {
      const result = await onDeleteApp(deletePopup)
      if (result?.code === 0) {
        setPopupMessage({ text: 'Deleted successfully', type: 'success' })
        setTimeout(() => {
          setDeletePopup(null)
          setPopupMessage(null)
        }, 1000)
      } else {
        setPopupMessage({ text: result?.message || 'Failed to delete', type: 'error' })
      }
    } catch (error) {
      setPopupMessage({ text: error instanceof Error ? error.message : 'Network error', type: 'error' })
    } finally {
      setPopupLoading(false)
    }
  }

  return (
    <div style={{ padding: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
          {title}{!isLoading && ` (${apps.length} in total)`}
        </div>
        <button className="mongo-app-icon-button" onClick={onRefresh} title="Refresh" disabled={isLoading || !onRefresh}>
          <RefreshIcon width={16} height={16} />
        </button>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <input
          type="text"
          placeholder="Search by name or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setViewMode(viewMode === 'list' ? 'tags' : 'list')}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            minWidth: '50px',
          }}
          title={`Switch to ${viewMode === 'list' ? 'tags' : 'list'} view`}
        >
          {viewMode === 'list' ? 'Display as Tags' : 'Display as List'}
        </button>
        <button
          onClick={() => setSearchQuery('')}
          disabled={!searchQuery}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: searchQuery ? '#f5f5f5' : '#fafafa',
            color: searchQuery ? '#333' : '#999',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: searchQuery ? 'pointer' : 'not-allowed',
          }}
          title="Clear search"
        >
          Clear
        </button>
        {onRenameApp && (
          <button
            onClick={() => {
              if (selectedApp) setRenamePopup(selectedApp)
            }}
            disabled={!selectedApp}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: selectedApp ? '#2196F3' : '#fafafa',
              color: selectedApp ? 'white' : '#999',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: selectedApp ? 'pointer' : 'not-allowed',
            }}
            title="Rename selected app"
          >
            Rename
          </button>
        )}
        {onDeleteApp && (
          <button
            onClick={() => {
              if (selectedApp) setDeletePopup(selectedApp)
            }}
            disabled={!selectedApp}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: selectedApp ? '#dc3545' : '#fafafa',
              color: selectedApp ? 'white' : '#999',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: selectedApp ? 'pointer' : 'not-allowed',
            }}
            title="Delete selected app"
          >
            Delete
          </button>
        )}
      </div>

      {error && <div className="mongo-app-error">Error: {error}</div>}

      {isLoading ? (
        <div className="mongo-app-loading">
          <SpinningCircle width={24} height={24} />
          <span>Loading apps...</span>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="mongo-app-empty">
          {searchQuery ? 'No matching apps found' : 'No apps found'}
        </div>
      ) : viewMode === 'tags' ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {filteredApps.map((app) => (
            <Tag
              key={app.appId}
              isClickable
              isSelected={selectedAppId === app.appId}
              onClick={() => handleAppClick(app)}
              contentComponent={
                <>
                  <div style={{ fontSize: '13px' }}>{app.appName}</div>
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '2px', fontFamily: 'monospace' }}>
                    {app.appId}
                  </div>
                </>
              }
            />
          ))}
        </div>
      ) : (
        <div className="mongo-app-list">
          {filteredApps.map((app) => (
            <div
              key={app.appId}
              className={`mongo-app-item ${selectedAppId === app.appId ? 'mongo-app-item-selected' : ''}`}
              onClick={() => handleAppClick(app)}
            >
              <div className="mongo-app-item-name">{app.appName}</div>
              <div className="mongo-app-item-id">{app.appId}</div>
            </div>
          ))}
        </div>
      )}

      {renamePopup && (
        <PanelPopup
          type="input"
          title="Rename Mongo App"
          message={`Rename app "${renamePopup.appName}" (ID: ${renamePopup.appId})`}
          statusMessage={popupMessage?.text}
          statusType={popupMessage?.type}
          confirmText="Rename"
          cancelText="Cancel"
          isLoading={popupLoading}
          inputProps={{
            placeholder: 'Enter new name',
            defaultValue: renamePopup.appName,
            required: true,
          }}
          onConfirm={handleRenameConfirm}
          onCancel={() => {
            if (!popupLoading) {
              setRenamePopup(null)
              setPopupMessage(null)
            }
          }}
        />
      )}

      {deletePopup && (
        <PanelPopup
          type="confirm"
          title="Delete Mongo App"
          message={`Are you sure you want to delete "${deletePopup.appName}" (ID: ${deletePopup.appId})? This action cannot be undone and will delete all associated data.`}
          statusMessage={popupMessage?.text}
          statusType={popupMessage?.type}
          confirmText="Delete"
          cancelText="Cancel"
          isDanger
          isLoading={popupLoading}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            if (!popupLoading) {
              setDeletePopup(null)
              setPopupMessage(null)
            }
          }}
        />
      )}
    </div>
  )
})

export default MongoAppSelector
