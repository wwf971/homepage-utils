import React, { useState, useEffect } from 'react';
import { SpinningCircle } from '@wwf971/react-comp-misc';
import { getBackendServerUrl } from '../remote/backendServerStore';
import { getIndicesOfCollection, deleteCollectionWithIndex } from '../mongo-index/mongoIndexStore';
import { deleteCollection } from './mongoStore';
import './mongo.css';
import './coll.css';

/**
 * CollDeleteConfirm - Confirmation popup for deleting a MongoDB collection
 * 
 * @param {string} dbName - Database name
 * @param {string} collName - Collection name to delete
 * @param {function} onConfirm - Callback when deletion is confirmed
 * @param {function} onCancel - Callback when deletion is cancelled
 */
const CollDeleteConfirm = ({ dbName, collName, onConfirm, onCancel }) => {
  const [deleteMode, setDeleteMode] = useState('mongo'); // 'mongo' or 'mongo-index'
  const [affectedIndices, setAffectedIndices] = useState([]);
  const [loadingIndices, setLoadingIndices] = useState(false);
  const [indicesError, setIndicesError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (deleteMode === 'mongo-index') {
      loadAffectedIndices();
    }
  }, [deleteMode, dbName, collName]);

  const loadAffectedIndices = async () => {
    setLoadingIndices(true);
    setIndicesError(null);

    try {
      const result = await getIndicesOfCollection(dbName, collName);

      if (result.code === 0) {
        setAffectedIndices(result.data || []);
      } else {
        setIndicesError(result.message || 'Failed to load affected indices');
      }
    } catch (error) {
      setIndicesError(error.message || 'Network error');
    }

    setLoadingIndices(false);
  };

  const handleConfirm = async () => {
    setDeleting(true);
    setDeleteError(null);
    setDeleteSuccess(false);
    setSuccessMessage('');

    try {
      let result;

      if (deleteMode === 'mongo') {
        // Use raw MongoDB API
        result = await deleteCollection(dbName, collName);
      } else {
        // Use mongo-index API (also removes from indices)
        result = await deleteCollectionWithIndex(dbName, collName);
      }

      if (result.code === 0) {
        setDeleteSuccess(true);
        setSuccessMessage('Collection deleted successfully');
        onConfirm(result);
      } else {
        setDeleteError(result.message || 'Failed to delete collection');
      }
    } catch (error) {
      setDeleteError(error.message || 'Network error');
    }

    setDeleting(false);
  };

  return (
    <div className="mongo-popup-overlay" onClick={onCancel}>
      <div className="mongo-popup coll-delete-popup" onClick={(e) => e.stopPropagation()}>
        <div className="coll-delete-title">delete collection {dbName}/{collName}</div>

        <div className="coll-delete-content">

          <div className="coll-delete-mode-section">
            <label className="coll-delete-mode-label">
              Deletion Mode:
            </label>
            <div className="coll-delete-radio-group">
              <label className="coll-delete-radio-item">
                <input
                  type="radio"
                  name="deleteMode"
                  value="mongo"
                  checked={deleteMode === 'mongo'}
                  onChange={(e) => setDeleteMode(e.target.value)}
                  disabled={deleting}
                />
                <span>MongoDB API (raw deletion)</span>
              </label>
              <label className="coll-delete-radio-item">
                <input
                  type="radio"
                  name="deleteMode"
                  value="mongo-index"
                  checked={deleteMode === 'mongo-index'}
                  onChange={(e) => setDeleteMode(e.target.value)}
                  disabled={deleting}
                />
                <span>Mongo-Index API (also remove from indices)</span>
              </label>
            </div>
          </div>

          {deleteMode === 'mongo-index' && (
            <div className="coll-delete-indices-box">
              <div className="coll-delete-indices-title">
                Affected Indices:
              </div>
              {loadingIndices && (
                <div className="coll-delete-loading">
                  <SpinningCircle width={14} height={14} color="#666" />
                  <span className="coll-delete-loading-text">Loading...</span>
                </div>
              )}
              {indicesError && (
                <div className="coll-delete-error">
                  Error: {indicesError}
                </div>
              )}
              {!loadingIndices && !indicesError && (
                <>
                  {affectedIndices.length === 0 ? (
                    <div className="coll-delete-no-indices">
                      No indices monitoring this collection
                    </div>
                  ) : (
                    <div className="coll-delete-indices-list">
                      <div className="coll-delete-indices-desc">
                        This collection will be removed from {affectedIndices.length} index(es):
                      </div>
                      <ul className="coll-delete-indices-ul">
                        {affectedIndices.map((indexName, idx) => (
                          <li key={idx}>{indexName}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {deleteError && (
            <div className="coll-delete-error">{deleteError}</div>
          )}
          
          {deleteSuccess && (
            <div className="coll-delete-success">{successMessage}</div>
          )}

          {!deleteSuccess && (
            <div className="coll-delete-warning">
              <span className="coll-delete-warning-label">Warning:</span> This action cannot be undone. All documents in this collection will be permanently deleted.
            </div>
          )}
        </div>

        <div className="coll-delete-buttons">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="coll-delete-btn-cancel"
          >
            {deleteSuccess ? 'Close' : 'Cancel'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={deleting || deleteSuccess || (deleteMode === 'mongo-index' && loadingIndices)}
            className="coll-delete-btn-confirm"
          >
            {deleting && <SpinningCircle width={14} height={14} color="white" />}
            {deleting ? 'Deleting...' : 'Delete Collection'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollDeleteConfirm;
