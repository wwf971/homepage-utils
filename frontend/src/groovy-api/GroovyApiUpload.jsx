import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import groovyApiStore from './groovyApiStore';

const EXAMPLE_SCRIPT = `// Example: List all MongoDB apps
def response = mongoAppService.listAllApps()

if (response.code == 0) {
    def apps = response.data
    def appNames = apps.collect { it.appName }
    
    return [
        status: 'success',
        message: "Found \${apps.size()} apps",
        apps: appNames,
        fullData: apps
    ]
} else {
    return [
        status: 'error',
        message: response.message
    ]
}`;

const GroovyApiUpload = observer(({ onUploadSuccess }) => {
  const [uploadEndpoint, setUploadEndpoint] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadSource, setUploadSource] = useState(EXAMPLE_SCRIPT);
  const [message, setMessage] = useState(null);

  const uploadScript = async () => {
    setMessage(null);
    
    const result = await groovyApiStore.uploadScript(
      null, // no ID for new scripts
      uploadEndpoint,
      uploadSource,
      uploadDescription
    );

    if (result.success) {
      setMessage({ type: 'success', text: result.message });
      setUploadEndpoint('');
      setUploadDescription('');
      setUploadSource(EXAMPLE_SCRIPT);
      
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } else {
      setMessage({ type: 'error', text: result.error });
    }
  };

  return (
    <div style={{ padding: '6px 8px' }}>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
          Endpoint Name:
        </label>
        <input
          type="text"
          value={uploadEndpoint}
          onChange={(e) => setUploadEndpoint(e.target.value)}
          placeholder="e.g., list-apps"
          style={{
            width: '100%',
            padding: '6px',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        />
        <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
          Will be available at: /groovy-api/{uploadEndpoint || 'your-endpoint'}
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
          Description (optional):
        </label>
        <input
          type="text"
          value={uploadDescription}
          onChange={(e) => setUploadDescription(e.target.value)}
          placeholder="Brief description"
          style={{
            width: '100%',
            padding: '6px',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
          Script Source:
        </label>
        <textarea
          value={uploadSource}
          onChange={(e) => setUploadSource(e.target.value)}
          style={{
            width: '100%',
            minHeight: '300px',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}
        />
        <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
          Available tools: mongoAppService, params, headers
        </div>
      </div>

      <button
        onClick={uploadScript}
        disabled={groovyApiStore.loading}
        style={{
          padding: '8px 12px',
          border: 'none',
          borderRadius: '4px',
          background: groovyApiStore.loading ? '#ccc' : '#4CAF50',
          color: '#fff',
          cursor: groovyApiStore.loading ? 'not-allowed' : 'pointer',
          fontWeight: 'bold'
        }}
      >
        {groovyApiStore.loading ? 'Uploading...' : 'Upload Script'}
      </button>

      {message && (
        <div style={{
          marginTop: '8px',
          padding: '6px 8px',
          background: message.type === 'error' ? '#fee' : '#efe',
          border: `1px solid ${message.type === 'error' ? '#fcc' : '#cfc'}`,
          borderRadius: '4px',
          color: message.type === 'error' ? '#c33' : '#363'
        }}>
          {message.text}
        </div>
      )}
    </div>
  );
});

export default GroovyApiUpload;
