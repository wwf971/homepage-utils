import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { MinusIcon, PlusIcon } from '@wwf971/react-comp-misc';
import './MongoAppConfig.css';

const CollectionItem = observer(({ collName, collectionInfo, store }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const exists = collectionInfo?.exists || false;
  const indices = collectionInfo?.indices || [];

  const handleCreate = async () => {
    await store.createCollection(collName);
  };

  return (
    <div style={{ marginBottom: '4px' }}>
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '4px 6px',
          background: exists ? '#f8f9fa' : '#fff',
          borderLeft: exists ? '2px solid #28a745' : '2px solid #ddd',
          cursor: exists ? 'pointer' : 'default'
        }}
        onClick={exists ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
          {exists && (
            isExpanded ? (
              <MinusIcon width={10} height={10} color="#999" strokeWidth={2} />
            ) : (
              <PlusIcon width={10} height={10} color="#999" strokeWidth={2} />
            )
          )}
          <span style={{ fontSize: '12px', color: exists ? '#333' : '#999' }}>
            {collName}
          </span>
        </div>
        <div>
          {exists ? (
            <span style={{ fontSize: '10px', color: '#28a745', fontWeight: '500' }}>Exists</span>
          ) : (
            <button
              className="config-button-small config-button-small-primary"
              onClick={handleCreate}
              style={{ fontSize: '10px', padding: '2px 6px' }}
            >
              Create
            </button>
          )}
        </div>
      </div>
      
      {exists && isExpanded && (
        <div style={{ 
          padding: '4px 6px 4px 24px',
          background: '#fafbfc',
          borderLeft: '2px solid #e3e8ed',
          fontSize: '11px'
        }}>
          <div style={{ color: '#666', marginBottom: '2px' }}>ES Indices:</div>
          {indices.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
              {indices.map((indexName, idx) => (
                <span 
                  key={idx}
                  style={{
                    padding: '1px 4px',
                    background: '#e8f4f8',
                    color: '#0969da',
                    borderRadius: '2px',
                    fontSize: '10px'
                  }}
                >
                  {indexName}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ color: '#999', fontSize: '10px' }}>None</div>
          )}
        </div>
      )}
    </div>
  );
});

const MongoAppCollectionConfig = observer(({ store, collections = [] }) => {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (store.isConfigured) {
      loadCollections();
    }
  }, [store.appId]);

  const loadCollections = async () => {
    setIsLoading(true);
    await store.fetchAllCollections();
    setIsLoading(false);
  };

  const handleRefresh = async () => {
    await loadCollections();
  };

  if (!store.isConfigured) return null;

  // Merge expected collections with fetched collections
  const collectionsInfo = store.collectionsInfo || {};
  const allCollectionNames = new Set([...Object.keys(collectionsInfo), ...collections]);
  const collectionsList = Array.from(allCollectionNames);

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', color: '#666', fontWeight: '500' }}>
          {collectionsList.length} collection{collectionsList.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          style={{
            padding: '2px 6px',
            border: '1px solid #d0d7de',
            borderRadius: '3px',
            background: '#f6f8fa',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '10px',
            color: '#57606a'
          }}
        >
          {isLoading ? '...' : 'Refresh'}
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: '8px', color: '#999', fontSize: '11px', textAlign: 'center' }}>
          Loading...
        </div>
      ) : collectionsList.length > 0 ? (
        <div>
          {collectionsList.map((collName) => (
            <CollectionItem 
              key={collName} 
              collName={collName}
              collectionInfo={collectionsInfo[collName]}
              store={store}
            />
          ))}
        </div>
      ) : (
        <div style={{ padding: '8px', color: '#999', fontSize: '11px', textAlign: 'center' }}>
          No collections configured
        </div>
      )}

      {store.collectionError && (
        <div style={{ 
          marginTop: '6px', 
          padding: '4px 6px', 
          background: '#fff3cd', 
          borderLeft: '2px solid #ffc107',
          fontSize: '11px',
          color: '#856404'
        }}>
          {store.collectionError}
        </div>
      )}
    </div>
  );
});

export default MongoAppCollectionConfig;
