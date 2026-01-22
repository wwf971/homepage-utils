import React, { useState, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { SpinningCircle, RefreshIcon, PlusIcon } from '@wwf971/react-comp-misc';
import { 
  mongoSelectedDatabaseAtom,
  mongoCollectionsAtom,
  mongoSelectedCollectionAtom,
  fetchMongoCollections,
  createMongoCollection
} from '../remote/dataStore';
import './mongo.css';

/**
 * CollListAll - Component for listing all collections in a selected MongoDB database
 * 
 * @param {boolean} hasSuccessfulTest - Whether a successful test result exists
 */
const CollListAll = ({ hasSuccessfulTest }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [createError, setCreateError] = useState(null);
  const [creating, setCreating] = useState(false);
  
  const selectedDatabase = useAtomValue(mongoSelectedDatabaseAtom);
  const selectedCollection = useAtomValue(mongoSelectedCollectionAtom);
  const collections = useAtomValue(mongoCollectionsAtom);
  const setCollections = useSetAtom(mongoCollectionsAtom);
  const setSelectedCollection = useSetAtom(mongoSelectedCollectionAtom);

  useEffect(() => {
    if (selectedDatabase && hasSuccessfulTest) {
      // Clear previous collections and load new ones
      setCollections([]);
      loadCollections();
    } else {
      setCollections([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatabase, hasSuccessfulTest]);

  const handleRefresh = () => {
    if (selectedDatabase && hasSuccessfulTest) {
      setCollections([]);
      loadCollections();
    }
  };

  const handleCollectionClick = (collectionName) => {
    setSelectedCollection(collectionName);
  };

  const loadCollections = async () => {
    if (!selectedDatabase) return;

    setLoading(true);
    setError(null);

    const result = await fetchMongoCollections(selectedDatabase);
    
    if (result.code === 0) {
      setCollections(result.data);
    } else {
      setError(result.message);
    }
    
    setLoading(false);
  };

  const handleCreateClick = () => {
    setShowCreatePopup(true);
    setNewCollectionName('');
    setCreateError(null);
  };

  const handleCreateCancel = () => {
    setShowCreatePopup(false);
    setNewCollectionName('');
    setCreateError(null);
  };

  const handleCreateSubmit = async () => {
    const trimmedName = newCollectionName.trim();
    
    if (!trimmedName) {
      setCreateError('Collection name cannot be empty');
      return;
    }

    // Frontend validation: check if collection already exists
    if (collections.includes(trimmedName)) {
      setCreateError(`Collection "${trimmedName}" already exists`);
      return;
    }

    setCreating(true);
    setCreateError(null);

    const result = await createMongoCollection(selectedDatabase, trimmedName);
    
    if (result.code === 0) {
      // Success - refresh collections list
      setShowCreatePopup(false);
      setNewCollectionName('');
      loadCollections();
    } else {
      setCreateError(result.message);
    }
    
    setCreating(false);
  };

  if (!selectedDatabase) {
    return null;
  }

  return (
    <div className="mongo-collections-section" style={{ marginTop: '24px' }}>
      <div className="mongo-section-header">
        <h3>Collections in "{selectedDatabase}"</h3>
        <div className="mongo-section-buttons">
          <button
            className="mongo-refresh-button"
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh collections"
          >
            <RefreshIcon width={16} height={16} />
          </button>
          <button
            className="mongo-refresh-button"
            onClick={handleCreateClick}
            disabled={loading}
            title="Create new collection"
          >
            <PlusIcon width={16} height={16} />
          </button>
        </div>
      </div>
      
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
          <SpinningCircle width={16} height={16} color="#666" />
          <span>Loading collections...</span>
        </div>
      )}

      {error && (
        <div className="test-result error" style={{ marginTop: '12px' }}>
          <strong>✗ Error</strong>
          <div className="result-message">{error}</div>
        </div>
      )}

      {Array.isArray(collections) && !loading && (
        <div style={{ marginTop: '12px' }}>
          <h4 style={{ marginBottom: '6px' }}>
            Found {collections.length} collection{collections.length !== 1 ? 's' : ''}:
          </h4>
          {collections.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No collections in this database</p>
          ) : (
            <div className="mongo-tags-container">
              {collections.map((collection, index) => (
                <span 
                  key={index} 
                  className={`mongo-tag mongo-tag-clickable ${selectedCollection === collection ? 'mongo-tag-selected' : ''}`}
                  onClick={() => handleCollectionClick(collection)}
                >
                  {collection}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {showCreatePopup && (
        <div className="mongo-popup-overlay" onClick={handleCreateCancel}>
          <div className="mongo-popup" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Collection</h3>
            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Collection Name:
              </label>
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateSubmit();
                  } else if (e.key === 'Escape') {
                    handleCreateCancel();
                  }
                }}
                placeholder="Enter collection name"
                autoFocus
                disabled={creating}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
            
            {createError && (
              <div className="test-result error" style={{ marginTop: '12px' }}>
                <div className="result-message">{createError}</div>
              </div>
            )}

            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCreateCancel}
                disabled={creating}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSubmit}
                disabled={creating}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  background: creating ? '#ccc' : '#007bff',
                  color: 'white',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {creating && <SpinningCircle width={14} height={14} color="white" />}
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollListAll;

