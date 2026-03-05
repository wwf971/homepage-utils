import React, { useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { SpinningCircle, RefreshIcon, PanelPopup } from '@wwf971/react-comp-misc'
import Tag from '../ui/Tag.jsx'
import './mongoApp.css'

const MongoAppListAll = observer(({ store }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('tags') // 'tags' or 'list'
  const [renamePopup, setRenamePopup] = useState(null) // { appId, appName }
  const [deletePopup, setDeletePopup] = useState(null) // { appId, appName }
  const [popupLoading, setPopupLoading] = useState(false)
  const [popupMessage, setPopupMessage] = useState(null) // { text, type }

  useEffect(() => {
    if (!store) return
    store.fetchAllApps()
  }, [store])

  const handleRefresh = () => {
    if (!store) return
    store.fetchAllApps()
  }

  const handleAppClick = (appId) => {
    if (!store) return
    store.selectApp(appId)
  }
  
  const handleRenameClick = (app) => {
    setRenamePopup({ appId: app.appId, appName: app.appName })
    setPopupMessage(null)
  }
  
  const handleDeleteClick = (app) => {
    setDeletePopup({ appId: app.appId, appName: app.appName })
    setPopupMessage(null)
  }
  
  const handleRenameConfirm = async (newName) => {
    if (!newName || !newName.trim()) {
      setPopupMessage({ text: 'Name cannot be empty', type: 'error' })
      return
    }
    
    setPopupLoading(true)
    setPopupMessage(null)
    
    try {
      const response = await fetch(`${store.apiBase}/${renamePopup.appId}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: newName.trim() })
      })
      
      const result = await response.json()
      
      if (result.code === 0) {
        setPopupMessage({ text: 'Renamed successfully!', type: 'success' })
        await store.fetchAllApps()
        setTimeout(() => {
          setRenamePopup(null)
          setPopupMessage(null)
        }, 1000)
      } else {
        setPopupMessage({ text: result.message || 'Failed to rename', type: 'error' })
      }
    } catch (error) {
      setPopupMessage({ text: error.message || 'Network error', type: 'error' })
    } finally {
      setPopupLoading(false)
    }
  }
  
  const handleDeleteConfirm = async () => {
    setPopupLoading(true)
    setPopupMessage(null)
    
    try {
      const response = await fetch(`${store.apiBase}/${deletePopup.appId}/delete`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (result.code === 0) {
        setPopupMessage({ text: 'Deleted successfully!', type: 'success' })
        await store.fetchAllApps()
        
        // Clear selection if deleted app was selected
        if (store.selectedAppId === deletePopup.appId) {
          store.selectApp(null)
        }
        
        setTimeout(() => {
          setDeletePopup(null)
          setPopupMessage(null)
        }, 1000)
      } else {
        setPopupMessage({ text: result.message || 'Failed to delete', type: 'error' })
      }
    } catch (error) {
      setPopupMessage({ text: error.message || 'Network error', type: 'error' })
    } finally {
      setPopupLoading(false)
    }
  }

  // Filter apps based on search query
  const filteredApps = store?.allApps?.filter(app => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    const appName = (app.appName || '').toLowerCase()
    const appId = (app.appId || '').toLowerCase()
    return appName.includes(query) || appId.includes(query)
  }) || []
  
  if (!store) {
    return <div style={{ padding: '6px' }}>Store not provided</div>
  }

  return (
    <div style={{ padding: '6px' }}>
      {/* Header with title and refresh button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
          Select One Mongo App{!store.isLoadingAllApps && `(${store.allApps.length} in total)`}
        </div>
        <button className="mongo-app-icon-button" onClick={handleRefresh} title="Refresh">
          <RefreshIcon width={16} height={16} />
        </button>
      </div>

      {/* Search bar */}
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
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* View mode toggle, clear, rename, and delete buttons */}
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
            minWidth: '50px'
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
            cursor: searchQuery ? 'pointer' : 'not-allowed'
          }}
          title="Clear search"
        >
          Clear
        </button>
        <button
          onClick={() => {
            const selected = store.allApps.find(app => app.appId === store.selectedAppId)
            if (selected) handleRenameClick(selected)
          }}
          disabled={!store.selectedAppId}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: store.selectedAppId ? '#2196F3' : '#fafafa',
            color: store.selectedAppId ? 'white' : '#999',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: store.selectedAppId ? 'pointer' : 'not-allowed'
          }}
          title="Rename selected app"
        >
          Rename
        </button>
        <button
          onClick={() => {
            const selected = store.allApps.find(app => app.appId === store.selectedAppId)
            if (selected) handleDeleteClick(selected)
          }}
          disabled={!store.selectedAppId}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: store.selectedAppId ? '#dc3545' : '#fafafa',
            color: store.selectedAppId ? 'white' : '#999',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: store.selectedAppId ? 'pointer' : 'not-allowed'
          }}
          title="Delete selected app"
        >
          Delete
        </button>
      </div>

      {/* Error state */}
      {store.allAppsError && (
        <div className="mongo-app-error">
          Error: {store.allAppsError}
        </div>
      )}

      {/* Loading or content */}
      {store.isLoadingAllApps ? (
        <div className="mongo-app-loading">
          <SpinningCircle width={24} height={24} />
          <span>Loading apps...</span>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="mongo-app-empty">
          {searchQuery ? 'No matching apps found' : 'No apps found'}
        </div>
      ) : viewMode === 'tags' ? (
        /* Tags view */
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {filteredApps.map((app) => (
            <Tag
              key={app.appId}
              isClickable={true}
              isSelected={store.selectedAppId === app.appId}
              onClick={() => handleAppClick(app.appId)}
              contentComponent={
                <>
                  <div style={{ fontSize: '13px' }}>
                    {app.appName}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '2px', fontFamily: 'monospace' }}>
                    {app.appId}
                  </div>
                </>
              }
            />
          ))}
        </div>
      ) : (
        /* List view */
        <div className="mongo-app-list">
          {filteredApps.map((app) => (
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
      
      {/* Rename Popup */}
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
            required: true
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
      
      {/* Delete Popup */}
      {deletePopup && (
        <PanelPopup
          type="confirm"
          title="Delete Mongo App"
          message={`Are you sure you want to delete "${deletePopup.appName}" (ID: ${deletePopup.appId})? This action cannot be undone and will delete all associated data.`}
          statusMessage={popupMessage?.text}
          statusType={popupMessage?.type}
          confirmText="Delete"
          cancelText="Cancel"
          isDanger={true}
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

export default MongoAppListAll
