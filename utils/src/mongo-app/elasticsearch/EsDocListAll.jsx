import React, { useCallback, useEffect, useState } from 'react';
import { SpinningCircle, RefreshIcon } from '@wwf971/react-comp-misc';
import '../../elasticsearch/elasticsearch.css';

const EsDocListAll = ({
  indexName = '',
  backendUrl = '',
  pageSize = 20,
  title = '',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const loadDocuments = useCallback(async (targetPage = 1) => {
    if (!indexName || !backendUrl) {
      setDocs([]);
      setTotal(0);
      setCurrentPage(1);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const url = `${backendUrl}/elasticsearch/indices/${encodeURIComponent(indexName)}/docs/?page=${targetPage}&pageSize=${pageSize}`;
      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok || result.code !== 0) {
        throw new Error(result.message || `Failed to load documents from "${indexName}"`);
      }

      setDocs(Array.isArray(result.data?.documents) ? result.data.documents : []);
      setTotal(Number(result.data?.total || 0));
      setCurrentPage(Number(result.data?.page || targetPage));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setDocs([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl, indexName, pageSize]);

  useEffect(() => {
    loadDocuments(1);
  }, [loadDocuments]);

  if (!indexName) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const titleText = title || `Documents in "${indexName}"`;

  return (
    <div className="es-docs-section">
      <div className="section-header">
        <div className="section-title">{titleText}</div>
        <button
          className="es-refresh-button"
          onClick={() => loadDocuments(currentPage)}
          disabled={isLoading || !backendUrl}
          title="Refresh documents"
        >
          <RefreshIcon width={16} height={16} />
        </button>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
          <SpinningCircle width={14} height={14} color="#666" />
          <span>Loading documents...</span>
        </div>
      )}

      {!isLoading && error && (
        <div className="test-result error" style={{ marginTop: '8px' }}>
          <div className="result-message">{error}</div>
        </div>
      )}

      {!isLoading && !error && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div className="es-doc-index">
              {total === 0 ? 'No documents' : `Showing ${docs.length} of ${total}`}
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  className="es-pagination-button"
                  onClick={() => loadDocuments(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  Previous
                </button>
                <span className="es-doc-index">{currentPage}/{totalPages}</span>
                <button
                  className="es-pagination-button"
                  onClick={() => loadDocuments(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {docs.length > 0 && (
            <div className="es-docs-container">
              {docs.map((doc, index) => (
                <div key={doc._id || index} className="es-doc-card">
                  <div className="es-doc-header">
                    <span className="es-doc-index">#{(currentPage - 1) * pageSize + index + 1}</span>
                    <span className="es-doc-id">ID: {doc._id || 'N/A'}</span>
                  </div>
                  <pre className="es-doc-content">{JSON.stringify(doc, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EsDocListAll;

