import React, { useState, useEffect } from 'react';
import { useStore } from 'jotai';
import { SpinningCircle, RefreshIcon, KeyValues, Menu } from '@wwf971/react-comp-misc';
import { fetchIndexStats, rebuildIndexForMongoCollection } from './mongoIndexStore';
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
    setContextMenu({
      position: { x: e.clientX, y: e.clientY },
      collection
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
      
      const result = await rebuildIndexForMongoCollection(index.name, database, collection, null, store.set);
      
      setIsRebuildingCollection(null);
      
      if (result.code === 0) {
        // Show rebuild result
        setCollectionRebuildResult({
          collKey,
          ...result.data
        });
        // Refresh stats to show updated counts
        await fetchStatsData(true);
      } else {
        setError(result.message || 'Failed to rebuild collection');
      }
    }
    handleMenuClose();
  };

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
                    
                    return (
                      <tr
                        key={idx}
                        onContextMenu={(e) => handleContextMenu(e, coll)}
                        className={isRebuilding ? 'rebuilding' : ''}
                      >
                        <td className="collection-name">
                          {coll.database}/{coll.collection}
                          {isRebuilding && <SpinningCircle width={12} height={12} style={{ marginLeft: '4px' }} />}
                        </td>
                        <td className="collection-count">{coll.docCount}</td>
                        <td className="collection-count">{coll.indexedDocCount || 0}</td>
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
