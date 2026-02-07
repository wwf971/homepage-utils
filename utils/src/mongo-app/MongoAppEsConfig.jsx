import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { MinusIcon, PlusIcon, RefreshIcon } from '@wwf971/react-comp-misc';
import MongoAppEsIndexCard from './MongoAppEsIndexCard.jsx';
import './MongoAppConfig.css';

const IndexItem = observer(({ esIndexName, indexInfo, appId, store }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const collections = indexInfo?.collections || [];

  return (
    <div className="collection-item-container">
      <div 
        className="index-item-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="collection-item-content">
          {isExpanded ? (
            <MinusIcon width={10} height={10} color="#999" strokeWidth={2} />
          ) : (
            <PlusIcon width={10} height={10} color="#999" strokeWidth={2} />
          )}
          <span className="collection-item-name">
            {esIndexName}
          </span>
        </div>
        <div className="collection-item-status">
          <span className="collection-item-count">
            ({collections.length} collection{collections.length !== 1 ? 's' : ''})
          </span>
        </div>
      </div>
      
      {isExpanded && (
        <div className="index-item-details">
          <MongoAppEsIndexCard
            esIndexName={esIndexName}
            indexInfo={indexInfo}
            appId={appId}
            store={store}
          />
        </div>
      )}
    </div>
  );
});

const MongoAppEsConfig = observer(({ store }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [indicesDetails, setIndicesDetails] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (store.isConfigured) {
      loadIndices();
    }
  }, [store.appId]);

  const loadIndices = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Ensure mongo-indices cache is loaded
      await store.fetchAllMongoIndices();
      
      // Get app's ES indices
      const appEsIndices = store.appMetadata?.esIndices || [];
      
      // Find corresponding mongo-index metadata for each ES index
      const details = {};
      for (const esIndexName of appEsIndices) {
        const mongoIndex = store.allMongoIndices.find(idx => idx.esIndex === esIndexName);
        if (mongoIndex) {
          // Use ES index name as key for display
          details[esIndexName] = mongoIndex;
        }
      }
      
      setIndicesDetails(details);
    } catch (err) {
      setError(err.message || 'Failed to load indices');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    await store.fetchAppMetadata();
    await store.fetchAllMongoIndices(true);
    await loadIndices();
  };

  if (!store.isConfigured) return null;

  const esIndexNames = Object.keys(indicesDetails);

  return (
    <div style={{ marginTop: '8px' }}>
      <div className="items-header">
        <div className="items-header-left">
          <span className="items-count-text">
            {esIndexNames.length} index{esIndexNames.length !== 1 ? 'es' : ''}
          </span>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="mongo-app-refresh-button"
            title="Refresh"
          >
            <RefreshIcon width={14} height={14} color="#57606a" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="items-loading">
          Loading...
        </div>
      ) : error ? (
        <div style={{ 
          padding: '4px 6px', 
          background: '#fff3cd', 
          borderLeft: '2px solid #ffc107',
          fontSize: '11px',
          color: '#856404'
        }}>
          {error}
        </div>
      ) : esIndexNames.length > 0 ? (
        <div>
          {esIndexNames.map((esIndexName) => (
            <IndexItem 
              key={esIndexName} 
              esIndexName={esIndexName}
              indexInfo={indicesDetails[esIndexName]}
              appId={store.appId}
              store={store}
            />
          ))}
        </div>
      ) : (
        <div className="items-empty">
          No indices configured
        </div>
      )}
    </div>
  );
});

export default MongoAppEsConfig;
