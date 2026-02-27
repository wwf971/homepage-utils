import React, { useState } from 'react';
import { FileAccessPointSelector, Tag } from '@wwf971/homepage-utils-utils';
import { FileSelector } from '../../file-access-point/index.js';

const CreatePanelFileAccessPoint = ({ 
  fileAccessPointId,
  fileAccessPointName,
  onFileAccessPointChange,
  filePath,
  onFilePathChange,
  serverUrl
}) => {
  const [showFapSelector, setShowFapSelector] = useState(false);
  const [showFileSelector, setShowFileSelector] = useState(false);

  return (
    <>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '500' }}>
          File Access Point:
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!fileAccessPointId ? (
            <div style={{ 
              padding: '6px 8px',
              fontSize: '12px',
              color: '#999',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              backgroundColor: '#fafafa'
            }}>
              No file access point selected
            </div>
          ) : (
            <Tag 
              secondary={fileAccessPointId}
              isClosable
              onClose={() => {
                onFileAccessPointChange('', '');
              }}
            >
              {fileAccessPointName || 'Unnamed'}
            </Tag>
          )}
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
            {fileAccessPointId ? 'Change' : 'Select'}
          </button>
        </div>
      </div>

      {showFapSelector && (
        <div style={{ marginBottom: '12px' }}>
          <FileAccessPointSelector
            serverUrl={serverUrl}
            title="Select One File Access Point"
            showActions={true}
            onConfirm={(fap) => {
              const name = fap.content?.name || fap.name || 'Unnamed';
              onFileAccessPointChange(fap.id, name);
              setShowFapSelector(false);
            }}
            onCancel={() => setShowFapSelector(false)}
          />
        </div>
      )}

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: '500' }}>
          File Path:
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!filePath ? (
            <div style={{ 
              padding: '6px 8px',
              fontSize: '12px',
              color: '#999',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              backgroundColor: '#fafafa'
            }}>
              No file selected
            </div>
          ) : (
            <Tag 
              isClosable
              onClose={() => {
                onFilePathChange('');
              }}
            >
              {filePath}
            </Tag>
          )}
          <button
            onClick={() => setShowFileSelector(!showFileSelector)}
            disabled={!fileAccessPointId}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: fileAccessPointId ? '#2196F3' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: fileAccessPointId ? 'pointer' : 'not-allowed'
            }}
            title={!fileAccessPointId ? 'Please select a file access point first' : ''}
          >
            {filePath ? 'Change' : 'Select'}
          </button>
        </div>
      </div>

      {showFileSelector && fileAccessPointId && (
        <div style={{ marginBottom: '12px' }}>
          <FileSelector
            serverUrl={serverUrl}
            fileAccessPointId={fileAccessPointId}
            initialPath="/"
            height={350}
            onConfirm={(selectedFile) => {
              onFilePathChange(selectedFile.path);
              setShowFileSelector(false);
            }}
            onCancel={() => setShowFileSelector(false)}
          />
        </div>
      )}
    </>
  );
};

export default CreatePanelFileAccessPoint;
