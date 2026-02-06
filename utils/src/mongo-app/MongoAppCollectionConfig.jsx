import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { observer } from 'mobx-react-lite';
import { MinusIcon, PlusIcon, RefreshIcon, CrossIcon } from '@wwf971/react-comp-misc';
import './MongoAppConfig.css';

const CollectionItem = observer(({ collName, collectionInfo, store }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const exists = collectionInfo?.exists || false;
  const docCount = collectionInfo?.docCount || 0;
  const indices = collectionInfo?.indices || [];
  
  // Separate internal and external indices
  const internalIndices = indices.filter(idx => !idx.external);
  const externalIndices = indices.filter(idx => idx.external);

  const handleCreate = async () => {
    await store.createCollection(collName);
  };

  return (
    <div className="collection-item-container">
      <div 
        className={`collection-item-header ${!exists ? 'collection-item-header-nonexist' : ''}`}
        onClick={exists ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="collection-item-content">
          {exists && (
            isExpanded ? (
              <MinusIcon width={10} height={10} color="#999" strokeWidth={2} />
            ) : (
              <PlusIcon width={10} height={10} color="#999" strokeWidth={2} />
            )
          )}
          <span className={`collection-item-name ${!exists ? 'collection-item-name-nonexist' : ''}`}>
            {collName}
            {exists && docCount > 0 && (
              <span className="collection-item-count">
                ({docCount})
              </span>
            )}
          </span>
        </div>
        <div className="collection-item-status">
          {exists ? (
            <span className="collection-item-status-exists">Exists</span>
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
        <div className="collection-item-details">
          <div className="collection-item-details-label">ES Indices:</div>
          {indices.length > 0 ? (
            <div className="collection-indices-container">
              {internalIndices.length > 0 && (
                <div className="collection-indices-row">
                  {internalIndices.map((indexInfo, idx) => (
                    <span key={idx} className="index-tag-internal">
                      {indexInfo.name}
                    </span>
                  ))}
                </div>
              )}
              {externalIndices.length > 0 && (
                <div>
                  <div className="external-label">External:</div>
                  <div className="collection-indices-row">
                    {externalIndices.map((indexInfo, idx) => (
                      <span key={idx} className="index-tag-external">
                        {indexInfo.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="no-items-text">None</div>
          )}
        </div>
      )}
    </div>
  );
});

const CreateCollectionPanel = observer(({ store, onClose, onSuccess }) => {
  const [collectionName, setCollectionName] = useState('');
  const [selectedAppIndices, setSelectedAppIndices] = useState(new Set());
  const [selectedExternalIndices, setSelectedExternalIndices] = useState(new Set());
  const [externalSearchQuery, setExternalSearchQuery] = useState('');
  const [externalSearchResults, setExternalSearchResults] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState(null);
  const searchInputRef = React.useRef(null);

  // Get app's ES indices
  const appIndices = store.appMetadata?.esIndices || [];

  // Load mongo-indices on mount
  useEffect(() => {
    store.fetchAllMongoIndices();
  }, []);

  // Filter indices based on search query (using cached data)
  useEffect(() => {
    if (!externalSearchQuery.trim()) {
      setExternalSearchResults([]);
      return;
    }

    const query = externalSearchQuery.toLowerCase();
    const filtered = store.allMongoIndices
      .filter(idx => {
        const esIndexName = idx.esIndex || '';
        // Exclude app's own indices and already selected external indices
        if (appIndices.includes(esIndexName)) return false;
        if (selectedExternalIndices.has(esIndexName)) return false;
        // Filter by query
        return esIndexName.toLowerCase().includes(query) ||
               (idx.name && idx.name.toLowerCase().includes(query));
      })
      .map(idx => ({
        esIndex: idx.esIndex,
        name: idx.name
      }));

    setExternalSearchResults(filtered);
  }, [externalSearchQuery, store.allMongoIndices, appIndices, selectedExternalIndices]);

  const handleToggleAppIndex = (indexName) => {
    const newSet = new Set(selectedAppIndices);
    if (newSet.has(indexName)) {
      newSet.delete(indexName);
    } else {
      newSet.add(indexName);
    }
    setSelectedAppIndices(newSet);
  };

  const handleSelectExternalIndex = (esIndexName) => {
    const newSet = new Set(selectedExternalIndices);
    newSet.add(esIndexName);
    setSelectedExternalIndices(newSet);
    setExternalSearchQuery('');
    setExternalSearchResults([]);
  };

  const handleRemoveExternalIndex = (esIndexName) => {
    const newSet = new Set(selectedExternalIndices);
    newSet.delete(esIndexName);
    setSelectedExternalIndices(newSet);
  };

  // Update dropdown position when search results change
  useEffect(() => {
    if (externalSearchResults.length > 0 && searchInputRef.current) {
      const rect = searchInputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width
      });
    } else {
      setDropdownPosition(null);
    }
  }, [externalSearchResults]);

  const handleCreate = async () => {
    if (!collectionName.trim()) {
      setError('Collection name is required');
      return;
    }

    const allSelectedIndices = [...selectedAppIndices, ...selectedExternalIndices];

    if (allSelectedIndices.length === 0) {
      setError('At least one index must be selected');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // 1. Create collection
      const createResp = await fetch(`${store.apiBase}/${store.appId}/coll/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionName: collectionName.trim() }),
      });

      const createResult = await createResp.json();
      if (createResult.code !== 0) {
        throw new Error(createResult.message || 'Failed to create collection');
      }

      const fullCollName = createResult.data.fullCollectionName;

      // 2. Register collection with each selected index
      const APP_DB_NAME = 'mongo-app';
      
      // Ensure mongo-indices are loaded
      await store.fetchAllMongoIndices();

      // Map ES index names to mongo-index metadata
      const indicesMap = new Map();
      store.allMongoIndices.forEach(idx => {
        if (idx.esIndex) {
          indicesMap.set(idx.esIndex, idx);
        }
      });

      // Update each selected index
      const updatePromises = allSelectedIndices.map(async (esIndexName) => {
        const indexMeta = indicesMap.get(esIndexName);
        if (!indexMeta) {
          console.warn(`Index metadata not found for ES index: ${esIndexName}`);
          return;
        }

        // Get current collections for this index
        const currentCollections = indexMeta.collections || [];

        // Add new collection
        const updatedCollections = [
          ...currentCollections,
          { database: APP_DB_NAME, collection: fullCollName }
        ];

        // Update index
        await fetch(`${store.serverUrl}/mongo-index/${indexMeta.name}/update`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            esIndex: esIndexName,
            collections: updatedCollections
          }),
        });
      });

      await Promise.all(updatePromises);
      
      // Refresh mongo-indices cache after updates
      await store.fetchAllMongoIndices(true);

      // Success - refresh and close
      await store.fetchAllCollections();
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err) {
      setError(err.message || 'Failed to create collection');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '4px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
            Create New Collection
          </div>
        </div>
        
        <div style={{
          padding: '12px 16px',
          overflowY: 'auto',
          flex: 1
        }}>

          {/* Collection Name */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#666', marginBottom: '4px' }}>
              Collection Name:
            </label>
            <input
              type="text"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="my_collection"
              style={{
                width: '100%',
                padding: '4px 6px',
                border: '1px solid #d0d7de',
                borderRadius: '3px',
                fontSize: '12px'
              }}
            />
          </div>

          {/* App Indices Selection */}
          {appIndices.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                App Indices (select to monitor):
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {appIndices.map((indexName) => (
                  <span
                    key={indexName}
                    onClick={() => handleToggleAppIndex(indexName)}
                    style={{
                      padding: '2px 6px',
                      background: selectedAppIndices.has(indexName) ? '#0969da' : '#f6f8fa',
                      color: selectedAppIndices.has(indexName) ? '#fff' : '#57606a',
                      border: `1px solid ${selectedAppIndices.has(indexName) ? '#0969da' : '#d0d7de'}`,
                      borderRadius: '3px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    {indexName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* External Indices Selection */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '11px', color: '#666', marginBottom: '4px' }}>
              External Indices (optional):
            </label>
            
            {/* Selected external indices as tags */}
            {selectedExternalIndices.size > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                {Array.from(selectedExternalIndices).map((indexName) => (
                  <span
                    key={indexName}
                    style={{
                      position: 'relative',
                      padding: '2px 18px 2px 6px',
                      background: '#0969da',
                      color: '#fff',
                      border: '1px solid #0969da',
                      borderRadius: '3px',
                      fontSize: '11px',
                      userSelect: 'none'
                    }}
                  >
                    {indexName}
                    <span
                      onClick={() => handleRemoveExternalIndex(indexName)}
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        width: '14px',
                        height: '14px',
                        background: '#dc3545',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        border: '1px solid #fff'
                      }}
                    >
                      <CrossIcon width={8} height={8} color="#fff" />
                    </span>
                  </span>
                ))}
              </div>
            )}

            {/* Search input */}
            <input
              ref={searchInputRef}
              type="text"
              value={externalSearchQuery}
              onChange={(e) => setExternalSearchQuery(e.target.value)}
              placeholder="Search for external index..."
              style={{
                width: '100%',
                padding: '4px 6px',
                border: '1px solid #d0d7de',
                borderRadius: '3px',
                fontSize: '12px'
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '6px',
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '3px',
              fontSize: '11px',
              color: '#856404',
              marginBottom: '12px'
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ 
          padding: '12px 16px', 
          borderTop: '1px solid #e0e0e0',
          display: 'flex', 
          gap: '6px', 
          justifyContent: 'flex-end' 
        }}>
          <button
            onClick={onClose}
            disabled={isCreating}
            style={{
              padding: '4px 8px',
              border: '1px solid #d0d7de',
              borderRadius: '3px',
              background: '#f6f8fa',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              fontSize: '11px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !collectionName.trim()}
            style={{
              padding: '4px 8px',
              border: '1px solid #0969da',
              borderRadius: '3px',
              background: '#0969da',
              color: '#fff',
              cursor: (isCreating || !collectionName.trim()) ? 'not-allowed' : 'pointer',
              fontSize: '11px'
            }}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>

      {/* Search results dropdown - rendered as portal to avoid clipping */}
      {dropdownPosition && externalSearchQuery && externalSearchResults.length > 0 && ReactDOM.createPortal(
        <div style={{
          position: 'fixed',
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
          width: `${dropdownPosition.width}px`,
          background: '#fff',
          border: '1px solid #d0d7de',
          borderRadius: '3px',
          maxHeight: '200px',
          overflowY: 'auto',
          zIndex: 1002,
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          {externalSearchResults.map((idx) => (
            <div
              key={idx.esIndex}
              onClick={() => handleSelectExternalIndex(idx.esIndex)}
              style={{
                padding: '6px 8px',
                cursor: 'pointer',
                borderBottom: '1px solid #f0f0f0',
                fontSize: '11px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f6f8fa'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
            >
              <div style={{ fontWeight: '500', color: '#333' }}>{idx.esIndex}</div>
              <div style={{ fontSize: '10px', color: '#666' }}>mongo-index: {idx.name}</div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
});

const MongoAppCollectionConfig = observer(({ store, collections = [] }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);

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
      <div className="items-header">
        <div className="items-header-left">
          <span className="items-count-text">
            {collectionsList.length} collection{collectionsList.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            style={{
              padding: '2px',
              border: '1px solid #d0d7de',
              borderRadius: '3px',
              background: '#f6f8fa',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Refresh"
          >
            <RefreshIcon width={14} height={14} color="#57606a" />
          </button>
        </div>
        <button
          onClick={() => setShowCreatePanel(true)}
          style={{
            padding: '2px 6px',
            border: '1px solid #0969da',
            borderRadius: '3px',
            background: '#0969da',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: '500'
          }}
        >
          Create Collection
        </button>
      </div>

      {isLoading ? (
        <div className="items-loading">
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
        <div className="items-empty">
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

      {showCreatePanel && (
        <>
          <CreateCollectionPanel
            store={store}
            onClose={() => setShowCreatePanel(false)}
            onSuccess={() => {
              setShowCreatePanel(false);
              loadCollections();
            }}
          />
        </>
      )}
    </div>
  );
});

export default MongoAppCollectionConfig;
