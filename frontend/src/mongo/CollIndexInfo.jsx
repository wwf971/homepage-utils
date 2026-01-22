import React, { useState, useEffect } from 'react';
import { SpinningCircle } from '@wwf971/react-comp-misc';
import { getIndicesOfCollection } from '../mongo-index/mongoIndexStore';
import './mongo.css';
import './coll.css';

/**
 * CollIndexInfo - Display indices monitoring a specific collection
 * 
 * @param {string} dbName - Database name
 * @param {string} collName - Collection name
 * @param {function} onClose - Callback when popup is closed
 */
const CollIndexInfo = ({ dbName, collName, onClose }) => {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadIndices();
  }, [dbName, collName]);

  const loadIndices = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getIndicesOfCollection(dbName, collName);

      if (result.code === 0) {
        setIndices(result.data || []);
      } else {
        setError(result.message || 'Failed to load indices');
      }
    } catch (err) {
      setError(err.message || 'Network error');
    }

    setLoading(false);
  };

  return (
    <div className="mongo-popup-overlay" onClick={onClose}>
      <div className="mongo-popup coll-index-info-popup" onClick={(e) => e.stopPropagation()}>
        <div className="coll-index-info-title">
          indices monitoring {dbName}/{collName}
        </div>

        <div className="coll-index-info-content">
          {loading && (
            <div className="coll-index-info-loading">
              <SpinningCircle width={16} height={16} color="#666" />
              <span className="coll-index-info-loading-text">Loading indices...</span>
            </div>
          )}

          {error && (
            <div className="coll-index-info-error">{error}</div>
          )}

          {!loading && !error && indices.length === 0 && (
            <div className="coll-index-info-no-indices">
              No indices are monitoring this collection.
            </div>
          )}

          {!loading && !error && indices.length > 0 && (
            <div className="coll-index-info-list">
              <div className="coll-index-info-desc">
                {indices.length} {indices.length === 1 ? 'index is' : 'indices are'} monitoring this collection:
              </div>
              <ul className="coll-index-info-ul">
                {indices.map((indexName, idx) => (
                  <li key={idx}>{indexName}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="coll-index-info-buttons">
          <button
            onClick={onClose}
            className="coll-index-info-btn-close"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollIndexInfo;
