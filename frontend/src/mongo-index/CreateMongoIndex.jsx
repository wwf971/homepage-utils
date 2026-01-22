import React, { useState, useEffect } from 'react';
import { KeyValuesComp, SearchableValueComp, SpinningCircle, PlusIcon } from '@wwf971/react-comp-misc';
import { getBackendServerUrl } from '../remote/dataStore';
import { searchDatabases, searchCollections } from '../mongo/mongoStore';
import '../mongo/mongo.css';
import './mongo-index.css';

/**
 * Adapter for SearchableValueComp to work with KeyValuesComp
 */
const SearchableAdapter = ({ data, onChangeAttempt, field, index, searchType, collections, validationStatus, onValidationChange }) => {
  const isDatabaseField = searchType === 'database';
  const currentRow = collections[index] || {};
  const isDatabaseValid = validationStatus[index]?.databaseValid || false;
  const isDisabled = !isDatabaseField && !isDatabaseValid;
  
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
        const dbValue = collections[index]?.database || '';
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
  
  const handleValidate = async (value) => {
    if (!value || value.trim() === '') {
      if (isDatabaseField && onValidationChange) {
        onValidationChange(index, 'database', false);
      }
      return { code: 0, isValid: false };
    }
    
    try {
      if (searchType === 'database') {
        // Validate by checking if database exists (exact match) using cache system
        const result = await searchDatabases(''); // Get all databases
        const isValid = result.code === 0 && Array.isArray(result.data) && result.data.includes(value);
        
        // Use setTimeout to ensure state update happens after parent state update
        setTimeout(() => {
          if (onValidationChange) {
            onValidationChange(index, 'database', isValid);
          }
        }, 0);
        
        return { code: 0, isValid };
      } else if (searchType === 'collection') {
        // Validate collection using cache system
        const dbValue = collections[index]?.database || '';
        if (!dbValue) {
          return { code: 0, isValid: false };
        }
        const result = await searchCollections(dbValue, ''); // Get all collections
        const isValid = result.code === 0 && Array.isArray(result.data) && result.data.includes(value);
        
        // Use setTimeout to ensure state update happens after parent state update
        setTimeout(() => {
          if (onValidationChange) {
            onValidationChange(index, 'collection', isValid);
          }
        }, 0);
        
        return { code: 0, isValid };
      }
    } catch (error) {
      console.error('Validation failed:', error);
      if (isDatabaseField && onValidationChange) {
        setTimeout(() => {
          onValidationChange(index, 'database', false);
        }, 0);
      }
      return { code: 0, isValid: false };
    }
    
    return { code: 0, isValid: false };
  };
  
  const handleUpdate = async (configKey, newValue) => {
    if (onChangeAttempt) {
      onChangeAttempt(index, field, newValue);
    }
    
    // After updating, trigger validation to update status
    await handleValidate(newValue);
    
    return { code: 0, message: 'Updated successfully' };
  };
  
  // Render status message
  let statusMsg = null;
  if (isDatabaseField) {
    const dbValue = currentRow.database;
    if (!dbValue || dbValue.trim() === '') {
      statusMsg = <span className="mongo-index-validation-message mongo-index-validation-invalid">Database required</span>;
    } else if (isDatabaseValid) {
      statusMsg = <span className="mongo-index-validation-message mongo-index-validation-valid">✓ Valid</span>;
    } else {
      statusMsg = <span className="mongo-index-validation-message mongo-index-validation-invalid">⚠ Invalid</span>;
    }
  } else {
    // Collection field
    if (!isDatabaseValid) {
      statusMsg = <span className="mongo-index-validation-message mongo-index-validation-disabled">Select valid database first</span>;
    } else {
      const collValue = currentRow.collection;
      if (collValue && collValue.trim() !== '') {
        if (validationStatus[index]?.collectionValid) {
          statusMsg = <span className="mongo-index-validation-message mongo-index-validation-valid">✓ Valid</span>;
        } else {
          statusMsg = <span className="mongo-index-validation-message mongo-index-validation-invalid">⚠ Invalid</span>;
        }
      }
    }
  }
  
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <SearchableValueComp
        data={data}
        configKey={`${field}_${index}`}
        onUpdate={handleUpdate}
        onSearch={handleSearch}
        onValidate={handleValidate}
        searchDebounce={300}
        strictValidation={false}
        disabled={isDisabled}
      />
      {statusMsg}
    </div>
  );
};

