import React, { useState, useEffect } from 'react';
import { SpinningCircle, RefreshIcon, PlusIcon, JsonComp } from '@wwf971/react-comp-misc';
import { getBackendServerUrl } from '../remote/dataStore';
import { useMongoDocEditor } from '../mongo/mongoStore';
import MongoIndexCard from './MongoIndexCard';
import CreateMongoIndex from './CreateMongoIndex';
import '../mongo/mongo.css';
import './mongo-index.css';

/**
 * MongoIndex - Main component for managing MongoDB-ES indices
 */
const MongoIndex = () => {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [rawDocs, setRawDocs] = useState([]);
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  
  const loadIndices = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const backendUrl = getBackendServerUrl();
      const response = await fetch(`${backendUrl}/mongo/index/`);
      const result = await response.json();
      
      if (result.code === 0) {
        const docs = result.data || [];
        setIndices(docs);
        setRawDocs(docs); // Store raw docs for JSON view
      } else {
        setError(result.message || 'Failed to load indices');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleViewRawJson = () => {
    setShowRawJson(true);
    setSelectedDocIndex(0);
  };
  
  useEffect(() => {
    loadIndices();
  }, []);
  
  const handleRefresh = () => {
    loadIndices();
  };
  
  const handleIndexCreated = (newIndex) => {
    const updated = [...indices, newIndex];
    setIndices(updated);
    setRawDocs(updated);
    setShowCreateForm(false);
  };
  
  const handleIndexUpdated = (updatedIndex) => {
    const updated = indices.map(idx => 
      idx.name === updatedIndex.name ? updatedIndex : idx
    );
    setIndices(updated);
    setRawDocs(updated);
  };
  
  const handleIndexDeleted = (indexName) => {
    const updated = indices.filter(idx => idx.name !== indexName);
    setIndices(updated);
    setRawDocs(updated);
  };
  
  // Use doc editor for the currently selected raw doc
  const currentDoc = rawDocs[selectedDocIndex] || {};
  const { handleChange: handleDocChange, isUpdating } = useMongoDocEditor(
    'metadata',
    'mongo-index',
    currentDoc
  );
  
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
          <button
            className="mongo-refresh-button"
            onClick={handleViewRawJson}
            disabled={loading || indices.length === 0}
            title="View raw JSON metadata"
          >
            JSON
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
            />
          ))}
        </div>
      )}
      
      {showRawJson && rawDocs.length > 0 && (
        <div className="doc-editor-overlay" onClick={() => setShowRawJson(false)}>
          <div className="doc-editor-panel" onClick={(e) => e.stopPropagation()}>
            <div className="doc-editor-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0 }}>MongoDB Index Metadata</h3>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    metadata.mongo-index collection
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {rawDocs.length > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={() => setSelectedDocIndex(prev => Math.max(0, prev - 1))}
                        disabled={selectedDocIndex === 0}
                        style={{
                          padding: '2px 6px',
                          fontSize: '12px',
                          cursor: selectedDocIndex === 0 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        ←
                      </button>
                      <span style={{ fontSize: '12px' }}>
                        {selectedDocIndex + 1} / {rawDocs.length}
                      </span>
                      <button
                        onClick={() => setSelectedDocIndex(prev => Math.min(rawDocs.length - 1, prev + 1))}
                        disabled={selectedDocIndex === rawDocs.length - 1}
                        style={{
                          padding: '2px 6px',
                          fontSize: '12px',
                          cursor: selectedDocIndex === rawDocs.length - 1 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        →
                      </button>
                    </div>
                  )}
                  {isUpdating && (
                    <span style={{ 
                      fontSize: '13px',
                      color: '#856404',
                      fontWeight: '500'
                    }}>
                      Updating...
                    </span>
                  )}
                  <button
                    className="doc-editor-close-button"
                    onClick={() => setShowRawJson(false)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
            <div className="doc-editor-content">
              <JsonComp 
                data={currentDoc} 
                isEditable={true}
                isKeyEditable={true}
                isValueEditable={true}
                onChange={handleDocChange}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MongoIndex;

