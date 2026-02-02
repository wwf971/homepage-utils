import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { JsonComp } from '@wwf971/react-comp-misc';
import { 
  mongoSelectedDatabaseAtom,
  mongoSelectedCollectionAtom,
  useMongoDocEditor,
  deleteMongoDocument
} from '../remote/dataStore';
import './mongo.css';

/**
 * DocCard - Component for displaying a single MongoDB document
 * 
 * @param {Object} doc - The document to display
 * @param {number} index - The index of the document in the list
 * @param {Function} onDelete - Callback function when document is deleted
 */
const DocCard = ({ doc, index, onDelete }) => {
  const [showJsonView, setShowJsonView] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [copied, setCopied] = useState(false);
  
  const selectedDatabase = useAtomValue(mongoSelectedDatabaseAtom);
  const selectedCollection = useAtomValue(mongoSelectedCollectionAtom);
  
  // Use the custom hook for document editing
  const { handleChange, isUpdating } = useMongoDocEditor(
    selectedDatabase,
    selectedCollection,
    doc
  );

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    const result = await deleteMongoDocument(selectedDatabase, selectedCollection, doc._id);
    
    if (result.code === 0) {
      // Call the onDelete callback to remove from parent list
      if (onDelete) {
        onDelete(doc._id);
      }
    } else {
      setDeleteError(result.message);
    }
    
    setDeleting(false);
  };

  // Construct the MongoDB document fetch URL
  const constructdocUrl = () => {
    if (!selectedDatabase || !selectedCollection || !doc) return null;
    
    const baseUrl = `${window.location.origin}/mongo/db/${selectedDatabase}/coll/${selectedCollection}/docs/`;
    const params = new URLSearchParams();
    
    // Use 'id' field if available, otherwise use '_id'
    if (doc.id) {
      params.append('id', doc.id);
    } else if (doc._id) {
      params.append('_id', doc._id);
    }
    
    // Add path=. to fetch entire document
    params.append('path', '.');
    
    return `${baseUrl}?${params.toString()}`;
  };

  const handleCopyUrl = () => {
    const url = constructdocUrl();
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const docUrl = constructdocUrl();

  return (
    <>
      <div className="mongo-doc-card">
        <div className="mongo-doc-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="mongo-doc-card-index">#{index + 1}</span>
            {docUrl && (
              <div className="fetch-file-url-row">
                <span className="fetch-file-url" title={docUrl}>{docUrl}</span>
                <button 
                  className="fetch-file-copy-button" 
                  onClick={handleCopyUrl}
                  title="Copy URL"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="mongo-doc-card-edit-button"
              onClick={() => setShowJsonView(true)}
              disabled={deleting}
              title="View/Edit in structured format"
            >
              Edit
            </button>
            <button
              className="mongo-doc-card-delete-button"
              onClick={handleDelete}
              disabled={deleting}
              title="Delete this document"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
        {deleteError && (
          <div style={{ 
            padding: '8px 12px', 
            background: '#f8d7da', 
            color: '#721c24', 
            fontSize: '12px',
            borderBottom: '1px solid #ddd'
          }}>
            {deleteError}
          </div>
        )}
        <pre className="mongo-doc-card-content">
          {JSON.stringify(doc, null, 2)}
        </pre>
      </div>

      {showJsonView && (
        <div className="mongo-doc-editor-overlay" onClick={() => setShowJsonView(false)}>
          <div className="mongo-doc-editor-panel" onClick={(e) => e.stopPropagation()}>
            <div className="mongo-doc-editor-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ flex: 1 }}>
                  <div className="panel-title">Document #{index + 1}</div>
                  {docUrl && (
                    <div className="fetch-file-url-row" style={{ marginTop: '4px' }}>
                      <span className="fetch-file-url" title={docUrl}>{docUrl}</span>
                      <button 
                        className="fetch-file-copy-button" 
                        onClick={handleCopyUrl}
                        title="Copy URL"
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}
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
                    className="mongo-doc-editor-close-button"
                    onClick={() => setShowJsonView(false)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
            <div className="mongo-doc-editor-content">
              <JsonComp 
                data={doc} 
                isEditable={true}
                isKeyEditable={true}
                isValueEditable={true}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DocCard;

