import React, { useState, useEffect, useRef } from 'react';
import { useStore } from 'jotai';
import { SpinningCircle, RefreshIcon, KeyValues, Menu} from '@wwf971/react-comp-misc';
import { fetchIndexStats, fetchCollectionStats, rebuildIndexForMongoCollection } from './mongoIndexStore';
import { useTaskProgress } from '../hooks/useTaskProgress';
import './mongo-index.css';

/**
 * MongoIndexDashboard - Shows stats and provides rebuild functionality
 * This is a child component of MongoIndexCard
 */
const MongoIndexDashboard = ({ index, onRebuildingChange }) => {
  const store = useStore();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [isRebuildingCollection, setIsRebuildingCollection] = useState(null);
  const [collectionRebuildResult, setCollectionRebuildResult] = useState(null);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const handledTaskRef = useRef(null);
  const [refreshingCollection, setRefreshingCollection] = useState(null);
  
  // Subscribe to task progress
  const { progress, isComplete, error: taskError } = useTaskProgress(currentTaskId);
  
  // Debug logging
  useEffect(() => {
    if (progress) {
      console.log('[MongoIndexDashboard] Progress update:', progress);
      console.log('[MongoIndexDashboard] isRebuildingCollection:', isRebuildingCollection);
      console.log('[MongoIndexDashboard] isComplete:', isComplete);
    }
  }, [progress, isRebuildingCollection, isComplete]);

  const fetchStatsData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    const result = await fetchIndexStats(index.name, forceRefresh, store.get, store.set);
    
    if (result.code === 0) {
      setStats(result.data);
    } else {
      setError(result.message || 'Failed to fetch stats');
    }
    
    setLoading(false);
  };

  const handleRebuild = async (maxDocs = null) => {
    setRebuilding(true);
    if (onRebuildingChange) {
      onRebuildingChange(true);
    }
    setRebuildResult(null);
    setError(null);

    try {
      const { getBackendServerUrl } = await import('../remote/dataStore');
      const backendUrl = getBackendServerUrl();
      const url = maxDocs 
        ? `${backendUrl}/mongo-index/${encodeURIComponent(index.name)}/rebuild?maxDocs=${maxDocs}`
        : `${backendUrl}/mongo-index/${encodeURIComponent(index.name)}/rebuild`;
      
      const response = await fetch(url, {
        method: 'POST'
      });
      const result = await response.json();

      if (result.code === 0) {
        setRebuildResult(result.data);
        setTimeout(() => fetchStatsData(true), 500);
      } else {
        setError(result.message || 'Failed to rebuild index');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setRebuilding(false);
      if (onRebuildingChange) {
        onRebuildingChange(false);
      }
    }
  };

  useEffect(() => {
    fetchStatsData();
  }, [index.name]);

  const handleContextMenu = (e, collection) => {
    e.preventDefault();
    
    // Close any existing menu first
    setContextMenu(null);
    
    // Use requestAnimationFrame to ensure React completes unmount before remounting
    requestAnimationFrame(() => {
      setContextMenu({
        position: { x: e.clientX, y: e.clientY },
        collection
      });
    });
  };

  const handleMenuClose = () => {
    setContextMenu(null);
  };

  const handleMenuItemClick = async (item) => {
    if (item.name === 'Rebuild') {
      const { database, collection } = contextMenu.collection;
      const collKey = `${database}/${collection}`;
      setIsRebuildingCollection(collKey);
      setCollectionRebuildResult(null);
      
      // Start async rebuild task
      const result = await rebuildIndexForMongoCollection(index.name, database, collection, null);
      
      if (result.code === 0 && result.data.taskId) {
        // Set task ID to start subscribing to progress
        setCurrentTaskId(result.data.taskId);
      } else {
        setIsRebuildingCollection(null);
        setError(result.message || 'Failed to start rebuild task');
      }
    }
    handleMenuClose();
  };
  
  const handleRefreshCollection = async (e, database, collection) => {
    e.stopPropagation(); // Prevent context menu from opening
    const collKey = `${database}/${collection}`;
    setRefreshingCollection(collKey);
    
    try {
      // Fetch stats for only this collection
      const result = await fetchCollectionStats(index.name, database, collection);
      
      if (result.code === 0) {
        // Update only the specific collection in stats
        setStats(prevStats => {
          if (!prevStats) return prevStats;
          
          const updatedCollections = prevStats.collections.map(coll => {
            if (coll.database === database && coll.collection === collection) {
              return {
                ...coll,
                docCount: result.data.docCount,
                indexedDocCount: result.data.indexedDocCount
              };
            }
            return coll;
          });
          
          return {
            ...prevStats,
            collections: updatedCollections
          };
        });
      } else {
        setError(result.message || 'Failed to refresh collection stats');
      }
    } catch (err) {
      setError('Failed to refresh collection stats: ' + err.message);
    } finally {
      setRefreshingCollection(null);
    }
  };
  
  // Handle task completion
  useEffect(() => {
    if (isComplete && progress && isRebuildingCollection && currentTaskId) {
      // Prevent handling the same task completion multiple times
      if (handledTaskRef.current === currentTaskId) {
        return;
      }
      
      console.log('[MongoIndexDashboard] Task completed, cleaning up');
      handledTaskRef.current = currentTaskId;
      const collKey = isRebuildingCollection;
      
      if (progress.status === 'completed') {
        // Show rebuild result
        setCollectionRebuildResult({
          collKey,
          totalDocs: progress.totalDocs,
          indexedDocs: progress.processedDocs,
          errors: progress.errors || []
        });
        // Refresh stats to show updated counts
        fetchStatsData(true);
      } else if (progress.status === 'failed') {
        setError(taskError || 'Rebuild task failed');
      }
      
      // Clean up after handling completion
      setIsRebuildingCollection(null);
      setCurrentTaskId(null);
    }
  }, [isComplete, progress, isRebuildingCollection, currentTaskId, taskError]);

  return (
    <div className="mongo-index-dashboard">
      <div className="mongo-index-dashboard-header">
        <h5 className="mongo-index-dashboard-title">Index Statistics</h5>
        <button
          onClick={() => fetchStatsData(true)}
          disabled={loading || rebuilding}
          className="mongo-index-dashboard-button"
          title="Refresh stats"
        >
          {loading ? <SpinningCircle width={12} height={12} /> : <RefreshIcon width={14} height={14} />}
        </button>
        <button
          onClick={() => handleRebuild(null)}
          disabled={loading || rebuilding}
          className="mongo-index-dashboard-button mongo-index-dashboard-button-rebuild"
        >
          {rebuilding ? <SpinningCircle width={12} height={12} color="white" /> : 'Rebuild Index'}
        </button>
        <button
          onClick={() => handleRebuild(10)}
          disabled={loading || rebuilding}
          className="mongo-index-dashboard-button mongo-index-dashboard-button-rebuild-test"
        >
          Rebuild (10)
        </button>
      </div>

      {error && (
        <div className="mongo-index-dashboard-error">
          {error}
        </div>
      )}

      {rebuildResult && (
        <div className="mongo-index-dashboard-rebuild-result">
          <div><strong>Full Index Rebuild completed:</strong></div>
          <div>Total docs: {rebuildResult.totalDocs}</div>
          <div>Indexed docs: {rebuildResult.indexedDocs}</div>
          {rebuildResult.errors && rebuildResult.errors.length > 0 && (
            <div className="mongo-index-dashboard-rebuild-errors">
              <div><strong>Errors: {rebuildResult.errors.length}</strong></div>
              <div className="mongo-index-dashboard-rebuild-errors-list">
                {rebuildResult.errors.map((err, idx) => (
                  <div key={idx} className="mongo-index-dashboard-rebuild-error-item">
                    {err}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loading && !stats && (
        <div className="mongo-index-dashboard-loading">
          <SpinningCircle width={20} height={20} />
          <span>Loading stats...</span>
        </div>
      )}

      {stats && (
        <div className="mongo-index-dashboard-stats">
          <KeyValues
            data={[
              { key: 'ES Index Name', value: stats.esIndexName },
              { key: 'MongoDB Doc Num', value: stats.totalMongoDocsCount },
              { key: 'ES Index Doc Num', value: stats.esDocsCount }
            ]}
            isEditable={false}
            keyColWidth="min"
          />

          {stats.collections && stats.collections.length > 0 && (
            <div className="mongo-index-dashboard-collections">
              <div className="mongo-index-dashboard-collections-title">Collections</div>
              <table className="mongo-index-dashboard-collections-table">
                <thead>
                  <tr>
                    <th>Collection</th>
                    <th>Doc Num</th>
                    <th>Indexed Doc Num</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.collections.map((coll, idx) => {
                    const collKey = `${coll.database}/${coll.collection}`;
                    const isRebuilding = isRebuildingCollection === collKey;
                    const isRefreshing = refreshingCollection === collKey;
                    
                    return (
                      <tr
                        key={idx}
                        onContextMenu={(e) => handleContextMenu(e, coll)}
                        className={isRebuilding ? 'rebuilding' : ''}
                      >
                        <td className="collection-name">
                          {coll.database}/{coll.collection}
                          {isRebuilding && progress && (
                            <span style={{ marginLeft: '8px', fontSize: '11px', color: '#666' }}>
                              ({progress.processedDocs}/{progress.totalDocs})
                            </span>
                          )}
                          {isRebuilding && !progress && <SpinningCircle width={12} height={12} style={{ marginLeft: '4px' }} />}
                        </td>
                        <td className="collection-count">
                          {coll.docCount}
                          {!isRebuilding && (
                            <button
                              onClick={(e) => handleRefreshCollection(e, coll.database, coll.collection)}
                              disabled={isRefreshing}
                              className="mongo-index-dashboard-refresh-btn"
                              title="Refresh count"
                            >
                              {isRefreshing ? <SpinningCircle width={10} height={10} /> : <RefreshIcon width={10} height={10} />}
                            </button>
                          )}
                        </td>
                        <td className="collection-count">
                          {isRebuilding ? '(rebuilding index)' : (coll.indexedDocCount || 0)}
                          {!isRebuilding && (
                            <button
                              onClick={(e) => handleRefreshCollection(e, coll.database, coll.collection)}
                              disabled={isRefreshing}
                              className="mongo-index-dashboard-refresh-btn"
                              title="Refresh count"
                            >
                              {isRefreshing ? <SpinningCircle width={10} height={10} /> : <RefreshIcon width={10} height={10} />}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {collectionRebuildResult && (
                <div className="mongo-index-dashboard-rebuild-result">
                  <div className="mongo-index-dashboard-rebuild-result-header">
                    <strong>Collection Rebuild: {collectionRebuildResult.collKey}</strong>
                    <button 
                      onClick={() => setCollectionRebuildResult(null)}
                      className="mongo-index-dashboard-close-button"
                    >
                      ×
                    </button>
                  </div>
                  <div>Total docs: {collectionRebuildResult.totalDocs}</div>
                  <div>Indexed docs: {collectionRebuildResult.indexedDocs}</div>
                  {collectionRebuildResult.errors && collectionRebuildResult.errors.length > 0 && (
                    <div className="mongo-index-dashboard-rebuild-errors">
                      <div><strong>Errors: {collectionRebuildResult.errors.length}</strong></div>
                      <div className="mongo-index-dashboard-rebuild-errors-list">
                        {collectionRebuildResult.errors.slice(0, 10).map((err, idx) => (
                          <div key={idx} className="mongo-index-dashboard-rebuild-error-item">
                            {err}
                          </div>
                        ))}
                        {collectionRebuildResult.errors.length > 10 && (
                          <div className="mongo-index-dashboard-rebuild-error-item">
                            ... and {collectionRebuildResult.errors.length - 10} more errors
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {contextMenu && (
        <Menu
          items={[
            { type: 'item', name: 'Rebuild' }
          ]}
          position={contextMenu.position}
          onClose={handleMenuClose}
          onItemClick={handleMenuItemClick}
        />
      )}
    </div>
  );
};

export default MongoIndexDashboard;
