import React, { useState, useEffect } from 'react';
import { SpinningCircle, RefreshIcon, PlusIcon } from '@wwf971/react-comp-misc';
import { getBackendServerUrl } from '../remote/dataStore';
import MongoIndexCard from './MongoIndexCard';
import CreateMongoIndex from './CreateMongoIndex';
import '../mongo/mongo.css';

/**
 * MongoIndex - Main component for managing MongoDB-ES indices
 */
const MongoIndex = () => {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const loadIndices = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const backendUrl = getBackendServerUrl();
      const response = await fetch(`${backendUrl}/mongo/index/`);
      const result = await response.json();
      
      if (result.code === 0) {
        setIndices(result.data || []);
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
    loadIndices();
  };
  
  const handleIndexCreated = (newIndex) => {
    setIndices(prev => [...prev, newIndex]);
    setShowCreateForm(false);
  };
  
  const handleIndexUpdated = (updatedIndex) => {
    setIndices(prev => prev.map(idx => 
      idx.name === updatedIndex.name ? updatedIndex : idx
    ));
  };
  
  const handleIndexDeleted = (indexName) => {
    setIndices(prev => prev.filter(idx => idx.name !== indexName));
  };
  
  return (
    <div className="mongo-index-section" style={{ marginTop: '8px' }}>
      <div className="mongo-section-header">
        <h3>MongoDB-Elasticsearch Indices</h3>
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
      
      <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', marginBottom: '12px' }}>
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
          <div className="result-message">{error}</div>
        </div>
      )}
      
      {showCreateForm && (
        <CreateMongoIndex
          onCreated={handleIndexCreated}
          onCancel={() => setShowCreateForm(false)}
        />
      )}
      
      {!loading && indices.length === 0 && !showCreateForm && (
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
      
      {!loading && indices.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          {indices.map(index => (
            <MongoIndexCard
              key={index.name}
              index={index}
              onUpdate={handleIndexUpdated}
              onDelete={handleIndexDeleted}
              onJsonEdit={handleIndexUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MongoIndex;

