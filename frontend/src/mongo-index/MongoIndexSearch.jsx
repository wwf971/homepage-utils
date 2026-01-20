import React, { useState, useRef } from 'react';
import { SpinningCircle } from '@wwf971/react-comp-misc';
import { getBackendServerUrl } from '../remote/dataStore';
import './mongo-index.css';

/**
 * MongoIndexSearch - Component for searching documents in MongoDB-ES index
 * Wraps the character-level search logic from EsDocSearch
 */
const MongoIndexSearch = ({ indexName }) => {
  const [query, setQuery] = useState('');
  const [searchInKeys, setSearchInKeys] = useState(false);
  const [searchInValues, setSearchInValues] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const lastSearchTime = useRef(0);
  const MIN_SEARCH_INTERVAL = 300; // 0.3 seconds

  const handleSearch = async () => {
    if (!indexName || !query.trim()) return;

    // Enforce minimum search interval
    const now = Date.now();
    const timeSinceLastSearch = now - lastSearchTime.current;
    if (timeSinceLastSearch < MIN_SEARCH_INTERVAL) {
      console.log(`Throttling search. Wait ${MIN_SEARCH_INTERVAL - timeSinceLastSearch}ms`);
      return;
    }
    lastSearchTime.current = now;

    setSearching(true);
    setError(null);
    setResults([]);

    try {
      const backendUrl = getBackendServerUrl();
      const response = await fetch(
        `${backendUrl}/mongo/index/${encodeURIComponent(indexName)}/search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: query.trim(),
            search_in_paths: searchInKeys,
            search_in_values: searchInValues
          })
        }
      );

      const result = await response.json();
      
      if (result.code === 0) {
        setResults(result.data || []);
      } else {
        setError(result.message || 'Search failed');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !searching) {
      handleSearch();
    }
  };

  const highlightText = (text, startIndex, endIndex) => {
    const before = text.substring(0, startIndex);
    const match = text.substring(startIndex, endIndex);
    const after = text.substring(endIndex);
    
    return (
      <>
        {before}
        <span className="mongo-index-search-highlight">{match}</span>
        {after}
      </>
    );
  };

  if (!indexName) {
    return null;
  }

  return (
    <div className="mongo-index-search-section">
      <div className="mongo-index-search-header">
        <h4>Search Documents</h4>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <div className="mongo-index-search-input-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter search query..."
            className="mongo-index-search-input"
            disabled={searching}
          />
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="mongo-index-button-primary"
          >
            {searching ? (
              <>
                <SpinningCircle width={14} height={14} color="white" />
                <span style={{ marginLeft: '4px' }}>Searching...</span>
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>

        <div className="mongo-index-search-options">
          <label className="mongo-index-checkbox-label">
            <input
              type="checkbox"
              checked={searchInKeys}
              onChange={(e) => setSearchInKeys(e.target.checked)}
              disabled={searching}
            />
            Search in field names (keys)
          </label>
          <label className="mongo-index-checkbox-label">
            <input
              type="checkbox"
              checked={searchInValues}
              onChange={(e) => setSearchInValues(e.target.checked)}
              disabled={searching}
            />
            Search in field values
          </label>
        </div>
      </div>

      {error && (
        <div className="mongo-index-error-message" style={{ marginTop: '8px' }}>
          <strong>✗ Error</strong>
          <div>{error}</div>
        </div>
      )}

      {!searching && results.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ marginBottom: '6px', fontSize: '12px', fontWeight: 600 }}>
            Found {results.length} document{results.length !== 1 ? 's' : ''} with matches
          </div>
          <div className="mongo-index-search-results">
            {results.map((doc, docIdx) => (
              <div key={doc.id || docIdx} className="mongo-index-search-result-card">
                <div className="mongo-index-search-result-header">
                  <div>
                    <strong>Document ID:</strong> {doc.id}
                  </div>
                  <span className="mongo-index-match-count">
                    {doc.matched_keys.length} match{doc.matched_keys.length !== 1 ? 'es' : ''}
                  </span>
                </div>
                <div className="mongo-index-search-matches">
                  {doc.matched_keys.map((match, matchIdx) => (
                    <div key={matchIdx} className="mongo-index-search-match">
                      <div className="mongo-index-match-location">
                        Match in <strong>{match.match_in}</strong> at position {match.start_index}-{match.end_index}
                      </div>
                      <div className="mongo-index-match-fields-container">
                        <div className="mongo-index-match-labels">
                          <span className="mongo-index-field-label">Key:</span>
                          <span className="mongo-index-field-label">Value:</span>
                        </div>
                        <div className="mongo-index-match-values">
                          {match.match_in === 'key' ? (
                            <code className="mongo-index-field-value">
                              {highlightText(match.key, match.start_index, match.end_index)}
                            </code>
                          ) : (
                            <code className="mongo-index-field-value">{match.key}</code>
                          )}
                          {match.match_in === 'value' ? (
                            <code className="mongo-index-field-value">
                              {highlightText(match.value, match.start_index, match.end_index)}
                            </code>
                          ) : (
                            <code className="mongo-index-field-value">{match.value}</code>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!searching && results.length === 0 && query && (
        <p style={{ color: '#666', fontStyle: 'italic', marginTop: '8px', fontSize: '12px' }}>
          No matches found for "{query}"
        </p>
      )}
    </div>
  );
};

export default MongoIndexSearch;
