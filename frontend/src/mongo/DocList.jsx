import React from 'react';
import DocCard from './DocCard';
import './mongo.css';

/**
 * DocList - Component for displaying documents in either paginated or unpaginated mode
 * 
 * @param {Array} docs - Array of documents to display
 * @param {boolean} paginated - Whether to show pagination controls
 * @param {number} page - Current page number (for paginated mode)
 * @param {number} total - Total number of documents (for paginated mode)
 * @param {number} pageSize - Number of documents per page (for paginated mode)
 * @param {Function} onPageChange - Callback when page changes (for paginated mode)
 * @param {Function} onDelete - Callback when document is deleted
 * @param {string} emptyMessage - Message to show when no documents
 */
const DocList = ({ 
  docs = [], 
  paginated = false,
  page = 1,
  total = 0,
  pageSize = 20,
  onPageChange,
  onDelete,
  emptyMessage = 'No documents found'
}) => {
  const totalPages = Math.ceil(total / pageSize);

  if (docs.length === 0) {
    return <p style={{ color: '#666', fontStyle: 'italic' }}>{emptyMessage}</p>;
  }

  return (
    <div>
      {paginated && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4>
            Showing {docs.length} of {total} document{total !== 1 ? 's' : ''}
          </h4>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button
                onClick={() => onPageChange && onPageChange(page - 1)}
                disabled={page <= 1}
                style={{
                  padding: '4px 8px',
                  fontSize: '14px',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1
                }}
              >
                Previous
              </button>
              <span style={{ fontSize: '14px' }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => onPageChange && onPageChange(page + 1)}
                disabled={page >= totalPages}
                style={{
                  padding: '4px 8px',
                  fontSize: '14px',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: page >= totalPages ? 0.5 : 1
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {!paginated && docs.length > 0 && (
        <h4 style={{ marginBottom: '8px' }}>
          Found {docs.length} document{docs.length !== 1 ? 's' : ''}
        </h4>
      )}

      <div className="docs-container">
        {docs.map((doc, index) => (
          <DocCard 
            key={doc._id || index} 
            doc={doc} 
            index={paginated ? (page - 1) * pageSize + index : index}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
};

export default DocList;

