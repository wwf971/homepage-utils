import React, { useState, useEffect, useCallback } from 'react';

const MongoAppGroovyApi = ({ store }) => {
  const [scripts, setScripts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  
  // Upload form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadEndpoint, setUploadEndpoint] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadScriptSource, setUploadScriptSource] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // Edit state
  const [editingScriptId, setEditingScriptId] = useState(null);
  const [editEndpoint, setEditEndpoint] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editScriptSource, setEditScriptSource] = useState('');

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

  const handleUpload = async () => {
    if (!uploadEndpoint.trim() || !uploadScriptSource.trim()) {
      setError('Endpoint and script source are required');
      return;
    }
    
    setUploading(true);
    setError(null);
    setMessage(null);
    
    try {
      const timezone = -new Date().getTimezoneOffset() / 60;
      const response = await fetch(`${serverUrl}/mongo-app/${appId}/api-config/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: uploadEndpoint,
          scriptSource: uploadScriptSource,
          description: uploadDescription,
          timezone
        })
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        setMessage('Script created successfully');
        setUploadEndpoint('');
        setUploadDescription('');
        setUploadScriptSource('');
        setShowUploadForm(false);
        fetchScripts();
      } else {
        setError(result.message || 'Failed to create script');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
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

  const handleDelete = async (scriptId) => {
    if (!confirm('Are you sure you want to delete this script?')) return;
    
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
  };

  const startEdit = (script) => {
    setEditingScriptId(script.id);
    setEditEndpoint(script.apiPath || script.endpoint);
    setEditDescription(script.description || '');
    setEditScriptSource(script.scriptSource);
    setError(null);
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingScriptId(null);
    setEditEndpoint('');
    setEditDescription('');
    setEditScriptSource('');
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
    <div style={{ padding: '8px 0' }}>
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

          {!showUploadForm && (
            <button
              onClick={() => setShowUploadForm(true)}
              style={{
                padding: '6px 12px',
                marginBottom: '12px',
                fontSize: '12px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Create New Script
            </button>
          )}

          {showUploadForm && (
            <div style={{ 
              marginBottom: '12px', 
              padding: '12px', 
              border: '1px solid #ddd', 
              borderRadius: '4px',
              backgroundColor: '#f9f9f9'
            }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
                Create New Script
              </div>
              
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                  Endpoint Name:
                </label>
                <input
                  type="text"
                  value={uploadEndpoint}
                  onChange={(e) => setUploadEndpoint(e.target.value)}
                  placeholder="my-endpoint"
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
                  Description (optional):
                </label>
                <input
                  type="text"
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Description of this script"
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
                  value={uploadScriptSource}
                  onChange={(e) => setUploadScriptSource(e.target.value)}
                  placeholder="return [code: 0, data: 'Hello World', message: null]"
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
                  onClick={handleUpload}
                  disabled={uploading}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    opacity: uploading ? 0.6 : 1
                  }}
                >
                  {uploading ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => {
                    setShowUploadForm(false);
                    setUploadEndpoint('');
                    setUploadDescription('');
                    setUploadScriptSource('');
                  }}
                  disabled={uploading}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    backgroundColor: '#999',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: uploading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
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
                          </div>
                          {script.description && (
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                              <span style={{ fontWeight: 'bold' }}>Description:</span> {script.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
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
  );
};

export default MongoAppGroovyApi;
