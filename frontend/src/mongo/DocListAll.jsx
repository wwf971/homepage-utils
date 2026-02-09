import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useAtomValue } from 'jotai';
import { SpinningCircle, RefreshIcon, PlusIcon } from '@wwf971/react-comp-misc';
import { createMongoDoc, mongoDbSelectedAtom, mongoCollSelectedAtom } from '../remote/dataStore';
import mongoDocStore from './mongoDocStore';
import DocList from './DocList';
import './mongo.css';

/**
 * DocListAll - Component for listing documents in a selected MongoDB collection with pagination
 * 
 * @param {boolean} shouldLoad - Whether to load documents (controlled by parent)
 */
const DocListAll = observer(({ shouldLoad = true }) => {
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Get selected database/collection from Jotai atoms (UI state)
  const dbSelected = useAtomValue(mongoDbSelectedAtom);
  const collSelected = useAtomValue(mongoCollSelectedAtom);
  
  // Get document data from MobX store (document state)
  const docs = mongoDocStore.docsArray;
  const page = mongoDocStore.currentPage;
  const total = mongoDocStore.totalDocs;
  const pageSize = mongoDocStore.pageSize;
  const isLoading = mongoDocStore.isLoading;

  useEffect(() => {
    if (dbSelected && collSelected && shouldLoad) {
      loadDocuments(1);
    } else {
      mongoDocStore.clearDocs();
      mongoDocStore.setCurrentPage(1);
      mongoDocStore.setTotalDocs(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbSelected, collSelected, shouldLoad]);

  const loadDocuments = async (targetPage) => {
    if (!dbSelected || !collSelected) return;

    setError(null);

    const result = await mongoDocStore.fetchDocs(dbSelected, collSelected, targetPage, pageSize);
    
    if (result.code !== 0) {
      setError(result.message);
    }
  };

  const handleRefresh = () => {
    if (dbSelected && collSelected && shouldLoad) {
      loadDocuments(page);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= Math.ceil(total / pageSize)) {
      loadDocuments(newPage);
    }
  };

  const handleDocCreate = async () => {
    if (!dbSelected || !collSelected) return;

    setIsCreating(true);
    setError(null);

    const result = await createMongoDoc(dbSelected, collSelected);
    
    if (result.code === 0) {
      // Insert the new document at the beginning
      const newDoc = result.data;
      mongoDocStore.setDoc(newDoc);
      
      // If we're on page 1, the new doc is already added to store
      if (page === 1) {
        mongoDocStore.setTotalDocs(total + 1);
      } else {
        // If not on page 1, go to page 1 to see the new document
        loadDocuments(1);
      }
    } else {
      setError(result.message);
    }
    
    setIsCreating(false);
  };

  const handleDocDelete = (docId) => {
    // Document is already removed from store by DocCard
    // Just handle pagination logic
    if (docs.length === 0 && page > 1) {
      const newPage = page - 1;
      loadDocuments(newPage);
    }
  };

  if (!collSelected) {
    return null;
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="mongo-all-docs-section" style={{ marginTop: '8px' }}>
      <div className="mongo-section-header">
        <div className="section-title">Documents in "{collSelected}"</div>
        <div className="mongo-section-buttons">
          <button
            className="mongo-refresh-button"
            onClick={handleRefresh}
            disabled={isLoading || isCreating}
            title="Refresh documents"
          >
            <RefreshIcon width={16} height={16} />
          </button>
          <button
            className="mongo-refresh-button"
            onClick={handleDocCreate}
            disabled={isLoading || isCreating}
            title="Create new empty document"
          >
            {isCreating ? <SpinningCircle width={16} height={16} /> : <PlusIcon width={16} height={16} />}
          </button>
        </div>
      </div>
      
      {isLoading && (
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

      {Array.isArray(docs) && !isLoading && (
        <div style={{ marginTop: '6px' }}>
          <DocList
            docs={docs}
            paginated={true}
            page={page}
            total={total}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onDelete={handleDocDelete}
            emptyMessage="No documents in this collection"
          />
        </div>
      )}
    </div>
  );
});

DocListAll.displayName = 'DocListAll';

export default DocListAll;

