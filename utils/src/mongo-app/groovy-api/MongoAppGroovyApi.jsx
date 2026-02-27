import React, { useState, useEffect, useCallback } from 'react';
import { PanelToggle, PlusIcon, PanelPopup } from '@wwf971/react-comp-misc';
import CreatePanel from './CreatePanel.jsx';

const MongoAppGroovyApi = ({ store }) => {
  const [scripts, setScripts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  
  // Upload form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  
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
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${serverUrl}/mongo-app/${appId}/api-config/list`);
      const result = await response.json();
      
      if (result.code === 0) {
        setScripts(result.data || {});
      } else {
        setError(result.message || 'Failed to fetch scripts');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [appId, serverUrl]);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

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
    
    setLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      const timezone = -new Date().getTimezoneOffset() / 60;
      const response = await fetch(`${serverUrl}/mongo-app/${appId}/api-config/update/${scriptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: editEndpoint,
          scriptSource: editScriptSource,
          description: editDescription,
          timezone
        })
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        setMessage('Script updated successfully');
        setEditingScriptId(null);
        fetchScripts();
      } else {
        setError(result.message || 'Failed to update script');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (scriptId) => {
    setConfirmDialog({
      message: 'Are you sure you want to delete this script?',
      onConfirm: async () => {
        setConfirmDialog(null);
        setLoading(true);
        setError(null);
        setMessage(null);
        
        try {
          const response = await fetch(`${serverUrl}/mongo-app/${appId}/api-config/delete/${scriptId}`, {
            method: 'DELETE'
          });
          
          const result = await response.json();
          
          if (result.code === 0) {
            setMessage('Script deleted successfully');
            fetchScripts();
          } else {
            setError(result.message || 'Failed to delete script');
          }
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
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

  const handleRefreshFromFile = async (scriptId) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      const response = await fetch(`${serverUrl}/mongo-app/${appId}/api-config/${scriptId}/refresh`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        setMessage('Script refreshed from file successfully');
        fetchScripts();
      } else {
        setError(result.message || 'Failed to refresh script');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isFileBasedScript = (scriptSource) => {
    return scriptSource && typeof scriptSource === 'object' && scriptSource.storageType === 'fileAccessPoint';
  };

  const getScriptCode = (scriptSource) => {
    if (typeof scriptSource === 'string') {
      return scriptSource; // Legacy format
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

  const scriptsArray = Object.values(scripts);

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

      <PanelToggle defaultExpanded={true}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Groovy API Scripts</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowUploadForm(true);
            }}
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

        <div>
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

          {loading && scriptsArray.length === 0 && (
            <div style={{ fontSize: '12px', color: '#666', padding: '12px' }}>
              Loading scripts...
            </div>
          )}

          {!loading && scriptsArray.length === 0 && (
            <div style={{ fontSize: '12px', color: '#666', padding: '12px' }}>
              No scripts found. Create one to get started.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {scriptsArray.map((script, index) => (
              <div
                key={script.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: '#fff'
                }}
              >
                {editingScriptId === script.id ? (
                  <div style={{ padding: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
                      Edit Script #{index + 1}
                    </div>
                    
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                        Endpoint Name:
                      </label>
                      <input
                        type="text"
                        value={editEndpoint}
                        onChange={(e) => setEditEndpoint(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '12px',
                          border: '1px solid #ddd',
                          borderRadius: '4px'
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                        Description:
                      </label>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '12px',
                          border: '1px solid #ddd',
                          borderRadius: '4px'
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                        Script Source:
                      </label>
                      <textarea
                        value={editScriptSource}
                        onChange={(e) => setEditScriptSource(e.target.value)}
                        rows={10}
                        style={{
                          width: '100%',
                          padding: '6px',
                          fontSize: '12px',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontFamily: 'monospace'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleUpdate(script.id)}
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
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
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
                ) : (
                  <>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 8px',
                      backgroundColor: '#f5f5f5',
                      borderBottom: '1px solid #ddd'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#666' }}>
                          #{index + 1}
                        </span>
                        <div>
                          <div style={{ fontSize: '12px' }}>
                            <span style={{ fontWeight: 'bold' }}>Endpoint:</span>{' '}
                            <span style={{ fontFamily: 'monospace' }}>/mongo-app/{appId}/api/{script.apiPath || script.endpoint}</span>
                            {isFileBasedScript(script.scriptSource) && (
                              <span style={{ 
                                marginLeft: '8px', 
                                padding: '2px 6px', 
                                backgroundColor: '#e3f2fd', 
                                color: '#1976d2',
                                borderRadius: '3px',
                                fontSize: '10px',
                                fontWeight: 'bold'
                              }}>
                                FILE
                              </span>
                            )}
                          </div>
                          {script.description && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                              <span style={{ fontWeight: 'bold' }}>Description:</span> {script.description}
                            </div>
                          )}
                          {isFileBasedScript(script.scriptSource) && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                              <span style={{ fontWeight: 'bold' }}>File:</span> {script.scriptSource.fileAccessPointId}:{script.scriptSource.path}
                              {script.scriptSource.lastSyncAt && (
                                <span style={{ marginLeft: '8px', color: '#999' }}>
                                  (synced: {new Date(script.scriptSource.lastSyncAt).toLocaleString()})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {isFileBasedScript(script.scriptSource) && (
                          <button
                            onClick={() => handleRefreshFromFile(script.id)}
                            style={{
                              padding: '4px 12px',
                              fontSize: '11px',
                              backgroundColor: '#ff9800',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Refresh
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(script)}
                          style={{
                            padding: '4px 12px',
                            fontSize: '11px',
                            backgroundColor: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(script.id)}
                          style={{
                            padding: '4px 12px',
                            fontSize: '11px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div style={{ padding: '8px 12px', fontSize: '11px', color: '#999' }}>
                      <div>ID: {script.id}</div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </PanelToggle>

      {confirmDialog && (
        <PanelPopup
          type="confirm"
          title="Confirm Delete"
          message={confirmDialog.message}
          confirmText="Delete"
          cancelText="Cancel"
          danger={true}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};

export default MongoAppGroovyApi;
