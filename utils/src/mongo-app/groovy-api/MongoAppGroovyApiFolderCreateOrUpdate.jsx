import React, { useEffect, useState } from 'react';
import { FileAccessPointSelector, fileStore, DirSelector } from '@wwf971/homepage-utils-utils';

const MongoAppGroovyApiFolderCreateOrUpdate = ({
  mode = 'create',
  backendUrl,
  fileAccessPointId = '',
  path = '',
  onConfirm,
  onCancel,
}) => {
  const [selectedFapId, setSelectedFapId] = useState(fileAccessPointId);
  const [selectedPath, setSelectedPath] = useState(path);
  const [showFapSelector, setShowFapSelector] = useState(false);
  const [showDirSelector, setShowDirSelector] = useState(false);

  useEffect(() => {
    setSelectedFapId(fileAccessPointId || '');
    setSelectedPath(path || '');
  }, [fileAccessPointId, path]);

  const handleConfirm = () => {
    if (!selectedFapId) {
      return;
    }
    onConfirm?.({
      fileAccessPointId: selectedFapId,
      path: selectedPath || '',
    });
  };

  return (
    <div style={{
      padding: '12px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      backgroundColor: '#f9f9f9',
    }}>
      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
        {mode === 'update' ? 'Edit Folder for Auto-Loading' : 'Add Folder for Auto-Loading'}
      </div>

      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
          File Access Point:
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            value={selectedFapId}
            placeholder="File access point ID"
            readOnly
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: '#fff',
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
              cursor: 'pointer',
            }}
          >
            {selectedFapId ? 'Change' : 'Select'}
          </button>
        </div>
        {showFapSelector && (
          <div style={{ marginTop: '8px' }}>
            <FileAccessPointSelector
              fileAccessPoints={fileStore.getAllFap()}
              isLoading={fileStore.fileAccessPointsIsLoading}
              onSelect={(fap) => {
                setSelectedFapId(fap.id);
                setShowFapSelector(false);
                setShowDirSelector(false);
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
            value={selectedPath}
            onChange={(e) => setSelectedPath(e.target.value)}
            placeholder="e.g., scripts/apis"
            style={{
              flex: 1,
              padding: '6px',
              fontSize: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
          <button
            onClick={() => setShowDirSelector(!showDirSelector)}
            disabled={!selectedFapId}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: selectedFapId ? '#2196F3' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedFapId ? 'pointer' : 'not-allowed',
            }}
            title={selectedFapId ? 'Browse folders' : 'Select a file access point first'}
          >
            Browse
          </button>
        </div>
        {showDirSelector && selectedFapId && (
          <div style={{
            marginTop: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: '#fff',
            position: 'relative',
          }}>
            <DirSelector
              backendUrl={backendUrl}
              fileAccessPointId={selectedFapId}
              initialPath="/"
              onConfirm={(selectedDir) => {
                let relativePath = selectedDir.path || '';
                if (relativePath.startsWith('/')) {
                  relativePath = relativePath.substring(1);
                }
                setSelectedPath(relativePath);
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
          onClick={handleConfirm}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: selectedFapId ? 'pointer' : 'not-allowed',
            opacity: selectedFapId ? 1 : 0.6,
          }}
          disabled={!selectedFapId}
        >
          {mode === 'update' ? 'Update Folder' : 'Add Folder'}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: '#999',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default MongoAppGroovyApiFolderCreateOrUpdate;
