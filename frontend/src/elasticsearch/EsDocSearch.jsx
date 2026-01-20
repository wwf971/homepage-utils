import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { SpinningCircle } from '@wwf971/react-comp-misc';
import { esSelectedIndexAtom } from '../remote/dataStore';
import { searchEsDocs } from './EsStore';
import './elasticsearch.css';

/**
 * EsDocSearch - Component for searching documents using character-level index
 */
const EsDocSearch = () => {
  const [query, setQuery] = useState('');
  const [searchInKeys, setSearchInKeys] = useState(false);
  const [searchInValues, setSearchInValues] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  
  const selectedIndex = useAtomValue(esSelectedIndexAtom);

  const handleSearch = async () => {
    if (!selectedIndex || !query.trim()) return;

    setSearching(true);
    setError(null);
    setResults([]);

    const result = await searchEsDocs(selectedIndex, {
      query: query.trim(),
      search_in_paths: searchInKeys,
      search_in_values: searchInValues
    });
    
    if (result.code === 0) {
      setResults(result.data);
    } else {
      setError(result.message);
    }
    
    setSearching(false);
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
        <span className="es-search-highlight">{match}</span>
        {after}
      </>
    );
  };

  if (!selectedIndex) {
    return null;
  }

  return (
    <div className="es-search-section">
      <div className="es-section-header">
        <h3>Search Documents in "{selectedIndex}"</h3>
      </div>

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
            onClick={handleSearch}
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
          <h4 style={{ marginBottom: '8px' }}>
            Found {results.length} document{results.length !== 1 ? 's' : ''} with matches
          </h4>
          <div className="es-search-results">
            {results.map((doc, docIdx) => (
              <div key={doc.id || docIdx} className="es-search-result-card">
                <div className="es-search-result-header">
                  <div>
                    <strong>Document ID:</strong> {doc.id}
                  </div>
                  <span className="es-match-count">
                    {doc.matched_keys.length} match{doc.matched_keys.length !== 1 ? 'es' : ''}
                  </span>
                </div>
                <div className="es-search-matches">
                  {doc.matched_keys.map((match, matchIdx) => (
                    <div key={matchIdx} className="es-search-match">
                      <div className="es-match-location">
                        Match in <strong>{match.match_in}</strong> at position {match.start_index}-{match.end_index}
                      </div>
                      <div className="es-match-field">
                        <span className="es-field-label">Key:</span>
                        {match.match_in === 'key' ? (
                          <code className="es-field-value">
                            {highlightText(match.key, match.start_index, match.end_index)}
                          </code>
                        ) : (
                          <code className="es-field-value">{match.key}</code>
                        )}
                      </div>
                      <div className="es-match-field">
                        <span className="es-field-label">Value:</span>
                        {match.match_in === 'value' ? (
                          <code className="es-field-value">
                            {highlightText(match.value, match.start_index, match.end_index)}
                          </code>
                        ) : (
                          <code className="es-field-value">{match.value}</code>
                        )}
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
        <p style={{ color: '#666', fontStyle: 'italic', marginTop: '12px' }}>
          No matches found for "{query}"
        </p>
      )}
    </div>
  );
};

export default EsDocSearch;

