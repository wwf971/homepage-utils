import React, { useState, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { SpinningCircle, RefreshIcon, PlusIcon, Menu } from '@wwf971/react-comp-misc';
import { 
  mongoSelectedDatabaseAtom,
  mongoCollectionsAtom,
  mongoSelectedCollectionAtom,
  fetchMongoCollections
} from '../remote/dataStore';
import CollDeleteConfirm from './CollDeleteConfirm';
import CollCreateConfirm from './CollCreateConfirm';
import CollIndexInfo from './CollIndexInfo';
import './mongo.css';

/**
 * CollListAll - Component for listing all collections in a selected MongoDB database
 */
const CollListAll = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [collectionToDelete, setCollectionToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [collectionForIndexInfo, setCollectionForIndexInfo] = useState(null);
  const [showIndexInfo, setShowIndexInfo] = useState(false);
  
  const selectedDatabase = useAtomValue(mongoSelectedDatabaseAtom);
  const selectedCollection = useAtomValue(mongoSelectedCollectionAtom);
  const collections = useAtomValue(mongoCollectionsAtom);
  const setCollections = useSetAtom(mongoCollectionsAtom);
  const setSelectedCollection = useSetAtom(mongoSelectedCollectionAtom);

  useEffect(() => {
    if (selectedDatabase) {
      // Clear previous collections and load new ones
      setCollections([]);
      loadCollections();
    } else {
      setCollections([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatabase]);

  const handleRefresh = () => {
    if (selectedDatabase) {
      setCollections([]);
      loadCollections();
    }
  };

  const handleCollectionClick = (collectionName) => {
    setSelectedCollection(collectionName);
  };

  const handleCollectionContextMenu = (e, collectionName) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent backdrop from handling this
    
    // Select the collection
    setSelectedCollection(collectionName);
    
    // Close existing menu first
    setContextMenu(null);
    
    // Use requestAnimationFrame to ensure React completes unmount before remounting
    requestAnimationFrame(() => {
      setContextMenu({
        position: { x: e.clientX, y: e.clientY },
        collectionName
      });
    });
  };

  const handleBackdropContextMenu = (e) => {
    e.preventDefault();
    
    // Temporarily hide backdrop to find element underneath
    const backdrop = e.currentTarget;
    backdrop.style.pointerEvents = 'none';
    const clickedElement = document.elementFromPoint(e.clientX, e.clientY);
    backdrop.style.pointerEvents = '';
    
    // Check if we clicked on a collection tag
    const collectionTag = clickedElement?.closest('.mongo-tag-clickable');
    
    if (collectionTag) {
      // Find the collection name from the tag
      const collectionName = collectionTag.textContent;
      
      // Select the collection
      setSelectedCollection(collectionName);
      
      // Close existing menu first
      setContextMenu(null);
      
      // Use requestAnimationFrame to ensure React completes unmount before remounting
      requestAnimationFrame(() => {
        setContextMenu({
          position: { x: e.clientX, y: e.clientY },
          collectionName
        });
      });
    } else {
      // Right-click outside collection tags - just close menu
      setContextMenu(null);
    }
  };

  const handleMenuItemClick = (item) => {
    if (item.name === 'Delete' && contextMenu) {
      setCollectionToDelete(contextMenu.collectionName);
      setShowDeleteConfirm(true);
    } else if (item.name === 'Index Info' && contextMenu) {
      setCollectionForIndexInfo(contextMenu.collectionName);
      setShowIndexInfo(true);
    }
    setContextMenu(null);
  };
  
  const handleIndexInfoClose = () => {
    setShowIndexInfo(false);
    setCollectionForIndexInfo(null);
  };

  const handleDeleteConfirm = (result) => {
    setShowDeleteConfirm(false);
    setCollectionToDelete(null);
    
    // If the deleted collection was selected, clear selection
    if (selectedCollection === collectionToDelete) {
      setSelectedCollection(null);
    }
    
    // Refresh collections list
    loadCollections();
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setCollectionToDelete(null);
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
    setShowCreateConfirm(true);
  };

  const handleCreateConfirm = (result) => {
    setShowCreateConfirm(false);
    // Reload collections
    loadCollections();
  };

  const handleCreateCancel = () => {
    setShowCreateConfirm(false);
  };

  if (!selectedDatabase) {
    return null;
  }

  return (
    <div className="mongo-collections-section">
      <div className="mongo-section-header">
        <div className="section-title">Collections in "{selectedDatabase} Database"</div>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <SpinningCircle width={16} height={16} color="#666" />
          <span>Loading collections...</span>
        </div>
      )}

      {error && (
        <div className="test-result error" style={{ marginTop: '4px' }}>
          <strong>✗ Error</strong>
          <div className="result-message">{error}</div>
        </div>
      )}

      {Array.isArray(collections) && !loading && (
        <div>
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
                  onContextMenu={(e) => handleCollectionContextMenu(e, collection)}
                >
                  {collection}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {showCreateConfirm && (
        <CollCreateConfirm
          dbName={selectedDatabase}
          onConfirm={handleCreateConfirm}
          onCancel={handleCreateCancel}
        />
      )}

      {contextMenu && (
        <Menu
          items={[
            { type: 'item', name: 'Index Info' },
            { type: 'item', name: 'Delete' }
          ]}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onItemClick={handleMenuItemClick}
          onContextMenu={handleBackdropContextMenu}
        />
      )}

      {showDeleteConfirm && collectionToDelete && (
        <CollDeleteConfirm
          dbName={selectedDatabase}
          collName={collectionToDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
      
      {showIndexInfo && collectionForIndexInfo && (
        <CollIndexInfo
          dbName={selectedDatabase}
          collName={collectionForIndexInfo}
          onClose={handleIndexInfoClose}
        />
      )}
    </div>
  );
};

export default CollListAll;

