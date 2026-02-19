import React, { useState, useEffect } from 'react';
import { useStore } from 'jotai';
import { SpinningCircle, RefreshIcon, PlusIcon, DeleteIcon, JsonComp } from '@wwf971/react-comp-misc';
import { 
  fetchEsDocs,
  deleteEsDoc,
  updateEsDoc,
  getDocListAtom,
  getDocAtom
} from './EsStore';
import {
  handlePseudoOperation,
  createArrayItem,
  createDictEntry,
  applyValueChange,
  prepareDocForBackend,
  isFieldBlocked
} from './EditUtils';
import ConfirmDialog from '../components/ConfirmDialog';
import EsDocCreate from './EsDocCreate';
import '@wwf971/homepage-utils-utils/elasticsearch.css';

/**
 * DocListAll - Component for listing documents in a selected Elasticsearch index with pagination
 * @param {string} indexName - ES index name to list documents from (required)
 */
const EsDocListAll = ({ indexName }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [shouldShowCreatePanel, setShouldShowCreatePanel] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, docId: null });
  const [editingDoc, setEditingDoc] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  
  const store = useStore();
  
  const getAtomValue = (atom) => store.get(atom);
  const setAtomValue = (atom, value) => store.set(atom, value);

  useEffect(() => {
    if (indexName) {
      setDocs([]);
      setPage(1);
      loadDocuments(1);
    } else {
      setDocs([]);
      setTotal(0);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexName]);

  const loadDocuments = async (targetPage) => {
    if (!indexName) return;

    setLoading(true);
    setError(null);

    const result = await fetchEsDocs(indexName, targetPage, pageSize, false, getAtomValue, setAtomValue);
    
    if (result.code === 0) {
      // Read from atoms
      const docListAtom = getDocListAtom(indexName);
      const docListData = getAtomValue(docListAtom);
      
      if (docListData) {
        const { docIds = [], total: docTotal = 0, page: docPage = 1 } = docListData;
        
        // Get actual documents from individual doc atoms
        const loadedDocs = docIds.map(docId => {
          const docAtom = getDocAtom(indexName, docId);
          return getAtomValue(docAtom);
        }).filter(doc => doc !== null && doc !== undefined);
        
        console.log('Loaded docs:', loadedDocs);
        if (loadedDocs.length > 0) {
          console.log('First doc sample:', loadedDocs[0]);
          console.log('First doc keys:', Object.keys(loadedDocs[0]));
        }
        
        setDocs(loadedDocs);
        setTotal(docTotal);
        setPage(docPage);
      } else {
        setDocs([]);
        setTotal(0);
        setPage(targetPage);
      }
    } else {
      setError(result.message);
    }
    
    setLoading(false);
  };

  const handleRefresh = () => {
    if (indexName) {
      setDocs([]);
      loadDocuments(page);
    }
  };

  const handlePageChange = (newPage) => {
    const totalPages = Math.ceil(total / pageSize);
    if (newPage >= 1 && newPage <= totalPages) {
      setDocs([]);
      loadDocuments(newPage);
    }
  };

  const handleDeleteClick = (docId) => {
    setDeleteConfirm({ show: true, docId });
  };

  const handleDeleteConfirm = async () => {
    const { docId } = deleteConfirm;
    setDeleteConfirm({ show: false, docId: null });
    
    if (!indexName || !docId) return;

    setError(null);

    const result = await deleteEsDoc(indexName, docId, getAtomValue, setAtomValue);
    
    if (result.code === 0) {
      // Remove the document from the current docs array
      const updatedDocs = docs.filter(doc => doc._id !== docId);
      setDocs(updatedDocs);
      setTotal(total - 1);
      
      // If we deleted the last document on a page that's not page 1, go to previous page
      if (updatedDocs.length === 0 && page > 1) {
        const newPage = page - 1;
        setPage(newPage);
        loadDocuments(newPage);
      }
    } else {
      setError(result.message);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ show: false, docId: null });
  };

  const handleCreateSuccess = (newDoc) => {
    // Insert the new document at the beginning of the current docs array
    // If we're on page 1, insert at the beginning
    if (page === 1) {
      setDocs([newDoc, ...docs]);
      setTotal(total + 1);
    } else {
      // If not on page 1, go to page 1 to see the new document
      setPage(1);
      loadDocuments(1);
    }
  };

  const handleEditClick = (doc) => {
    // Deep copy - keep _id for reference but it will be shown in JsonComp
    const docCopy = JSON.parse(JSON.stringify(doc));
    console.log('Opening edit panel for doc:', docCopy);
    console.log('Doc keys:', Object.keys(docCopy));
    console.log('Doc JSON:', JSON.stringify(docCopy, null, 2));
    setEditingDoc(docCopy);
    setUpdateError(null);
  };

  const handleEditClose = () => {
    setEditingDoc(null);
    setUpdateError(null);
  };

  const handleDocChange = async (path, changeData) => {
    console.log('=== handleDocChange CALLED ===', { path, changeData });
    
    if (!editingDoc || !editingDoc._id) {
      console.log('No editing doc or _id, returning');
      return;
    }

    const { _action, new: newValue, _key } = changeData;
    console.log('ES Doc change:', { path, _action, _key, newValue });

    // Check if field modification is blocked (e.g., _id field)
    if (isFieldBlocked(path, _key, _action)) {
      console.warn('Cannot modify _id field');
      return { code: -1, message: '_id field cannot be modified' };
    }

    // Handle pseudo operations (UI-only, no backend call)
    const pseudoResult = handlePseudoOperation(_action, path, editingDoc);
    if (pseudoResult.handled) {
      console.log('Pseudo action detected:', _action, 'for path:', path);
      setEditingDoc(pseudoResult.doc);
      return { code: 0 };
    }

    // Handle createItem (converting pseudo array item to real)
    if (_action === 'createItem') {
      console.log('Creating array item from pseudo:', { path, newValue });
      setIsUpdating(true);
      setUpdateError(null);

      const updatedDoc = createArrayItem(path, newValue, editingDoc);
      const docToSend = prepareDocForBackend(updatedDoc);
      
      const result = await updateEsDoc(indexName, editingDoc._id, docToSend, getAtomValue, setAtomValue);
      
      if (result.code === 0) {
        // Read updated doc from atom
        const docAtom = getDocAtom(indexName, editingDoc._id);
        const newDoc = getAtomValue(docAtom);
        
        setDocs(prevDocs => 
          prevDocs.map(d => d._id === editingDoc._id ? newDoc : d)
        );
        setEditingDoc(newDoc);
      } else {
        setUpdateError(result.message);
      }
      
      setIsUpdating(false);
      return result;
    }

    // Handle createEntry (converting pseudo to real)
    if (_action === 'createEntry') {
      console.log('Creating entry from pseudo:', { path, _key, newValue });
      setIsUpdating(true);
      setUpdateError(null);

      const updatedDoc = createDictEntry(path, newValue, _key, editingDoc);
      const docToSend = prepareDocForBackend(updatedDoc);
      
      const result = await updateEsDoc(indexName, editingDoc._id, docToSend, getAtomValue, setAtomValue);
      
      if (result.code === 0) {
        // Read updated doc from atom
        const docAtom = getDocAtom(indexName, editingDoc._id);
        const newDoc = getAtomValue(docAtom);
        
        setDocs(prevDocs => 
          prevDocs.map(d => d._id === editingDoc._id ? newDoc : d)
        );
        setEditingDoc(newDoc);
      } else {
        setUpdateError(result.message);
      }
      
      setIsUpdating(false);
      return result;
    }

    // For actual data changes, update backend
    setIsUpdating(true);
    setUpdateError(null);

    const updatedDoc = applyValueChange(_action, path, newValue, editingDoc);
    const docToSend = prepareDocForBackend(updatedDoc);
    
    const result = await updateEsDoc(indexName, editingDoc._id, docToSend, getAtomValue, setAtomValue);
    
    if (result.code === 0) {
      // Read updated doc from atom
      const docAtom = getDocAtom(indexName, editingDoc._id);
      const newDoc = getAtomValue(docAtom);
      
      setDocs(prevDocs => 
        prevDocs.map(d => d._id === editingDoc._id ? newDoc : d)
      );
      setEditingDoc(newDoc);
    } else {
      setUpdateError(result.message);
    }
    
    setIsUpdating(false);
    return result;
  };

  if (!indexName) {
    return null;
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="es-docs-section">
      <div className="section-header">
        <div className="section-title">Documents in "{indexName}"</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            className="es-refresh-button"
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh documents"
          >
            <RefreshIcon width={16} height={16} />
          </button>
          <button
            className="es-refresh-button"
            onClick={() => setShouldShowCreatePanel(true)}
            disabled={loading}
            title="Create new document"
          >
            <PlusIcon width={16} height={16} />
          </button>
        </div>
      </div>
      
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
          <SpinningCircle width={16} height={16} color="#666" />
          <span>Loading documents...</span>
        </div>
      )}

      {error && (
        <div className="test-result error" style={{ marginTop: '12px' }}>
          <strong>✗ Error</strong>
          <div className="result-message">{error}</div>
        </div>
      )}

      {!loading && Array.isArray(docs) && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0 }}>
              {total === 0 ? 'No documents' : `Showing ${docs.length} of ${total} document${total !== 1 ? 's' : ''}`}
            </h4>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="es-pagination-button"
                >
                  Previous
                </button>
                <span style={{ fontSize: '14px' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="es-pagination-button"
                >
                  Next
                </button>
              </div>
            )}
          </div>
          
          {docs.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No documents in this index. Click the + button to create a new document.</p>
          ) : (
            <div className="es-docs-container">
              {docs.map((doc, index) => (
                <div key={doc._id || index} className="es-doc-card">
                  <div className="es-doc-header">
                    <span className="es-doc-index">#{(page - 1) * pageSize + index + 1}</span>
                    <span className="es-doc-id">ID: {doc._id}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleEditClick(doc)}
                        className="doc-card-edit-button"
                        title="Edit document"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(doc._id)}
                        className="es-icon-button es-delete-button"
                        title="Delete document"
                      >
                        <DeleteIcon width={16} height={16} />
                      </button>
                    </div>
                  </div>
                  <pre className="es-doc-content">
                    {JSON.stringify(doc, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.show}
        message={`Are you sure you want to delete document "${deleteConfirm.docId}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        confirmText="Delete"
        type="danger"
      />

      {shouldShowCreatePanel && (
        <EsDocCreate
          indexName={indexName}
          onClose={() => setShouldShowCreatePanel(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {editingDoc && (
        <div className="doc-editor-overlay" onClick={handleEditClose}>
          <div className="doc-editor-panel" onClick={(e) => e.stopPropagation()}>
            <div className="doc-editor-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div className="panel-title">Edit Document: {editingDoc._id}</div>
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
                    onClick={handleEditClose}
                  >
                    ✕
                  </button>
                </div>
              </div>
              {updateError && (
                <div style={{ 
                  marginTop: '8px',
                  padding: '8px 12px', 
                  background: '#f8d7da', 
                  color: '#721c24', 
                  fontSize: '12px',
                  borderRadius: '2px'
                }}>
                  {updateError}
                </div>
              )}
            </div>
            <div className="doc-editor-content">
              {editingDoc && (
                <>
                  <div style={{ marginBottom: '8px', fontSize: '12px', color: '#666' }}>
                    Document has {Object.keys(editingDoc).length} field(s): {Object.keys(editingDoc).join(', ')}
                  </div>
                  <JsonComp 
                    data={editingDoc}
                    isEditable={true}
                    isKeyEditable={true}
                    isValueEditable={true}
                    isKeyDeletable={true}
                    onChange={handleDocChange}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EsDocListAll;

