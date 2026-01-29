import React, { useState, useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom, useStore } from 'jotai';
import { SpinningCircle, JsonRaw, RefreshIcon, DeleteIcon } from '@wwf971/react-comp-misc';
import { esSelectedIndexAtom } from '../remote/dataStore';
import { 
  fetchEsIndexInfo,
  deleteElasticsearchIndex,
  renameEsIndex,
  getIndexAtom
} from './EsStore';
import ConfirmDialog from '../components/ConfirmDialog';
import './elasticsearch.css';

/**
 * IndexInfo - Component for displaying information about a selected Elasticsearch index
 */
const IndexInfo = () => {
  const selectedIndexName = useAtomValue(esSelectedIndexAtom);
  const setSelectedIndexName = useSetAtom(esSelectedIndexAtom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [indexInfo, setIndexInfo] = useState(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [operationInProgress, setOperationInProgress] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const editableRef = useRef(null);
  
  // Get the store to access getter/setter functions
  const store = useStore();
  const getAtomValue = (atom) => store.get(atom);
  const setAtomValue = (atom, value) => store.set(atom, value);
  
  // Check if this is a mongo-es-index
  const indexAtom = selectedIndexName ? getIndexAtom(selectedIndexName) : null;
  const indexData = indexAtom ? useAtomValue(indexAtom) : null;
  const isMongoIndex = indexData?.isMongoIndex || false;
  const mongoIndexName = indexData?.mongoData?.name;

  useEffect(() => {
    if (selectedIndexName) {
      loadIndexInfo();
    } else {
      setIndexInfo(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndexName]);

  const loadIndexInfo = async (forceRefresh = false) => {
    if (!selectedIndexName) return;

    setLoading(true);
    setError(null);
    setIndexInfo(null);

    const result = await fetchEsIndexInfo(selectedIndexName, forceRefresh);
    
    if (result.code === 0) {
      setIndexInfo(result.data);
    } else {
      setError(result.message);
    }
    
    setLoading(false);
  };

  const handleRefresh = () => {
    loadIndexInfo(true);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedIndexName) return;
    
    setShowDeleteConfirm(false);
    setOperationInProgress(true);
    setError(null);

    const result = await deleteElasticsearchIndex(selectedIndexName, setAtomValue, getAtomValue);
    
    if (result.code === 0) {
      // Cache invalidation is already handled inside deleteElasticsearchIndex
      // Clear selection and trigger indices refresh
      setSelectedIndexName(null);
      // Trigger refresh event
      window.dispatchEvent(new CustomEvent('elasticsearch-indices-changed'));
    } else {
      setError(result.message);
    }
    
    setOperationInProgress(false);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const handleRenameStart = () => {
    setIsRenaming(true);
    // Focus the editable element after render
    setTimeout(() => {
      if (editableRef.current) {
        editableRef.current.focus();
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(editableRef.current);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }, 0);
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    if (editableRef.current) {
      editableRef.current.textContent = selectedIndexName;
    }
  };

  const handleRenameSubmit = async () => {
    if (!editableRef.current) return;
    
    const newIndexName = editableRef.current.textContent.trim();
    
    if (!selectedIndexName || !newIndexName || newIndexName === selectedIndexName) {
      setIsRenaming(false);
      return;
    }

    setOperationInProgress(true);
    setError(null);

    const result = await renameEsIndex(selectedIndexName, newIndexName, setAtomValue, getAtomValue);
    
    if (result.code === 0) {
      // Cache invalidation is already handled inside renameEsIndex
      // Update selection to new name
      setSelectedIndexName(newIndexName);
      // Trigger refresh event
      window.dispatchEvent(new CustomEvent('elasticsearch-indices-changed'));
      setIsRenaming(false);
    } else {
      setError(result.message);
      // Revert the text
      if (editableRef.current) {
        editableRef.current.textContent = selectedIndexName;
      }
      setIsRenaming(false);
    }
    
    setOperationInProgress(false);
  };

  if (!selectedIndexName) {
    return (
      <div className="es-index-info">
        <p style={{ color: '#666', fontStyle: 'italic' }}>
          Select an index from the list above to view its information.
        </p>
      </div>
    );
  }

  return (
    <div className="es-index-info">
      <div className="es-index-info-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <h4 style={{ margin: 0 }}>Index:</h4>
          <span
            ref={editableRef}
            contentEditable={isRenaming}
            suppressContentEditableWarning
            onKeyDown={handleRenameKeyDown}
            onBlur={isRenaming ? handleRenameSubmit : undefined}
            className={`es-index-name ${isRenaming ? 'editing' : ''}`}
          >
            {selectedIndexName}
          </span>
          {isMongoIndex && (
            <span style={{
              display: 'inline-block',
              padding: '2px 6px',
              fontSize: '11px',
              fontWeight: '600',
              backgroundColor: '#e3f2fd',
              color: '#1976d2',
              border: '1px solid #90caf9',
              borderRadius: '2px',
              marginLeft: '4px'
            }} title={mongoIndexName ? `Mongo-Index: ${mongoIndexName}` : 'Mongo-ES Index'}>
              MONGO-INDEX
            </span>
          )}
          {!isRenaming && (
            <button
              onClick={handleRenameStart}
              disabled={loading || operationInProgress || !indexInfo}
              className="es-text-button-small"
              title="Rename"
            >
              Rename
            </button>
          )}
          {isRenaming && (
            <button
              onClick={handleRenameCancel}
              disabled={operationInProgress}
              className="es-text-button-small"
            >
              Cancel
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {indexInfo && (
            <>
              <button
                onClick={handleRefresh}
                disabled={loading || operationInProgress}
                className="es-icon-button"
                title="Refresh"
              >
                <RefreshIcon width={16} height={16} />
              </button>
              <button
                onClick={handleDeleteClick}
                disabled={loading || operationInProgress}
                className="es-icon-button es-delete-button"
                title="Delete"
              >
                <DeleteIcon width={16} height={16} />
              </button>
              <button
                onClick={() => setShowRawJson(true)}
                className="es-view-raw-button"
              >
                View Raw JSON
              </button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SpinningCircle width={16} height={16} color="#666" />
          <span>Loading index information...</span>
        </div>
      )}

      {isMongoIndex && (
        <div style={{
          padding: '6px 8px',
          marginBottom: '6px',
          backgroundColor: '#e3f2fd',
          border: '1px solid #90caf9',
          borderRadius: '2px',
          fontSize: '13px',
          color: '#1565c0'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '4px' }}>Mongo-ES Index</div>
          <div>This Elasticsearch index is managed by the mongo-index system. It automatically indexes MongoDB collections for search.</div>
          {mongoIndexName && (
            <div style={{ marginTop: '4px', fontSize: '12px' }}>
              Mongo-Index Name: <strong>{mongoIndexName}</strong>
            </div>
          )}
          {indexData?.mongoData?.collections && indexData.mongoData.collections.length > 0 && (
            <div style={{ marginTop: '4px', fontSize: '12px' }}>
              Monitors {indexData.mongoData.collections.length} MongoDB collection(s)
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="test-result error">
          <strong>✗ Error</strong>
          <div className="result-message">{error}</div>
        </div>
      )}

      {indexInfo && !loading && (
        <div>
          <p style={{ marginBottom: '12px' }}>
            Index information loaded successfully. Click "View Raw JSON" to see the full details.
          </p>
          
          {/* Display basic info if available */}
          {Object.keys(indexInfo).length > 0 && (
            <div style={{ fontSize: '13px', color: '#666' }}>
              <p>Contains {Object.keys(indexInfo).length} top-level {Object.keys(indexInfo).length === 1 ? 'field' : 'fields'}</p>
            </div>
          )}
        </div>
      )}

      {showRawJson && indexInfo && (
        <JsonRaw
          data={indexInfo}
          onClose={() => setShowRawJson(false)}
          title={`Index Info: ${selectedIndexName}`}
        />
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        message={`Are you sure you want to delete index "${selectedIndexName}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
};

export default IndexInfo;

