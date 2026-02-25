import React, { useState } from 'react';
import EndPointInput from './EndPointInput.jsx';

const MongoAppGroovyApiCreate = ({ 
  appId, 
  serverUrl, 
  onSuccess, 
  onCancel 
}) => {
  const [uploadEndpoint, setUploadEndpoint] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadScriptSource, setUploadScriptSource] = useState('');
  const [uploadStorageType, setUploadStorageType] = useState('inline');
  const [uploadFileAccessPointId, setUploadFileAccessPointId] = useState('');
  const [uploadFileSpecification, setUploadFileSpecification] = useState('single');
  const [uploadFilePath, setUploadFilePath] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    if (!uploadEndpoint.trim()) {
      setError('Endpoint is required');
      return;
    }
    
    if (uploadStorageType === 'inline' && !uploadScriptSource.trim()) {
      setError('Script source is required for inline scripts');
      return;
    }
    
    if (uploadStorageType === 'fileAccessPoint') {
      if (!uploadFileAccessPointId.trim() || !uploadFilePath.trim()) {
        setError('File access point ID and path are required for file-based scripts');
        return;
      }
    }
    
    setUploading(true);
    setError(null);
    
    try {
      const timezone = -new Date().getTimezoneOffset() / 60;
      
      let url, body;
      if (uploadStorageType === 'inline') {
        url = `${serverUrl}/mongo-app/${appId}/api-config/create`;
        body = {
          endpoint: uploadEndpoint,
          scriptSource: uploadScriptSource,
          description: uploadDescription,
          timezone
        };
      } else {
        url = `${serverUrl}/mongo-app/${appId}/api-config/create-from-file`;
        body = {
          endpoint: uploadEndpoint,
          fileAccessPointId: uploadFileAccessPointId,
          specification: uploadFileSpecification,
          path: uploadFilePath,
          description: uploadDescription,
          timezone
        };
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        setUploadEndpoint('');
        setUploadDescription('');
        setUploadScriptSource('');
        setUploadFileAccessPointId('');
        setUploadFilePath('');
        setUploadStorageType('inline');
        onSuccess?.('Script created successfully');
      } else {
        setError(result.message || 'Failed to create script');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '4px',
        maxWidth: '600px',
        width: '90%',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        height: '70vh'
      }}>
        <div style={{ padding: '16px 16px 12px 16px', flexShrink: 0 }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
            Create New Groovy API Script
          </div>

          {error && (
            <div style={{ 
              padding: '8px', 
              marginBottom: '0', 
              backgroundColor: '#fee', 
              border: '1px solid #fcc',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#c00'
            }}>
              {error}
            </div>
          )}
        </div>

        <div style={{
          padding: '0 16px',
          flexGrow: 1,
          overflowY: 'auto',
          minHeight: 0
        }}>
          <EndPointInput
            value={uploadEndpoint}
            onChange={(e) => setUploadEndpoint(e.target.value)}
            appId={appId}
            serverUrl={serverUrl}
          />

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '500' }}>
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

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '500' }}>
              Storage Type:
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="radio"
                  value="inline"
                  checked={uploadStorageType === 'inline'}
                  onChange={(e) => setUploadStorageType(e.target.value)}
                />
                Inline
              </label>
              <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="radio"
                  value="fileAccessPoint"
                  checked={uploadStorageType === 'fileAccessPoint'}
                  onChange={(e) => setUploadStorageType(e.target.value)}
                />
                From FileAccessPoint
              </label>
            </div>
          </div>

          {uploadStorageType === 'inline' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '500' }}>
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
          )}

          {uploadStorageType === 'fileAccessPoint' && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '500' }}>
                  File Access Point ID:
                </label>
                <input
                  type="text"
                  value={uploadFileAccessPointId}
                  onChange={(e) => setUploadFileAccessPointId(e.target.value)}
                  placeholder="fap123"
                  style={{
                    width: '100%',
                    padding: '6px',
                    fontSize: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '500' }}>
                  Specification:
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="radio"
                      value="single"
                      checked={uploadFileSpecification === 'single'}
                      onChange={(e) => setUploadFileSpecification(e.target.value)}
                    />
                    Single File
                  </label>
                  <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="radio"
                      value="folder"
                      checked={uploadFileSpecification === 'folder'}
                      onChange={(e) => setUploadFileSpecification(e.target.value)}
                    />
                    Folder
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '500' }}>
                  File Path:
                </label>
                <input
                  type="text"
                  value={uploadFilePath}
                  onChange={(e) => setUploadFilePath(e.target.value)}
                  placeholder="/api/my-script.groovy"
                  style={{
                    width: '100%',
                    padding: '6px',
                    fontSize: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </>
          )}
        </div>

        <div style={{ 
          padding: '12px 16px 16px 16px',
          borderTop: '1px solid #eee',
          flexShrink: 0,
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onCancel}
            disabled={uploading}
            style={{
              padding: '6px 16px',
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
          <button
            onClick={handleUpload}
            disabled={uploading}
            style={{
              padding: '6px 16px',
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
        </div>
      </div>
    </div>
  );
};

export default MongoAppGroovyApiCreate;
