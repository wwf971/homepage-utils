import React, { useState, useEffect, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { PlusIcon, PanelPopup } from '@wwf971/react-comp-misc';
import { FileAccessPointSelector, fileStore, DirSelector } from '@wwf971/homepage-utils-utils';
import CreatePanel from './CreatePanel.jsx';
import MongoAppGroovyApiCard from './MongoAppGroovyApiCard.jsx';
import MongoAppGroovyApiFolder from './MongoAppGroovyApiFolder.jsx';
import groovyApiStore from './groovyApiStore.js';

const MongoAppGroovyApi = observer(({ store }) => {
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  
  // Upload form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  
  // Folder management state
  const [showAddFolderForm, setShowAddFolderForm] = useState(false);
  const [newFolderFapId, setNewFolderFapId] = useState('');
  const [newFolderPath, setNewFolderPath] = useState('');
  const [showFapSelector, setShowFapSelector] = useState(false);
  const [showDirSelector, setShowDirSelector] = useState(false);
  
  // Edit state
  const [editingScriptId, setEditingScriptId] = useState(null);
  const [editEndpoint, setEditEndpoint] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editScriptSource, setEditScriptSource] = useState('');
  
  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState(null);

  const appId = store?.appId;
  const serverUrl = store?.serverUrl;

  const fetchScripts = useCallback(async () => {
    if (!appId || !serverUrl) return;
    
    const result = await groovyApiStore.fetchScripts(serverUrl, appId);
    if (result.code !== 0) {
      setError(result.message || 'Failed to fetch scripts');
    }
  }, [appId, serverUrl]);

  const fetchFolders = useCallback(async () => {
    if (!appId || !serverUrl) return;
    
    await groovyApiStore.fetchFolders(serverUrl, appId);
  }, [appId, serverUrl]);

  useEffect(() => {
    fetchScripts();
    fetchFolders();
    // Also fetch file access points if not already loaded
    if (fileStore.fapIds.length === 0 && !fileStore.fileAccessPointsIsLoading) {
      fileStore.fetchFap();
    }
  }, [fetchScripts, fetchFolders]);

  const handleCreateSuccess = (successMessage) => {
    setMessage(successMessage);
    setShowUploadForm(false);
    fetchScripts();
  };

  const handleUpdate = async (scriptId) => {
    if (!editEndpoint.trim() || !editScriptSource.trim()) {
      setError('Endpoint and script source are required');
      return;
    }
    
    setError(null);
    setMessage(null);
    
    const result = await groovyApiStore.updateScript(serverUrl, appId, scriptId, {
      endpoint: editEndpoint,
      scriptSource: editScriptSource,
      description: editDescription
    });
    
    if (result.code === 0) {
      setMessage('Script updated successfully');
      setEditingScriptId(null);
    } else {
      setError(result.message || 'Failed to update script');
    }
  };

  const handleDelete = (scriptId) => {
    setConfirmDialog({
      message: 'Are you sure you want to delete this script?',
      onConfirm: async () => {
        setConfirmDialog(null);
        setError(null);
        setMessage(null);
        
        const result = await groovyApiStore.deleteScript(serverUrl, appId, scriptId);
        
        if (result.code === 0) {
          setMessage('Script deleted successfully');
        } else {
          setError(result.message || 'Failed to delete script');
        }
      }
    });
  };

  const startEdit = (script) => {
    setEditingScriptId(script.id);
    setEditEndpoint(script.apiPath || script.endpoint);
    setEditDescription(script.description || '');
    setEditScriptSource(getScriptCode(script.scriptSource));
    setError(null);
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingScriptId(null);
    setEditEndpoint('');
    setEditDescription('');
    setEditScriptSource('');
  };

  const handleEditChange = (field, value) => {
    if (field === 'endpoint') setEditEndpoint(value);
    else if (field === 'description') setEditDescription(value);
    else if (field === 'scriptSource') setEditScriptSource(value);
  };

  const handleRefreshFromFile = async (scriptId) => {
    setError(null);
    setMessage(null);
    
    const result = await groovyApiStore.refreshScript(serverUrl, appId, scriptId);
    
    if (result.code === 0) {
      setMessage('Script refreshed from file successfully');
    } else {
      setError(result.message || 'Failed to refresh script');
    }
  };

  const handleAddFolder = async () => {
    if (!newFolderFapId || newFolderPath === '') {
      setError('File access point and path are required');
      return;
    }
    
    setError(null);
    setMessage(null);
    
    const result = await groovyApiStore.addFolder(serverUrl, appId, newFolderFapId, newFolderPath);
    
    if (result.code === 0) {
      setMessage('Folder added successfully');
      setShowAddFolderForm(false);
      setNewFolderFapId('');
      setNewFolderPath('');
      setShowFapSelector(false);
      setShowDirSelector(false);
    } else {
      setError(result.message || 'Failed to add folder');
    }
  };

  const handleRemoveFolder = (fileAccessPointId, path) => {
    setConfirmDialog({
      message: `Are you sure you want to remove folder "${path}" from ${fileAccessPointId}? Scripts from this folder will be deleted.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setError(null);
        setMessage(null);
        
        const result = await groovyApiStore.removeFolder(serverUrl, appId, fileAccessPointId, path);
        
        if (result.code === 0) {
          setMessage('Folder removed successfully');
        } else {
          setError(result.message || 'Failed to remove folder');
        }
      }
    });
  };

  const handleScanFolders = async () => {
    setError(null);
    setMessage(null);
    
    const result = await groovyApiStore.scanFolders(serverUrl, appId);
    
    if (result.code === 0) {
      const { loadedCount, skippedCount } = result.data;
      setMessage(`Scan complete: ${loadedCount} scripts loaded, ${skippedCount} skipped`);
    } else {
      setError(result.message || 'Failed to scan folders');
    }
  };

  const handleScanFolder = async (fileAccessPointId, path) => {
    setError(null);
    setMessage(null);
    
    const result = await groovyApiStore.scanFolder(serverUrl, appId, fileAccessPointId, path);
    
    if (result.code === 0) {
      const { loadedCount, skippedCount } = result.data;
      setMessage(`Folder scanned: ${loadedCount} scripts loaded, ${skippedCount} skipped`);
    } else {
      setError(result.message || 'Failed to scan folder');
    }
  };

  const getScriptCode = (scriptSource) => {
    if (typeof scriptSource === 'string') {
      return scriptSource;
    }
    if (scriptSource && typeof scriptSource === 'object') {
      if (scriptSource.storageType === 'inline') {
        return scriptSource.rawText;
      } else if (scriptSource.storageType === 'fileAccessPoint') {
        return scriptSource.cachedContent || '';
      }
    }
    return '';
  };

  if (!appId) {
    return (
      <div style={{ padding: '12px', color: '#666' }}>
        No app selected
      </div>
    );
  }

  const { inline, singleFile, folderBased } = groovyApiStore.categorizeScripts();
  const loading = groovyApiStore.isLoadingScripts || groovyApiStore.isLoadingFolders;

  return (
    <div style={{ padding: '0px 0' }}>
      {showUploadForm && (
        <CreatePanel
          appId={appId}
          serverUrl={serverUrl}
          onSuccess={handleCreateSuccess}
          onCancel={() => setShowUploadForm(false)}
        />
      )}

      {/* Global messages */}
      {error && (
        <div style={{ 
          padding: '8px', 
          marginBottom: '8px', 
          backgroundColor: '#fee', 
          border: '1px solid #fcc',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#c00'
        }}>
          {error}
        </div>
      )}
      
      {message && (
        <div style={{ 
          padding: '8px', 
          marginBottom: '8px', 
          backgroundColor: '#efe', 
          border: '1px solid #cfc',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#060'
        }}>
          {message}
        </div>
      )}

      {/* Section: Inline Scripts */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          padding: '8px 0',
          borderBottom: '2px solid #e0e0e0',
          marginBottom: '8px'
        }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
            Inline Scripts
          </span>
          <button
            onClick={() => setShowUploadForm(true)}
            style={{
              padding: '2px',
              backgroundColor: 'transparent',
              color: '#2196F3',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Create New Script"
          >
            <PlusIcon width={16} height={16} color="#2196F3" strokeWidth={2} />
          </button>
        </div>

        {loading && inline.length === 0 && (
          <div style={{ fontSize: '12px', color: '#666', padding: '12px' }}>
            Loading scripts...
          </div>
        )}

        {!loading && inline.length === 0 && (
          <div style={{ fontSize: '12px', color: '#666', padding: '12px' }}>
            No inline scripts found. Create one to get started.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {inline.map((script, index) => (
            <MongoAppGroovyApiCard
              key={script.id}
              script={script}
              index={index + 1}
              appId={appId}
              onEdit={startEdit}
              onDelete={handleDelete}
              onRefresh={null}
              isEditing={editingScriptId === script.id}
              editState={{ endpoint: editEndpoint, description: editDescription, scriptSource: editScriptSource }}
              onEditChange={handleEditChange}
              onSaveEdit={handleUpdate}
              onCancelEdit={cancelEdit}
              sourceLabel={{
                text: 'INLINE',
                bgColor: '#f3e5f5',
                color: '#7b1fa2'
              }}
            />
          ))}
        </div>
      </div>

      {/* Section: Single File Scripts */}
      {singleFile.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: 'bold', 
            color: '#333',
            padding: '8px 0',
            borderBottom: '2px solid #e0e0e0',
            marginBottom: '8px'
          }}>
            Single File Scripts
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {singleFile.map((script, index) => (
              <MongoAppGroovyApiCard
                key={script.id}
                script={script}
                index={index + 1}
                appId={appId}
                onEdit={startEdit}
                onDelete={handleDelete}
                onRefresh={handleRefreshFromFile}
                isEditing={editingScriptId === script.id}
                editState={{ endpoint: editEndpoint, description: editDescription, scriptSource: editScriptSource }}
                onEditChange={handleEditChange}
                onSaveEdit={handleUpdate}
                onCancelEdit={cancelEdit}
                sourceLabel={{
                  text: 'FILE',
                  bgColor: '#e3f2fd',
                  color: '#1976d2'
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Section: Folder Management */}
      <div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          padding: '8px 0',
          borderBottom: '2px solid #e0e0e0',
          marginBottom: '8px'
        }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
            Scripts from Folders
          </span>
          <button
            onClick={() => setShowAddFolderForm(!showAddFolderForm)}
            style={{
              padding: '2px',
              backgroundColor: 'transparent',
              color: '#4CAF50',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Add Folder"
          >
            <PlusIcon width={16} height={16} color="#4CAF50" strokeWidth={2} />
          </button>
          {groovyApiStore.folders.length > 0 && (
            <button
              onClick={handleScanFolders}
              style={{
                padding: '2px 8px',
                fontSize: '11px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              title="Scan all folders"
            >
              Scan All
            </button>
          )}
        </div>

        {showAddFolderForm && (
          <div style={{
            padding: '12px',
            marginBottom: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: '#f9f9f9'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
              Add Folder for Auto-Loading
            </div>
            
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                File Access Point:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  value={newFolderFapId}
                  placeholder="File access point ID"
                  readOnly
                  style={{
                    flex: 1,
                    padding: '6px',
                    fontSize: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: '#fff'
                  }}
                />
                <button
                  onClick={() => setShowFapSelector(!showFapSelector)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    backgroundColor: '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {newFolderFapId ? 'Change' : 'Select'}
                </button>
              </div>
              {showFapSelector && (
                <div style={{ marginTop: '8px' }}>
                  <FileAccessPointSelector
                    fileAccessPoints={fileStore.getAllFap()}
                    isLoading={fileStore.fileAccessPointsIsLoading}
                    onSelect={(fap) => {
                      setNewFolderFapId(fap.id);
                      setShowFapSelector(false);
                      setShowDirSelector(false); // Hide dir selector when FAP changes
                    }}
                    onRefresh={() => fileStore.refreshFap()}
                  />
                </div>
              )}
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Folder Path (relative path, leave empty for root):
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  value={newFolderPath}
                  onChange={(e) => setNewFolderPath(e.target.value)}
                  placeholder="e.g., scripts/apis"
                  style={{
                    flex: 1,
                    padding: '6px',
                    fontSize: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
                <button
                  onClick={() => setShowDirSelector(!showDirSelector)}
                  disabled={!newFolderFapId}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    backgroundColor: newFolderFapId ? '#2196F3' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: newFolderFapId ? 'pointer' : 'not-allowed'
                  }}
                  title={newFolderFapId ? 'Browse folders' : 'Select a file access point first'}
                >
                  Browse
                </button>
              </div>
              {showDirSelector && newFolderFapId && (
                <div style={{ 
                  marginTop: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: '#fff',
                  position: 'relative'
                }}>
                  <DirSelector
                    serverUrl={serverUrl}
                    fileAccessPointId={newFolderFapId}
                    initialPath="/"
                    onConfirm={(selectedDir) => {
                      // Extract relative path from selected directory
                      // The path from ItemSelector is relative to the FAP root
                      // Remove leading slash if present
                      let relativePath = selectedDir.path || '';
                      if (relativePath.startsWith('/')) {
                        relativePath = relativePath.substring(1);
                      }
                      setNewFolderPath(relativePath);
                      setShowDirSelector(false);
                    }}
                    onCancel={() => setShowDirSelector(false)}
                    height={400}
                    title="Select Folder"
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleAddFolder}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add Folder
              </button>
              <button
                onClick={() => {
                  setShowAddFolderForm(false);
                  setNewFolderFapId('');
                  setNewFolderPath('');
                  setShowFapSelector(false);
                  setShowDirSelector(false);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: '#999',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && groovyApiStore.folders.length === 0 && (
          <div style={{ fontSize: '12px', color: '#666', padding: '12px' }}>
            Loading folders...
          </div>
        )}

        {!loading && groovyApiStore.folders.length === 0 && !showAddFolderForm && (
          <div style={{ fontSize: '12px', color: '#666', padding: '12px' }}>
            No folders configured. Add a folder to auto-load scripts.
          </div>
        )}

        {groovyApiStore.folders.map((folder) => {
          const folderKey = `${folder.fileAccessPointId}:${folder.path || ''}`;
          // Look up scripts for this folder (might be empty)
          const folderScripts = folderBased.has(folderKey) ? folderBased.get(folderKey).scripts : [];
          
          return (
            <MongoAppGroovyApiFolder
              key={folderKey}
              folder={folder}
              scripts={folderScripts}
              appId={appId}
              onEdit={startEdit}
              onDelete={handleDelete}
              onRefresh={handleRefreshFromFile}
              onRemoveFolder={handleRemoveFolder}
              onScanFolder={() => handleScanFolder(folder.fileAccessPointId, folder.path)}
              editingScriptId={editingScriptId}
              editState={{ endpoint: editEndpoint, description: editDescription, scriptSource: editScriptSource }}
              onEditChange={handleEditChange}
              onSaveEdit={handleUpdate}
              onCancelEdit={cancelEdit}
            />
          );
        })}
      </div>

      {confirmDialog && (
        <PanelPopup
          type="confirm"
          title="Confirm"
          message={confirmDialog.message}
          confirmText="Confirm"
          cancelText="Cancel"
          danger={true}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
});

export default MongoAppGroovyApi;
