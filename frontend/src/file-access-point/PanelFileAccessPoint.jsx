import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useAtomValue } from 'jotai';
import { RefreshIcon, SpinningCircle, PanelToggle } from '@wwf971/react-comp-misc';
import { FileAccessPointSelector } from '@wwf971/homepage-utils-utils';
import FileAccessPointCard from './FileAccessPointCard';
import FileAccessPointCreate from './FileAccessPointCreate';
import fileStore, { fetchFap } from './fileStore';
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
  const fileAccessPoints = fapIds
    .map(id => fileStore.getAllFap().find(fap => fap.id === id))
    .filter(Boolean)
    .filter(fap => !fap.content?.systemRole); // Hide system file access points
  
  useEffect(() => {
    loadFileAccessPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select first file access point when list loads
  useEffect(() => {
    if (fapIds.length > 0 && !selectedFileAccessPointId) {
      setSelectedFileAccessPointId(fapIds[0]);
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

        {fapIds.length === 0 ? (
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
            {selectedFileAccessPointId && fileAccessPoints.length > 0 ? (
              <div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
                  Selected File Access Point
                </div>
                <FileAccessPointCard 
                  fileAccessPointId={selectedFileAccessPointId}
                  database={metadata.database}
                  collection={metadata.collection}
                  onUpdate={loadFileAccessPoints}
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

