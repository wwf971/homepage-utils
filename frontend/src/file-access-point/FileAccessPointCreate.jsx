import React, { useState, useEffect } from 'react';
import { DirSelector } from '@wwf971/homepage-utils-utils';
import { getBackendServerUrl } from '../remote/dataStore';
import './file.css';

const fileAccessPointTypeOptions = [
  {
    value: 'local/internal',
    label: 'local/internal',
    description: 'Internal storage - files stored directly in the specified directory'
  },
  {
    value: 'local/external',
    label: 'local/external',
    description: 'External storage - files organized in subdirectories within the specified path'
  },
  {
    value: 'local/external/time',
    label: 'local/external/time',
    description: 'Time-based external storage - files organized by timestamp in subdirectories'
  }
];

const FileAccessPointCreate = ({ onSuccess }) => {
  
  const [name, setName] = useState('');
  const [type, setType] = useState('local/internal');
  const [baseDir, setBaseDir] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [showDirSelector, setShowDirSelector] = useState(false);
  const [systemRootFapId, setSystemRootFapId] = useState(null);
  
  // Fetch system root file access point on mount
  useEffect(() => {
    const fetchSystemRoot = async () => {
      const serverUrl = getBackendServerUrl();
      
      if (!serverUrl || serverUrl.trim() === '') {
        console.log('FileAccessPointCreate: serverUrl is empty, skipping fetch');
        return;
      }
      
      console.log('FileAccessPointCreate: Fetching system root FAP from:', serverUrl);
      
      try {
        const response = await fetch(`${serverUrl}/file_access_point/special/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'root-browser' })
        });
        
        const result = await response.json();
        console.log('FileAccessPointCreate: System root FAP response:', result);
        
        if (result.code === 0 && result.data) {
          setSystemRootFapId(result.data.id);
          console.log('FileAccessPointCreate: System root FAP ID set to:', result.data.id);
        } else {
          console.error('FileAccessPointCreate: Failed to get system root FAP:', result.message);
          setError('Failed to load system root: ' + (result.message || 'Unknown error'));
        }
      } catch (err) {
        console.error('FileAccessPointCreate: Error fetching system root FAP:', err);
        setError('Failed to connect to backend: ' + err.message);
      }
    };
    
    fetchSystemRoot();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!baseDir.trim()) {
      setError('Base directory is required');
      return;
    }
    
    setCreating(true);
    setError(null);
    
    const serverUrl = getBackendServerUrl();
    
    try {
      const response = await fetch(`${serverUrl}/file_access_point/create/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          baseDir: baseDir.trim()
        })
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        // Success - reset form
        setName('');
        setBaseDir('');
        setType('local/internal');
        setError(null);
        
        if (onSuccess) {
          onSuccess('File access point created successfully');
        }
      } else {
        setError(result.message || 'Failed to create file access point');
      }
    } catch (err) {
      setError(err.message || 'Network error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {error && (
        <div style={{
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#c00'
        }}>
          {error}
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '500' }}>
          Name:
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Files"
          style={{
            width: '100%',
            padding: '6px',
            fontSize: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '500' }}>
          Type:
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{
            width: '100%',
            padding: '6px',
            fontSize: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        >
          {fileAccessPointTypeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
          {fileAccessPointTypeOptions.find(opt => opt.value === type)?.description}
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '500' }}>
          Base Directory:
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={baseDir}
            onChange={(e) => setBaseDir(e.target.value)}
            placeholder="/path/to/directory"
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
            disabled={!systemRootFapId}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: systemRootFapId ? '#2196F3' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: systemRootFapId ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap'
            }}
            title={!systemRootFapId ? 'Loading system root...' : 'Browse server filesystem'}
          >
            Browse
          </button>
        </div>
      </div>

      {showDirSelector && systemRootFapId && (
        <div>
          <DirSelector
            serverUrl={getBackendServerUrl()}
            fileAccessPointId={systemRootFapId}
            initialPath="/"
            height={300}
            onConfirm={(selectedDir) => {
              setBaseDir(selectedDir.path);
              setShowDirSelector(false);
            }}
            onCancel={() => setShowDirSelector(false)}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
        <button
          onClick={handleCreate}
          disabled={creating || !name.trim() || !baseDir.trim()}
          style={{
            padding: '8px 16px',
            fontSize: '12px',
            backgroundColor: creating || !name.trim() || !baseDir.trim() ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: creating || !name.trim() || !baseDir.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          {creating ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  );
};

export default FileAccessPointCreate;
