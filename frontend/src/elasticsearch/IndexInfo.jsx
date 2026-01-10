import React, { useState, useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { SpinningCircle, JsonRaw, RefreshIcon, DeleteIcon } from '@wwf971/react-comp-misc';
import { esSelectedIndexAtom, esIndicesAtom } from '../remote/dataStore';
import { 
  fetchElasticsearchIndexInfo,
  deleteElasticsearchIndex,
  renameElasticsearchIndex,
  invalidateIndicesCache
} from './EsStore';
import ConfirmDialog from '../components/ConfirmDialog';
import './elasticsearch.css';

/**
 * IndexInfo - Component for displaying information about a selected Elasticsearch index
 */
const IndexInfo = () => {
  const selectedIndex = useAtomValue(esSelectedIndexAtom);
  const setSelectedIndex = useSetAtom(esSelectedIndexAtom);
  const setIndices = useSetAtom(esIndicesAtom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [indexInfo, setIndexInfo] = useState(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [operationInProgress, setOperationInProgress] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const editableRef = useRef(null);

  useEffect(() => {
    if (selectedIndex) {
      loadIndexInfo();
    } else {
      setIndexInfo(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  const loadIndexInfo = async (forceRefresh = false) => {
    if (!selectedIndex) return;

    setLoading(true);
    setError(null);
    setIndexInfo(null);

    const result = await fetchElasticsearchIndexInfo(selectedIndex, forceRefresh);
    
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
    if (!selectedIndex) return;
    
    setShowDeleteConfirm(false);
    setOperationInProgress(true);
    setError(null);

    const result = await deleteElasticsearchIndex(selectedIndex);
    
    if (result.code === 0) {
      // Clear selection and trigger indices refresh
      setSelectedIndex(null);
      invalidateIndicesCache();
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
      editableRef.current.textContent = selectedIndex;
    }
  };

  const handleRenameSubmit = async () => {
    if (!editableRef.current) return;
    
    const newIndexName = editableRef.current.textContent.trim();
    
    if (!selectedIndex || !newIndexName || newIndexName === selectedIndex) {
      setIsRenaming(false);
      return;
    }

    setOperationInProgress(true);
    setError(null);

    const result = await renameElasticsearchIndex(selectedIndex, newIndexName);
    
    if (result.code === 0) {
      // Update selection to new name
      setSelectedIndex(newIndexName);
      invalidateIndicesCache();
      // Trigger refresh event
      window.dispatchEvent(new CustomEvent('elasticsearch-indices-changed'));
      setIsRenaming(false);
    } else {
      setError(result.message);
      // Revert the text
      if (editableRef.current) {
        editableRef.current.textContent = selectedIndex;
      }
      setIsRenaming(false);
    }
    
    setOperationInProgress(false);
  };

  if (!selectedIndex) {
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
            {selectedIndex}
          </span>
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
          title={`Index Info: ${selectedIndex}`}
        />
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        message={`Are you sure you want to delete index "${selectedIndex}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
};

export default IndexInfo;

