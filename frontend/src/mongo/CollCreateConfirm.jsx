import React, { useState, useRef } from 'react';
import { SpinningCircle } from '@wwf971/react-comp-misc';
import { createMongoCollection } from './mongoStore';
import MongoIndexCreate from '../mongo-index/MongoIndexCreate';
import './mongo.css';
import './coll.css';

/**
 * CollCreateConfirm - Confirmation popup for creating a MongoDB collection
 * 
 * @param {string} dbName - Database name
 * @param {function} onConfirm - Callback when creation is confirmed
 * @param {function} onCancel - Callback when creation is cancelled
 */
const CollCreateConfirm = ({ dbName, onConfirm, onCancel }) => {
  const [collName, setCollName] = useState('');
  const [createMode, setCreateMode] = useState('mongo'); // 'mongo' or 'mongo-index'
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const mongoIndexCreateRef = useRef(null);
  
  const handleCollNameChange = (e) => {
    const newName = e.target.value;
    setCollName(newName);
    
    // Update the collection name in the embedded MongoIndexCreate if it exists
    if (createMode === 'mongo-index' && mongoIndexCreateRef.current) {
      mongoIndexCreateRef.current.updateCollection(0, 'collection', newName.trim());
    }
  };

  const handleConfirm = async () => {
    if (!collName || !collName.trim()) {
      setCreateError('Collection name is required');
      return;
    }

    setCreating(true);
    setCreateError(null);
    setCreateSuccess(false);
    setSuccessMessage('');

    try {
      if (createMode === 'mongo') {
        // Use raw MongoDB API
        const result = await createMongoCollection(dbName, collName.trim());

        if (result.code === 0) {
          setCreateSuccess(true);
          setSuccessMessage('Collection created successfully');
          onConfirm(result);
        } else {
          setCreateError(result.message || 'Failed to create collection');
        }
      } else {
        // Use mongo-index API: create collection first, then create index
        // Step 1: Create the collection using raw MongoDB API
        const collResult = await createMongoCollection(dbName, collName.trim());
        
        if (collResult.code !== 0) {
          setCreateError(collResult.message || 'Failed to create collection');
          setCreating(false);
          return;
        }

        // Step 2: Validate the index form
        if (!mongoIndexCreateRef.current) {
          setCreateError('Index form not ready');
          setCreating(false);
          return;
        }

        const validation = mongoIndexCreateRef.current.validate();
        if (!validation.valid) {
          setCreateError(validation.message || 'Index form validation failed');
          setCreating(false);
          return;
        }

        // Step 3: Create the index
        const indexResult = await mongoIndexCreateRef.current.createIndex();
        
        if (indexResult.code === 0) {
          setCreateSuccess(true);
          setSuccessMessage('Collection and index created successfully');
          onConfirm({
            code: 0,
            message: 'Collection and index created successfully',
            data: {
              collection: collResult.data,
              index: indexResult.data
            }
          });
        } else {
          setCreateError(`Collection created but index failed: ${indexResult.message}`);
        }
      }
    } catch (error) {
      setCreateError(error.message || 'Network error');
    }

    setCreating(false);
  };

  return (
    <div className="mongo-popup-overlay" onClick={onCancel}>
      <div className="mongo-popup coll-create-popup" onClick={(e) => e.stopPropagation()}>
        <div className="coll-create-title">create collection in {dbName}</div>

        <div className="coll-create-content">
          <div className="coll-create-name-section">
            <label className="coll-create-name-label">Collection Name:</label>
            <input
              type="text"
              value={collName}
              onChange={handleCollNameChange}
              placeholder="my_collection"
              className="coll-create-name-input"
              disabled={creating}
            />
          </div>

          <div className="coll-create-mode-section">
            <label className="coll-create-mode-label">
              Creation Mode:
            </label>
            <div className="coll-create-radio-group">
              <label className="coll-create-radio-item">
                <input
                  type="radio"
                  name="createMode"
                  value="mongo"
                  checked={createMode === 'mongo'}
                  onChange={(e) => setCreateMode(e.target.value)}
                  disabled={creating}
                />
                <span>MongoDB API</span>
                <span className="coll-create-radio-desc">Create collection only</span>
              </label>
              <label className="coll-create-radio-item">
                <input
                  type="radio"
                  name="createMode"
                  value="mongo-index"
                  checked={createMode === 'mongo-index'}
                  onChange={(e) => setCreateMode(e.target.value)}
                  disabled={creating}
                />
                <span>Mongo-Index API</span>
                <span className="coll-create-radio-desc">Create collection and ES index</span>
              </label>
            </div>
          </div>

          {createMode === 'mongo-index' && (
            <div className="coll-create-index-section">
              <MongoIndexCreate
                ref={mongoIndexCreateRef}
                embedded={true}
                initialData={{
                  name: '',
                  esIndex: '',
                  collections: [{ database: dbName, collection: collName.trim() || '' }]
                }}
              />
            </div>
          )}

          {createError && (
            <div className="coll-create-error">{createError}</div>
          )}
          
          {createSuccess && (
            <div className="coll-create-success">{successMessage}</div>
          )}
        </div>

        <div className="coll-create-buttons">
          <button
            onClick={handleConfirm}
            disabled={creating || !collName.trim() || createSuccess}
            className="coll-create-btn-confirm"
          >
            {creating && <SpinningCircle width={14} height={14} color="white" />}
            {creating ? 'Creating...' : 'Create'}
          </button>
          <button
            onClick={onCancel}
            disabled={creating}
            className="coll-create-btn-cancel"
          >
            {createSuccess ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollCreateConfirm;
