import React, { useState } from 'react';
import { useStore } from 'jotai';
import { KeyValuesComp, SearchableValueComp, SpinningCircle, EditIcon, PlusIcon, CrossIcon, JsonComp } from '@wwf971/react-comp-misc';
import { getBackendServerUrl } from '../remote/dataStore';
import { updateMongoIndex, deleteMongoIndex } from './mongoIndexStore';
import { searchDatabases, searchCollections, useMongoDocEditor } from '../mongo/mongoStore';
import MongoIndexDashboard from './MongoIndexDashboard';
import MongoIndexSearch from './MongoIndexSearch';
import '../mongo/mongo.css';
import './mongo-index.css';

/**
 * Adapter for SearchableValueComp to work with KeyValuesComp
 */
const SearchableAdapter = ({ data, onChangeAttempt, field, index, searchType, editedIndex }) => {
  const [searchResults, setSearchResults] = useState([]);
  
  const handleSearch = async (value) => {
    if (!value || value.trim() === '') {
      return { code: 0, data: [] };
    }
    
    try {
      let result;
      
      if (searchType === 'database') {
        // Search databases using cache system
        result = await searchDatabases(value);
      } else if (searchType === 'collection') {
        // Get the database from the same row
        const dbValue = editedIndex?.collections[index]?.database || '';
        if (!dbValue) {
          return { code: 0, data: [] };
        }
        // Search collections using cache system
        result = await searchCollections(dbValue, value);
      }
      
      if (result && result.code === 0) {
        const results = result.data.map(item => ({
          value: item,
          label: item
        }));
        return { code: 0, data: results };
      }
      return { code: -1, data: [] };
    } catch (error) {
      console.error('Search failed:', error);
      return { code: -1, data: [] };
    }
  };
  
  const handleUpdate = async (configKey, newValue) => {
    if (onChangeAttempt) {
      // Map KeyValuesComp's 'key'/'value' to 'database'/'collection'
      const mappedField = field === 'key' ? 'database' : field === 'value' ? 'collection' : field;
      onChangeAttempt(index, mappedField, newValue);
    }
    return { code: 0, message: 'Updated successfully' };
  };
  
  return (
    <SearchableValueComp
      data={data}
      configKey={`${field}_${index}`}
      onUpdate={handleUpdate}
      onSearch={handleSearch}
      searchDebounce={300}
    />
  );
};

/**
 * MongoIndexCard - Display and edit a MongoDB-ES index
 */
