import React, { useState, useEffect } from 'react';
import { SpinningCircle, RefreshIcon, KeyValuesComp } from '@wwf971/react-comp-misc';
import { getBackendServerUrl } from '../remote/dataStore';
import './mongo-index.css';

/**
 * MongoIndexDashboard - Shows stats and provides rebuild functionality
 * This is a child component of MongoIndexCard
 */
const MongoIndexDashboard = ({ index, onRebuildingChange }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildResult, setRebuildResult] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const backendUrl = getBackendServerUrl();
      const response = await fetch(`${backendUrl}/mongo-index/${encodeURIComponent(index.name)}/stats`);
      const result = await response.json();

      if (result.code === 0) {
        setStats(result.data);
      } else {
        setError(result.message || 'Failed to fetch stats');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRebuild = async (maxDocs = null) => {
    setRebuilding(true);
    if (onRebuildingChange) {
      onRebuildingChange(true);
    }
    setRebuildResult(null);
    setError(null);

    try {
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
        setTimeout(() => fetchStats(), 500);
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
    fetchStats();
  }, [index.name]);

  return (
    <div className="mongo-index-dashboard">
      <div className="mongo-index-dashboard-header">
        <h5 className="mongo-index-dashboard-title">Index Statistics</h5>
        <button
          onClick={fetchStats}
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
          <div><strong>Rebuild completed:</strong></div>
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
          <KeyValuesComp
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
              <div className="mongo-index-dashboard-collections-title">Collections:</div>
              <div className="mongo-index-dashboard-collections-list">
                {stats.collections.map((coll, idx) => (
                  <div key={idx} className="mongo-index-dashboard-collection-item">
                    <span className="mongo-index-dashboard-collection-name">
                      {coll.database}.{coll.collection}
                    </span>
                    <span className="mongo-index-dashboard-collection-count">
                      {coll.docCount} docs
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MongoIndexDashboard;
