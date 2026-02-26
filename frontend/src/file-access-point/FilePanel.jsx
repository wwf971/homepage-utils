import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { RefreshIcon, SpinningCircle } from '@wwf971/react-comp-misc';
import FileAccessPointCard from './FileAccessPointCard';
import fileStore, { fetchFileAccessPoints } from './fileStore';
import './file.css';

const FilePanel = observer(() => {
  const { 
    fileAccessPointIds,
    fileAccessPointsMetadata: metadata,
    fileAccessPointsIsLoading: loading,
    fileAccessPointsError: error
  } = fileStore;
  
  useEffect(() => {
    loadFileAccessPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFileAccessPoints = async () => {
    // fetchFileAccessPoints now handles all state updates internally
    await fetchFileAccessPoints();
  };

  const handleRefresh = async () => {
    if (loading) return;
    await loadFileAccessPoints();
  };

  if (loading) {
    return (
      <div className="config-section">
        <div className="loading">Loading file access points...</div>
      </div>
    );
  }

  return (
    <div className="main-panel">
      <div className="file-panel-header">
        <div className="panel-title">File Access Points</div>
        <button
          className="refresh-button"
          onClick={handleRefresh}
          disabled={loading}
          title="Retry / Refresh file access points"
        >
          {loading ? (
            <SpinningCircle width={16} height={16} color="#666" />
          ) : (
            <RefreshIcon width={16} height={16} />
          )}
        </button>
      </div>
      
      {error && (
        <div className="error-message">{error}</div>
      )}

      {fileAccessPointIds.length === 0 ? (
        <div className="empty-message">
          No file access points configured
        </div>
      ) : (
        <div className="file-access-points-list">
          {fileAccessPointIds.map((id) => (
            <FileAccessPointCard 
              key={id} 
              fileAccessPointId={id}
              database={metadata.database}
              collection={metadata.collection}
              onUpdate={loadFileAccessPoints}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default FilePanel;

