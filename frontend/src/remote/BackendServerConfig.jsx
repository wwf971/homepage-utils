import React, { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { SpinningCircle } from '@wwf971/react-comp-misc';
import { 
  backendServerUrlAtom,
  getBackendServerUrl,
  updateBackendServerUrl,
  testBackendConnection
} from './dataStore';

const BackendServerConfig = () => {
  const [backendUrl, setBackendUrl] = useAtom(backendServerUrlAtom);
  const [editUrl, setEditUrl] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    const loadUrl = async () => {
      // First get current URL (from localStorage or default)
      const currentUrl = getBackendServerUrl();
      setBackendUrl(currentUrl);
      setEditUrl(currentUrl);
      
      // Then try to load from config files
      const loadBackendUrlFromFiles = async () => {
        try {
          const response0 = await fetch('/config.0.js');
          const text0 = await response0.text();
          const match0 = text0.match(/SERVER_URL\s*=\s*['"]([^'"]+)['"]/);
          if (match0) return match0[1];
        } catch (e) {}
        
        try {
          const response = await fetch('/config.js');
          const text = await response.text();
          const match = text.match(/SERVER_URL\s*=\s*['"]([^'"]+)['"]/);
          if (match) return match[1];
        } catch (e) {}
        
        return null;
      };
      
      const fileUrl = await loadBackendUrlFromFiles();
      // Only update if no localStorage override exists and file has URL
      if (fileUrl && !localStorage.getItem('backendServerUrl')) {
        setBackendUrl(fileUrl);
        setEditUrl(fileUrl);
      }
    };
    loadUrl();
  }, [setBackendUrl]);

  const handleEdit = () => {
    setIsEditing(true);
    setEditUrl(backendUrl);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditUrl(backendUrl);
  };

  const handleSave = () => {
    updateBackendServerUrl(editUrl);
    setBackendUrl(editUrl);
    setIsEditing(false);
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    const urlToTest = isEditing ? editUrl : backendUrl;
    const result = await testBackendConnection(urlToTest);
    
    setTestResult({
      success: result.code === 0,
      message: result.message
    });
    setTesting(false);
  };

  return (
    <div className="connection-test">
      <h3>Backend Server Configuration</h3>
      
      <div className="test-config-section">
        <h4>Backend Server URL</h4>
        <div style={{ padding: '12px' }}>
          {isEditing ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
                placeholder="http://localhost:900"
              />
              <button 
                onClick={handleSave}
                style={{
                  padding: '6px 14px',
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
                onClick={handleCancel}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ 
                flex: 1, 
                fontFamily: 'monospace', 
                fontSize: '14px',
                padding: '6px 10px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px'
              }}>
                {backendUrl || 'http://localhost:900'}
              </span>
              <button 
                onClick={handleEdit}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Edit
              </button>
            </div>
          )}
        </div>
        
        <div style={{ padding: '0 12px', fontSize: '13px', color: '#666' }}>
          <p style={{ margin: '8px 0' }}>
            Configuration priority: localStorage &gt; config.0.js &gt; config.js &gt; default
          </p>
        </div>
      </div>
      
      <div className="test-action-section">
        <p>Click the button below to test the connection to the backend server.</p>
        
        <div className="test-buttons">
          <button 
            onClick={handleTest} 
            disabled={testing}
            className="test-button"
          >
            {testing ? (
              <>
                <SpinningCircle width={16} height={16} color="white" />
                <span style={{ marginLeft: '8px' }}>Testing...</span>
              </>
            ) : (
              'Test Connection'
            )}
          </button>
        </div>
        
        {testResult && (
          <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
            <strong>{testResult.success ? '✓ Success' : '✗ Failed'}</strong>
            <div className="result-message">{testResult.message}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackendServerConfig;

