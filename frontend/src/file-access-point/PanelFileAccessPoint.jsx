import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useAtomValue } from 'jotai';
import { RefreshIcon, SpinningCircle, PanelToggle } from '@wwf971/react-comp-misc';
import { FileAccessPointSelector } from '@wwf971/homepage-utils-utils';
import FileAccessPointCard from './FileAccessPointCard';
import FileAccessPointCreate from './FileAccessPointCreate';
import './initFileStore'; // Initialize fileStore with dependencies
import { fileStore } from '@wwf971/homepage-utils-utils';

// fetchFap needs to be called from fileStore
const fetchFap = () => fileStore.fetchFap();
import { backendLocalConfigAtom } from '../remote/dataStore';
import './file.css';

const PanelFileAccessPoint = observer(() => {
  const { 
    fapIds,
    fapMetadataLoc: metadata,
    fileAccessPointsIsLoading: loading,
    fileAccessPointsError: error
  } = fileStore;
  
  const localConfig = useAtomValue(backendLocalConfigAtom);
  
  const [selectedFileAccessPointId, setSelectedFileAccessPointId] = useState(null);
  
  // Get full file access point documents from mongoDocStore, filter out system FAPs
  // getAllFap() already returns FAPs for current fapIds, so we just need to filter
  const fileAccessPoints = fileStore.getAllFap()
    .filter(fap => !fap.content?.systemRole); // Hide system file access points
  
  useEffect(() => {
    loadFileAccessPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select first non-system file access point when list loads
  useEffect(() => {
    if (!selectedFileAccessPointId && fapIds.length > 0) {
      // Find first non-system FAP
      const allFaps = fileStore.getAllFap();
      const firstNonSystemFap = allFaps.find(fap => !fap.content?.systemRole);
      if (firstNonSystemFap) {
        setSelectedFileAccessPointId(firstNonSystemFap.id);
      }
    }
  }, [fapIds, selectedFileAccessPointId]);

  const loadFileAccessPoints = async () => {
    // fetchFap now handles all state updates internally
    await fetchFap();
  };

  const handleRefresh = async () => {
    if (loading) return;
    await loadFileAccessPoints();
  };

  const handleSelectFileAccessPoint = (fap) => {
    setSelectedFileAccessPointId(fap.id);
  };

  const handleFileAccessPointDeleted = (deletedId) => {
    // Clear selection if the deleted FAP was selected
    // This will unmount the FileAccessPointCard component immediately
    if (selectedFileAccessPointId === deletedId) {
      setSelectedFileAccessPointId(null);
    }
    // Note: No need to reload - deleteFap already updates the local cache via MobX
  };

  if (loading) {
    return (
      <div className="config-section">
        <div className="loading">Loading file access points...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <PanelToggle title="Create File Access Point" defaultExpanded={false}>
        <FileAccessPointCreate 
          onSuccess={(message) => {
            loadFileAccessPoints();
          }}
        />
      </PanelToggle>
      <PanelToggle title="View File Access Points" defaultExpanded={true}>
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

        {fileAccessPoints.length === 0 ? (
        <div className="empty-message">
          No file access points configured
        </div>
      ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* File Access Point Selector */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
                Select One File Access Point
              </div>
            <FileAccessPointSelector
              fileAccessPoints={fileAccessPoints}
              selectedId={selectedFileAccessPointId}
              onSelect={handleSelectFileAccessPoint}
            />
            </div>

            {/* Selected File Access Point Details */}
            {selectedFileAccessPointId && fileAccessPoints.some(fap => fap.id === selectedFileAccessPointId) ? (
              <div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
                  Selected File Access Point
                </div>
            <FileAccessPointCard 
                  fileAccessPointId={selectedFileAccessPointId}
              database={metadata.database}
              collection={metadata.collection}
              onUpdate={loadFileAccessPoints}
                  onDeleted={handleFileAccessPointDeleted}
                />
              </div>
            ) : (
              <div style={{ 
                padding: '16px',
                textAlign: 'center',
                fontSize: '13px',
                color: '#999',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                backgroundColor: '#fafafa'
              }}>
                No file access point is selected
              </div>
            )}
        </div>
      )}
      </PanelToggle>
    </div>

  );
});

export default PanelFileAccessPoint;

