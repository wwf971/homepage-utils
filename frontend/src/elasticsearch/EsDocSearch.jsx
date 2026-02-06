import React, { useState } from 'react';
import { SpinningCircle } from '@wwf971/react-comp-misc';
import { searchEsDocs } from './EsStore';
import EsDocSearchResult from './EsDocSearchResult';
import './elasticsearch.css';

/**
 * EsDocSearch - Component for searching documents using character-level index
 * @param {string} indexName - ES index name to search (required)
 */
const EsDocSearch = ({ indexName }) => {
  const pageSize = 20;
  const [query, setQuery] = useState('');
  const [searchInKeys, setSearchInKeys] = useState(false);
  const [searchInValues, setSearchInValues] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [mergeMatches, setMergeMatches] = useState(true);

  const handleSearch = async (page = 1) => {
    if (!indexName || !query.trim()) return;

    setSearching(true);
    setError(null);
    setHasSearched(true);
    if (page === 1) {
      setResults([]);
      setCurrentPage(1);
    }

    const result = await searchEsDocs(indexName, {
      query: query.trim(),
      search_in_paths: searchInKeys,
      search_in_values: searchInValues,
      page: page,
      page_size: pageSize
    });
    
    if (result.code === 0) {
      setResults(result.data.results || []);
      setTotalResults(result.data.total || 0);
      setTotalPages(result.data.total_pages || 0);
      setCurrentPage(page);
    } else {
      setError(result.message);
    }
    
    setSearching(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !searching) {
      handleSearch(1);
    }
  };

  if (!indexName) {
    return null;
  }

  return (
    <div className="es-search-section">

      <div style={{ marginBottom: '12px' }}>
        <div className="es-search-input-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter search query..."
            className="es-search-input"
            disabled={searching}
          />
          <button
            onClick={() => handleSearch(1)}
            disabled={searching || !query.trim()}
            className="es-button-primary"
          >
            {searching ? (
              <>
                <SpinningCircle width={14} height={14} color="white" />
                <span style={{ marginLeft: '6px' }}>Searching...</span>
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>

        <div className="es-search-options">
          <label className="es-checkbox-label">
            <input
              type="checkbox"
              checked={searchInKeys}
              onChange={(e) => setSearchInKeys(e.target.checked)}
              disabled={searching}
            />
            Search in field names (keys)
          </label>
          <label className="es-checkbox-label">
            <input
              type="checkbox"
              checked={searchInValues}
              onChange={(e) => setSearchInValues(e.target.checked)}
              disabled={searching}
            />
            Search in field values
          </label>
          <label className="es-checkbox-label">
            <input
              type="checkbox"
              checked={mergeMatches}
              onChange={(e) => setMergeMatches(e.target.checked)}
              disabled={searching}
            />
            Merge matches for same field
          </label>
        </div>
      </div>

      {error && (
        <div className="test-result error" style={{ marginTop: '12px' }}>
          <strong>✗ Error</strong>
          <div className="result-message">{error}</div>
        </div>
      )}

      {!searching && results.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div className="es-search-results-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px' }}>
                Found {totalResults} doc{totalResults !== 1 ? 's' : ''} with matches
                {totalPages > 1 && (
                  <span style={{ marginLeft: '8px', color: '#666' }}>
                    (Page {currentPage}/{totalPages})
                  </span>
                )}
              </span>
              <button
                onClick={() => {
                  setResults([]);
                  setHasSearched(false);
                  setTotalResults(0);
                  setTotalPages(0);
                  setCurrentPage(1);
                }}
                className="es-button-clear-search-results"
              >
                Clear Results
              </button>
            </div>
            {totalPages > 1 && (
              <div className="es-pagination">
                <button
                  onClick={() => handleSearch(1)}
                  disabled={currentPage === 1 || searching}
                  className="es-button-secondary"
                >
                  First
                </button>
                <button
                  onClick={() => handleSearch(currentPage - 1)}
                  disabled={currentPage === 1 || searching}
                  className="es-button-secondary"
                >
                  Previous
                </button>
                <span style={{ margin: '0 8px' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => handleSearch(currentPage + 1)}
                  disabled={currentPage === totalPages || searching}
                  className="es-button-secondary"
                >
                  Next
                </button>
                <button
                  onClick={() => handleSearch(totalPages)}
                  disabled={currentPage === totalPages || searching}
                  className="es-button-secondary"
                >
                  Last
                </button>
              </div>
            )}
          </div>
          <div className="es-search-results">
            {results.map((doc, docIdx) => (
              <EsDocSearchResult 
                key={doc.id || docIdx} 
                doc={doc} 
                mergeMatchesForSameKey={mergeMatches}
              />
            ))}
          </div>
        </div>
      )}

      {!searching && results.length === 0 && hasSearched && (
        <p style={{ color: '#666', fontStyle: 'italic', marginTop: '12px' }}>
          No matches found
        </p>
      )}
    </div>
  );
};

export default EsDocSearch;