/**
 * CreateMongoIndex - Form for creating a new MongoDB-ES index
 */
const CreateMongoIndex = ({ onCreated, onCancel }) => {
  const [name, setName] = useState('');
  const [esIndex, setEsIndex] = useState('');
  const [collections, setCollections] = useState([{ database: '', collection: '' }]);
  const [validationStatus, setValidationStatus] = useState({});
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);
  
  const handleCollectionChange = (idx, field, newValue) => {
    setCollections(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        [field]: newValue
      };
      return updated;
    });
    
    // If database changed, reset collection validation
    if (field === 'database') {
      setValidationStatus(prev => ({
        ...prev,
        [idx]: {
          ...prev[idx],
          databaseValid: false,
          collectionValid: false
        }
      }));
    }
  };
  
  const handleValidationChange = (idx, field, isValid) => {
    setValidationStatus(prev => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        [`${field}Valid`]: isValid
      }
    }));
  };
  
  const handleAddCollection = () => {
    const newIdx = collections.length;
    setCollections(prev => [...prev, { database: '', collection: '' }]);
    setValidationStatus(prev => ({
      ...prev,
      [newIdx]: {
        databaseValid: false,
        collectionValid: false
      }
    }));
  };
  
  const handleCreate = async () => {
    if (!name || !name.trim()) {
      setError('Name is required');
      return;
    }
    
    if (!esIndex || !esIndex.trim()) {
      setError('ES Index name is required');
      return;
    }
    
    setIsCreating(true);
    setError(null);
    
    try {
      const backendUrl = getBackendServerUrl();
      const response = await fetch(`${backendUrl}/mongo-index/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name.trim(),
          esIndex: esIndex.trim(),
          collections: collections.filter(c => c.database && c.collection)
        })
      });
      
      const result = await response.json();
      
      if (result.code === 0) {
        if (onCreated) {
          onCreated(result.data);
        }
        // Reset form
        setName('');
        setEsIndex('');
        setCollections([{ database: '', collection: '' }]);
      } else {
        setError(result.message || 'Failed to create index');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };
  
  return (
    <div className="mongo-index-create-form">
      <h4>Create New Index</h4>
      
      <div className="mongo-index-form-group">
        <label className="mongo-index-form-label">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-mongo-index"
          className="mongo-index-form-input"
        />
      </div>
      
      <div className="mongo-index-form-group">
        <label className="mongo-index-form-label">Elasticsearch Index Name *</label>
        <input
          type="text"
          value={esIndex}
          onChange={(e) => setEsIndex(e.target.value)}
          placeholder="es_index_name"
          className="mongo-index-form-input"
        />
      </div>
      
      <div className="mongo-index-form-group">
        <label className="mongo-index-form-label">Collections to Monitor</label>
        <div className="mongo-index-form-hint">
          Type to search databases and collections
        </div>
        
        <div className="mongo-index-collections-list">
          {collections.map((coll, idx) => {
            return (
              <div key={idx} className="mongo-index-collection-row">
                <div className="mongo-index-collection-field">
                  <label className="mongo-index-field-label">Database:</label>
                  <SearchableAdapter
                    data={coll.database}
                    onChangeAttempt={handleCollectionChange}
                    field="database"
                    index={idx}
                    searchType="database"
                    collections={collections}
                    validationStatus={validationStatus}
                    onValidationChange={handleValidationChange}
                  />
                </div>
                <div className="mongo-index-collection-field">
                  <label className="mongo-index-field-label">Collection:</label>
                  <SearchableAdapter
                    data={coll.collection}
                    onChangeAttempt={handleCollectionChange}
                    field="collection"
                    index={idx}
                    searchType="collection"
                    collections={collections}
                    validationStatus={validationStatus}
                    onValidationChange={handleValidationChange}
                  />
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mongo-index-add-collection" onClick={handleAddCollection}>
          <PlusIcon width={12} height={12} />
          <span>Add Collection</span>
        </div>
      </div>
      
      {error && (
        <div className="mongo-index-form-error">
          {error}
        </div>
      )}
      
      <div className="mongo-index-form-buttons">
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="mongo-index-btn-create"
        >
          {isCreating && <SpinningCircle width={14} height={14} color="white" />}
          {isCreating ? 'Creating...' : 'Create Index'}
        </button>
        
        {onCancel && (
          <button
            onClick={onCancel}
            disabled={isCreating}
            className="mongo-index-btn-cancel"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default CreateMongoIndex;

