import React, { useState } from 'react';
import CreatePanelEndPointInput from './CreatePanelEndPoint.jsx';
import CreatePanelFileAccessPoint from './CreatePanelFileAccessPoint.jsx';

const CreatePanel = ({ 
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
  const [uploadFileAccessPointName, setUploadFileAccessPointName] = useState('');
  const [uploadFileSpecification, setUploadFileSpecification] = useState('single');
  const [uploadFilePath, setUploadFilePath] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('error'); // 'error', 'warning', 'success'

  const handleUpload = async () => {
    if (!uploadEndpoint.trim()) {
      setMessage('Endpoint is required');
      setMessageType('error');
      return;
    }
    
    if (uploadStorageType === 'inline' && !uploadScriptSource.trim()) {
      setMessage('Script source is required for inline scripts');
      setMessageType('error');
      return;
    }
    
    if (uploadStorageType === 'fileAccessPoint') {
      if (!uploadFileAccessPointId.trim() || !uploadFilePath.trim()) {
        setMessage('File access point ID and path are required for file-based scripts');
        setMessageType('error');
        return;
      }
    }
    
    setUploading(true);
    setMessage(null);
    
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
        // Check if message contains "compilation errors" to show as warning
        const hasWarning = result.message && result.message.includes('compilation errors');
        
        if (hasWarning) {
          setMessage(result.message);
          setMessageType('warning');
          // Don't close the panel, let user see the warning
        } else {
          setUploadEndpoint('');
          setUploadDescription('');
          setUploadScriptSource('');
          setUploadFileAccessPointId('');
          setUploadFileAccessPointName('');
          setUploadFilePath('');
          setUploadStorageType('inline');
          setMessage(null);
          onSuccess?.(result.message || 'Script created successfully');
        }
      } else {
        setMessage(result.message || 'Failed to create script');
        setMessageType('error');
      }
    } catch (err) {
      setMessage(err.message);
      setMessageType('error');
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
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
            Create New Groovy API Script
          </div>
        </div>

        <div style={{
          padding: '0 16px',
          flexGrow: 1,
          overflowY: 'auto',
          minHeight: 0
        }}>
          <CreatePanelEndPointInput
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
            <CreatePanelFileAccessPoint
              fileAccessPointId={uploadFileAccessPointId}
              fileAccessPointName={uploadFileAccessPointName}
              onFileAccessPointChange={(id, name) => {
                setUploadFileAccessPointId(id);
                setUploadFileAccessPointName(name);
              }}
              specification={uploadFileSpecification}
              onSpecificationChange={setUploadFileSpecification}
              filePath={uploadFilePath}
              onFilePathChange={setUploadFilePath}
              serverUrl={serverUrl}
            />
          )}
        </div>

        <div style={{ 
          padding: '12px 16px 16px 16px',
          borderTop: '1px solid #eee',
          flexShrink: 0
        }}>
          <div style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            marginBottom: message ? '12px' : '0'
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

          {message && (
            <div style={{ 
              padding: '8px', 
              backgroundColor: messageType === 'error' ? '#fee' : messageType === 'warning' ? '#fffbf0' : '#f0f9ff', 
              border: messageType === 'error' ? '1px solid #fcc' : messageType === 'warning' ? '1px solid #ffd966' : '1px solid #b3d9ff',
              borderRadius: '4px',
              fontSize: '12px',
              color: messageType === 'error' ? '#c00' : messageType === 'warning' ? '#996600' : '#004080'
            }}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreatePanel;
