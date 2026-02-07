import React, { useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { useAtomValue } from 'jotai';
import { RefreshIcon, SpinningCircle } from '@wwf971/react-comp-misc';
import FileAccessPointCard from './FileAccessPointCard';
import fileStore, { fetchFileAccessPoints } from './fileStore';
import { mongoDocsAtom, extractDocId } from '../remote/dataStore';
import './file.css';

const FilePanel = observer(() => {
  const { 
    fileAccessPoints, 
    fileAccessPointsMetadata: metadata,
    fileAccessPointsLoading: loading,
    fileAccessPointsError: error
  } = fileStore;
  
  // Subscribe to mongoDocsAtom to get live updates from editing operations
  const mongoDocs = useAtomValue(mongoDocsAtom);

  useEffect(() => {
    loadFileAccessPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFileAccessPoints = async () => {
    fileStore.setFileAccessPointsLoading(true);
    const result = await fetchFileAccessPoints();
    
    if (result.code === 0) {
      fileStore.setFileAccessPoints(result.data);
      if (result.metadata) {
        fileStore.setFileAccessPointsMetadata(result.metadata);
      }
      fileStore.setFileAccessPointsError(null);
    } else {
      fileStore.setFileAccessPointsError(result.message);
    }
    fileStore.setFileAccessPointsLoading(false);
  };

  const handleRefresh = async () => {
    if (loading) return;
    await loadFileAccessPoints();
  };

  // Merge live updates from mongoDocsAtom into fileAccessPoints
  // This ensures immediate visual updates when editing fields
  const displayedAccessPoints = useMemo(() => {
    if (!fileAccessPoints || fileAccessPoints.length === 0) {
      return fileAccessPoints;
    }
    
    return fileAccessPoints.map(ap => {
      const docId = extractDocId(ap);
      if (!docId) return ap;
      
      // Find the updated version in mongoDocs
      const updatedDoc = mongoDocs.find(d => extractDocId(d) === docId);
      return updatedDoc || ap;
    });
  }, [fileAccessPoints, mongoDocs]);

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

      {displayedAccessPoints.length === 0 ? (
        <div className="empty-message">
          No file access points configured
        </div>
      ) : (
        <div className="file-access-points-list">
          {displayedAccessPoints.map((fileAccessPoint) => (
            <FileAccessPointCard 
              key={fileAccessPoint.id} 
              fileAccessPoint={fileAccessPoint}
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

