import React, { useState } from 'react';
import { KeyValuesComp, SearchableValueComp, SpinningCircle, EditIcon, PlusIcon, CrossIcon } from '@wwf971/react-comp-misc';
import { getBackendServerUrl } from '../remote/dataStore';
import '../mongo/mongo.css';
import './mongo-index.css';

/**
 * Adapter for SearchableValueComp to work with KeyValuesComp
 */
const SearchableAdapter = ({ data, onChangeAttempt, field, index, searchType }) => {
  const [searchResults, setSearchResults] = useState([]);
  
  const handleSearch = async (value) => {
    if (!value || value.trim() === '') {
      return { code: 0, data: [] };
    }
    
    try {
      const backendUrl = getBackendServerUrl();
      let url;
      
      if (searchType === 'database') {
        url = `${backendUrl}/mongo/index/search/databases?query=${encodeURIComponent(value)}`;
      } else if (searchType === 'collection') {
        // Get the database from the same row
        const dbValue = data; // This is actually the database value when searching collections
        url = `${backendUrl}/mongo/index/search/collections?database=${encodeURIComponent(dbValue)}&query=${encodeURIComponent(value)}`;
      }
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.code === 0) {
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
      onChangeAttempt(index, field, newValue);
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
const MongoIndexCard = ({ index, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedIndex, setEditedIndex] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
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
      const backendUrl = getBackendServerUrl();
      const response = await fetch(`${backendUrl}/mongo/index/${encodeURIComponent(index.name)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          esIndex: editedIndex.esIndex,
          collections: editedIndex.collections.filter(c => c.database && c.collection)
        })
      });
      
      const result = await response.json();
      
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
      const backendUrl = getBackendServerUrl();
      const response = await fetch(`${backendUrl}/mongo/index/${encodeURIComponent(index.name)}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
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
      ? (props) => <SearchableAdapter {...props} searchType="database" />
      : undefined,
    valueComp: isEditing
      ? (props) => <SearchableAdapter {...props} searchType="collection" />
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
                className="mongo-index-card-button"
                title="Edit index"
              >
                <EditIcon width={13} height={13} />
              </button>
              <button
                onClick={handleDeleteClick}
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
                disabled={isSaving}
                className="mongo-index-card-button mongo-index-card-button-save"
              >
                {isSaving ? <SpinningCircle width={12} height={12} color="white" /> : 'Save'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
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
        Monitored Collections:
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
          keyColWidth="200px"
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
    </div>
  );
};

export default MongoIndexCard;

