import React, { useState, useEffect, useRef } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { SpinningCircle } from '@wwf971/react-comp-misc';
import { 
  backendServerUrlAtom,
  getBackendServerUrl,
  updateBackendServerUrl,
  testBackendConnection
} from './dataStore';
import { clearFileCache, fileCacheAtom } from '../file/fileStore';

const BackendServerConfig = () => {
  const [backendUrl, setBackendUrl] = useAtom(backendServerUrlAtom);
  const [editUrl, setEditUrl] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const setFileCache = useSetAtom(fileCacheAtom);
  const editContainerRef = useRef(null);

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

  // Handle click outside to cancel editing
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (event) => {
      if (editContainerRef.current && !editContainerRef.current.contains(event.target)) {
        handleCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, backendUrl]);

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
    
    // Clear file cache
    clearFileCache(setFileCache);
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
        <div>
          {isEditing ? (
            <div ref={editContainerRef} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="text"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                style={{
                  flex: 1,
                  maxWidth: '600px',
                  padding: '4px 8px',
                  fontSize: '13px',
                  border: '1px solid #ccc',
                  borderRadius: '3px'
                }}
                placeholder="http://localhost:900"
                autoFocus
              />
              <button 
                onClick={handleSave}
                style={{
                  padding: '4px 12px',
                  fontSize: '13px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                Save
              </button>
              <button 
                onClick={handleCancel}
                style={{
                  padding: '4px 12px',
                  fontSize: '13px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ 
                flex: 1,
                maxWidth: '600px',
                fontFamily: 'monospace', 
                fontSize: '13px',
                padding: '4px 8px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '3px'
              }}>
                {backendUrl || 'http://localhost:900'}
              </span>
              <button 
                onClick={handleEdit}
                style={{
                  padding: '4px 12px',
                  fontSize: '13px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                Edit
              </button>
            </div>
          )}
        </div>
        
        <div style={{ fontSize: '12px', color: '#6c757d' }}>
          <p style={{ margin: '6px 0' }}>
            Configuration priority: localStorage &gt; config.0.js &gt; config.js &gt; default
          </p>
        </div>
      </div>
      
      <div className="test-action-section">
        <p style={{ fontSize: '13px', color: '#495057', margin: '0 0 12px 0' }}>
          Click the button below to test the connection to the backend server.
        </p>
        
        <div className="test-buttons">
          <button 
            onClick={handleTest} 
            disabled={testing}
            className="test-button"
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              backgroundColor: testing ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: testing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {testing ? (
              <>
                <SpinningCircle width={14} height={14} color="white" />
                <span>Testing...</span>
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