const MongoIndexCard = ({ index, onUpdate, onDelete, onJsonEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedIndex, setEditedIndex] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  
  // Get the store to access getter/setter functions
  const store = useStore();
  const getAtomValue = (atom) => store.get(atom);
  const setAtomValue = (atom, value) => store.set(atom, value);
  
  // Use doc editor for this specific index document
  // Note: mongo-index collection is stored in the main configured database (usually 'main'), not 'metadata'
  const { handleChange: handleDocChange, isUpdating } = useMongoDocEditor(
    'main',
    'mongo-index',
    index
  );
  
  // Wrap handleDocChange to notify parent of updates
  const handleDocChangeWithNotify = async (path, changeData) => {
    const result = await handleDocChange(path, changeData);
    
    if (result.code === 0 && onJsonEdit) {
      // Fetch the updated document from backend to get the latest state
      try {
        const backendUrl = getBackendServerUrl();
        const response = await fetch(`${backendUrl}/mongo-index/${encodeURIComponent(index.name)}`);
        const fetchResult = await response.json();
        
        if (fetchResult.code === 0) {
          onJsonEdit(fetchResult.data);
        }
      } catch (err) {
        console.error('Failed to fetch updated index:', err);
      }
    }
    
    return result;
  };
  
  const handleEditClick = () => {
    setEditedIndex({
      ...index,
      collections: [...index.collections]
    });
    setIsEditing(true);
    setError(null);
  };
  
  const handleCancel = () => {
    setIsEditing(false);
    setEditedIndex(null);
    setError(null);
  };
  
  const handleCollectionChange = (idx, field, newValue) => {
    setEditedIndex(prev => {
      const updated = { ...prev };
      updated.collections = [...prev.collections];
      updated.collections[idx] = {
        ...updated.collections[idx],
        [field]: newValue
      };
      return updated;
    });
  };
  
  const handleAddCollection = () => {
    setEditedIndex(prev => ({
      ...prev,
      collections: [...prev.collections, { database: '', collection: '' }]
    }));
  };
  
  const handleRemoveCollection = (idx) => {
    setEditedIndex(prev => ({
      ...prev,
      collections: prev.collections.filter((_, i) => i !== idx)
    }));
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    
    try {
      const result = await updateMongoIndex(index.name, {
        esIndex: editedIndex.esIndex,
        collections: editedIndex.collections.filter(c => c.database && c.collection)
      }, setAtomValue, getAtomValue);
      
      if (result.code === 0) {
        setIsEditing(false);
        setEditedIndex(null);
        if (onUpdate) {
          onUpdate(result.data);
        }
      } else {
        setError(result.message || 'Failed to update index');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };
  
  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false);
    
    try {
      const result = await deleteMongoIndex(index.name, setAtomValue, getAtomValue);
      
      if (result.code === 0) {
        if (onDelete) {
          onDelete(index.name);
        }
      } else {
        setError(result.message || 'Failed to delete index');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    }
  };
  
  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };
  
  const displayIndex = isEditing ? editedIndex : index;
  const collections = displayIndex.collections || [];
  
  // Prepare data for KeyValuesComp
  const collectionsData = collections.map((coll, idx) => ({
    key: coll.database || '',
    value: coll.collection || '',
    keyComp: isEditing 
      ? (props) => <SearchableAdapter {...props} searchType="database" editedIndex={editedIndex} />
      : undefined,
    valueComp: isEditing
      ? (props) => <SearchableAdapter {...props} searchType="collection" editedIndex={editedIndex} />
      : undefined
  }));
  
  return (
    <div className="mongo-index-card">
      {showDeleteConfirm && (
        <div className="mongo-index-confirm-overlay">
          <div className="mongo-index-confirm-dialog">
            <div className="mongo-index-confirm-message">
              Delete index "{index.name}"?
            </div>
            <div className="mongo-index-confirm-buttons">
              <button onClick={handleDeleteConfirm} className="mongo-index-confirm-button mongo-index-confirm-button-delete">
                Delete
              </button>
              <button onClick={handleDeleteCancel} className="mongo-index-confirm-button mongo-index-confirm-button-cancel">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="mongo-index-card-header">
        <h4 className="mongo-index-card-title">{index.name}</h4>
        <div style={{ display: 'flex', gap: '2px' }}>
          {!isEditing ? (
            <>
              <button
                onClick={handleEditClick}
                disabled={isRebuilding}
                className="mongo-index-card-button"
                title="Edit index"
              >
                <EditIcon width={13} height={13} />
              </button>
              <button
                onClick={() => setShowRawJson(true)}
                disabled={isRebuilding}
                className="mongo-index-card-button"
                title="View raw JSON metadata"
              >
                JSON
              </button>
              <button
                onClick={handleDeleteClick}
                disabled={isRebuilding}
                className="mongo-index-card-button mongo-index-card-button-delete"
                title="Delete index"
              >
                <CrossIcon size={13} color="#d32f2f" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={isSaving || isRebuilding}
                className="mongo-index-card-button mongo-index-card-button-save"
              >
                {isSaving ? <SpinningCircle width={12} height={12} color="white" /> : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving || isRebuilding}
                className="mongo-index-card-button mongo-index-card-button-cancel"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
      
      <div className="mongo-index-card-field">
        <strong>ES Index:</strong> {displayIndex.esIndex}
      </div>
      
      <div className="mongo-index-card-section-title">
        MongoDB Collections Monitored:
      </div>
      
      {collections.length === 0 ? (
        <div className="mongo-index-card-empty">
          No collections configured
        </div>
      ) : (
        <KeyValuesComp
          data={collectionsData}
          onChangeAttempt={isEditing ? handleCollectionChange : undefined}
          isKeyEditable={isEditing}
          isValueEditable={isEditing}
          keyColWidth="min"
        />
      )}
      
      {isEditing && (
        <div className="mongo-index-add-collection" onClick={handleAddCollection}>
          <PlusIcon width={12} height={12} />
          <span>Add Collection</span>
        </div>
      )}
      
      {error && (
        <div className="mongo-index-card-error">
          {error}
        </div>
      )}

      {/* Dashboard - only shown when not editing */}
      {!isEditing && (
        <MongoIndexDashboard index={index} onRebuildingChange={setIsRebuilding} />
      )}

      {/* Search Panel - only shown when not editing */}
      {!isEditing && (
        <MongoIndexSearch indexName={index.name} />
      )}
      
      {showRawJson && (
        <div className="doc-editor-overlay" onClick={() => setShowRawJson(false)}>
          <div className="doc-editor-panel" onClick={(e) => e.stopPropagation()}>
            <div className="doc-editor-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ flex: 1 }}>
                  <div className="panel-title">MongoDB Index Metadata</div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    Index: {index.name}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className="doc-card-edit-button"
                    onClick={() => setShowJsonEditor(true)}
                    title="Edit in structured format"
                  >
                    Edit
                  </button>
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
              <pre className="doc-card-content">
                {JSON.stringify(index, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
      
      {showJsonEditor && (
        <div className="doc-editor-overlay" onClick={() => setShowJsonEditor(false)}>
          <div className="doc-editor-panel" onClick={(e) => e.stopPropagation()}>
            <div className="doc-editor-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ flex: 1 }}>
                  <div className="panel-title">Edit MongoDB Index Metadata</div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    Index: {index.name}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                    onClick={() => setShowJsonEditor(false)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
            <div className="doc-editor-content">
              <JsonComp 
                data={index} 
                isEditable={true}
                isKeyEditable={true}
                isValueEditable={true}
                onChange={handleDocChangeWithNotify}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MongoIndexCard;

