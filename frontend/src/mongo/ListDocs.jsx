import React, { useState, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { SpinningCircle, RefreshIcon, PlusIcon } from '@wwf971/react-comp-misc';
import { 
  mongoSelectedDatabaseAtom,
  mongoSelectedCollectionAtom,
  mongoDocsAtom,
  mongoDocsPageAtom,
  mongoDocsTotalAtom,
  mongoDocsPageSizeAtom,
  fetchMongoDocuments,
  createMongoDocument
} from '../remote/dataStore';
import DocList from './DocList';
import './mongo.css';

/**
 * ListDocs - Component for listing documents in a selected MongoDB collection with pagination
 * 
 * @param {boolean} shouldLoad - Whether to load documents (controlled by parent)
 */
const ListDocs = ({ shouldLoad = true }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  
  const selectedDatabase = useAtomValue(mongoSelectedDatabaseAtom);
  const selectedCollection = useAtomValue(mongoSelectedCollectionAtom);
  const docs = useAtomValue(mongoDocsAtom);
  const page = useAtomValue(mongoDocsPageAtom);
  const total = useAtomValue(mongoDocsTotalAtom);
  const pageSize = useAtomValue(mongoDocsPageSizeAtom);
  
  const setDocs = useSetAtom(mongoDocsAtom);
  const setPage = useSetAtom(mongoDocsPageAtom);
  const setTotal = useSetAtom(mongoDocsTotalAtom);

  useEffect(() => {
    if (selectedDatabase && selectedCollection && shouldLoad) {
      setDocs([]);
      setPage(1);
      loadDocuments(1);
    } else {
      setDocs([]);
      setTotal(0);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatabase, selectedCollection, shouldLoad]);

  const loadDocuments = async (targetPage) => {
    if (!selectedDatabase || !selectedCollection) return;

    setLoading(true);
    setError(null);

    const result = await fetchMongoDocuments(selectedDatabase, selectedCollection, targetPage, pageSize);
    
    if (result.code === 0) {
      setDocs(result.data);
      setTotal(result.total);
      setPage(result.page);
    } else {
      setError(result.message);
    }
    
    setLoading(false);
  };

  const handleRefresh = () => {
    if (selectedDatabase && selectedCollection && shouldLoad) {
      setDocs([]);
      loadDocuments(page);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= Math.ceil(total / pageSize)) {
      setDocs([]);
      loadDocuments(newPage);
    }
  };

  const handleCreateDocument = async () => {
    if (!selectedDatabase || !selectedCollection) return;

    setCreating(true);
    setError(null);

    const result = await createMongoDocument(selectedDatabase, selectedCollection);
    
    if (result.code === 0) {
      // Insert the new document at the beginning of the current docs array
      const newDoc = result.data;
      
      // If we're on page 1, insert at the beginning
      if (page === 1) {
        setDocs([newDoc, ...docs]);
        setTotal(total + 1);
      } else {
        // If not on page 1, go to page 1 to see the new document
        setPage(1);
        loadDocuments(1);
      }
    } else {
      setError(result.message);
    }
    
    setCreating(false);
  };

  const handleDeleteDocument = (docId) => {
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
  };

  if (!selectedCollection) {
    return null;
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="mongo-all-docs-section" style={{ marginTop: '8px' }}>
      <div className="mongo-section-header">
        <h3>Documents in "{selectedCollection}"</h3>
        <div className="mongo-section-buttons">
          <button
            className="mongo-refresh-button"
            onClick={handleRefresh}
            disabled={loading || creating}
            title="Refresh documents"
          >
            <RefreshIcon width={16} height={16} />
          </button>
          <button
            className="mongo-refresh-button"
            onClick={handleCreateDocument}
            disabled={loading || creating}
            title="Create new empty document"
          >
            {creating ? <SpinningCircle width={16} height={16} /> : <PlusIcon width={16} height={16} />}
          </button>
        </div>
      </div>
      
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
          <SpinningCircle width={16} height={16} color="#666" />
          <span>Loading documents...</span>
        </div>
      )}

      {error && (
        <div className="test-result error" style={{ marginTop: '6px' }}>
          <strong>✗ Error</strong>
          <div className="result-message">{error}</div>
        </div>
      )}

      {Array.isArray(docs) && !loading && (
        <div style={{ marginTop: '6px' }}>
          <DocList
            docs={docs}
            paginated={true}
            page={page}
            total={total}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onDelete={handleDeleteDocument}
            emptyMessage="No documents in this collection"
          />
        </div>
      )}
    </div>
  );
};

export default ListDocs;

