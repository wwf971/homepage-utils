import React, { useState, useEffect, useMemo } from 'react';
import { useAtom, useAtomValue, useSetAtom, useStore } from 'jotai';
import { SpinningCircle, RefreshIcon, PlusIcon } from '@wwf971/react-comp-misc';
import { 
  fetchMongoIndices, 
  mongoIndicesLoadingAtom, 
  mongoIndicesErrorAtom 
} from './mongoIndexStore';
import { getIndexAtom, esIndexNamesAtom } from '../elasticsearch/EsStore';
import MongoIndexCard from './MongoIndexCard';
import MongoIndexCreate from './MongoIndexCreate';
import '../mongo/mongo.css';

/**
 * Wrapper that reads the individual ES index atom for a specific index
 * This ensures fine-grained reactivity - only re-renders when THIS index changes
 * 
 * Filters out non-mongo-indices by returning null
 */
const MongoIndexCardWrapper = ({ indexName, onUpdate, onDelete, onJsonEdit }) => {
  const indexAtom = getIndexAtom(indexName);
  const indexData = useAtomValue(indexAtom);
  
  // Skip if not a mongo-index
  if (!indexData || !indexData.isMongoIndex || !indexData.mongoData) {
    return null;
  }
  
  return (
    <MongoIndexCard
      index={indexData.mongoData}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onJsonEdit={onJsonEdit}
    />
  );
};

/**
 * MongoIndexPanel - Main component for managing MongoDB-ES indices
 */
const MongoIndexPanel = () => {
  const allIndexNames = useAtomValue(esIndexNamesAtom);  // All ES index names
  const [loading, setLoading] = useAtom(mongoIndicesLoadingAtom);
  const [error, setError] = useAtom(mongoIndicesErrorAtom);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Defensive: ensure allIndexNames is an array of strings
  const safeIndexNames = useMemo(() => {
    if (!Array.isArray(allIndexNames)) {
      console.warn('allIndexNames is not an array:', allIndexNames);
      return [];
    }
    const filtered = allIndexNames.filter(name => {
      if (typeof name !== 'string') {
        console.error('Non-string index name found:', name);
        return false;
      }
      return true;
    });
    return filtered;
  }, [allIndexNames]);
  
  // Get the store to access getter/setter functions
  const store = useStore();
  
  // Helper to get atom values (for passing to store functions)
  const getAtomValue = (atom) => store.get(atom);
  
  // Helper to set atom values (for passing to store functions)
  const setAtomValue = (atom, value) => store.set(atom, value);
  
  const loadIndices = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchMongoIndices(forceRefresh, getAtomValue, setAtomValue);
      
      if (result.code === 0) {
        // No need to setIndices - the derived atom will update automatically
      } else {
        setError(result.message || 'Failed to load indices');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadIndices();
  }, []);
  
  const handleRefresh = () => {
    loadIndices(true); // Force refresh
  };
  
  const handleIndexCreated = (newIndex) => {
    // No need to manually update - the derived atom will update automatically
    setShowCreateForm(false);
  };
  
  const handleIndexUpdated = (updatedIndex) => {
    // No need to manually update - the derived atom will update automatically
  };
  
  const handleIndexDeleted = (indexName) => {
    // No need to manually update - the derived atom will update automatically
  };
  
  return (
    <div className="main-panel">
      <div className="mongo-section-header">
        <div className="section-title">MongoDB-Elasticsearch Indices</div>
        <div className="mongo-section-buttons">
          <button
            className="mongo-refresh-button"
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh indices"
          >
            <RefreshIcon width={16} height={16} />
          </button>
          <button
            className="mongo-refresh-button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            disabled={loading}
            title={showCreateForm ? "Cancel" : "Create new index"}
          >
            <PlusIcon width={16} height={16} />
          </button>
        </div>
      </div>
      
      <div style={{ fontSize: '12px', color: '#666' }}>
        Manage Elasticsearch indices that track MongoDB collections for search functionality.
      </div>
      
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
          <SpinningCircle width={16} height={16} color="#666" />
          <span>Loading indices...</span>
        </div>
      )}
      
      {error && (
        <div className="test-result error" style={{ marginTop: '6px' }}>
          <strong>✗ Error</strong>
          <div className="result-message">{typeof error === 'string' ? error : JSON.stringify(error)}</div>
        </div>
      )}
      
      
      {!loading && safeIndexNames.length === 0 && !showCreateForm && (
        <div style={{ 
          padding: '24px', 
          textAlign: 'center', 
          color: '#999',
          fontSize: '13px',
          fontStyle: 'italic'
        }}>
          No indices configured. Click the + button to create one.
        </div>
      )}
      
      {!loading && safeIndexNames.length > 0 && (
        <div>
          {safeIndexNames.map(name => (
            <MongoIndexCardWrapper
              key={name}
              indexName={name}
              onUpdate={handleIndexUpdated}
              onDelete={handleIndexDeleted}
              onJsonEdit={handleIndexUpdated}
            />
          ))}
        </div>
      )}

      {showCreateForm && (
        <div className="mongo-popup-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="mongo-popup" onClick={(e) => e.stopPropagation()} style={{ minWidth: '500px', maxWidth: '600px' }}>
            <MongoIndexCreate
              onCreated={handleIndexCreated}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MongoIndexPanel;

