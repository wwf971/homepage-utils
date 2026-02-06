import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { SpinningCircle, TabsOnTop } from '@wwf971/react-comp-misc';
import './MongoAppConfig.css';
import '../../../frontend/src/elasticsearch/elasticsearch.css';

// Search result component
const EsDocSearchResult = ({ doc, mergeMatchesForSameKey = true }) => {
  
  const highlightSingleMatch = (text, startIndex, endIndex) => {
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

  const highlightMultipleMatches = (text, positions) => {
    if (positions.length === 0) return text;
    
    const sortedPositions = [...positions].sort((a, b) => a.start_index - b.start_index);
    const parts = [];
    let lastEnd = 0;
    
    for (const pos of sortedPositions) {
      if (pos.start_index > lastEnd) {
        parts.push(text.substring(lastEnd, pos.start_index));
      }
      parts.push(
        <span key={pos.start_index} className="es-search-highlight">
          {text.substring(pos.start_index, pos.end_index)}
        </span>
      );
      lastEnd = pos.end_index;
    }
    
    if (lastEnd < text.length) {
      parts.push(text.substring(lastEnd));
    }
    
    return <>{parts}</>;
  };

  const renderMergedMatches = () => {
    const groupedMatches = {};
    
    for (const match of doc.matched_keys) {
      const key = `${match.key}|${match.match_in}`;
      if (!groupedMatches[key]) {
        groupedMatches[key] = {
          key: match.key,
          value: match.value,
          match_in: match.match_in,
          positions: []
        };
      }
      groupedMatches[key].positions.push({
        start_index: match.start_index,
        end_index: match.end_index
      });
    }
    
    const groups = Object.values(groupedMatches);
    const totalMatches = doc.matched_keys.length;
    
    return (
      <>
        <div className="es-search-result-header">
          <div>
            <strong>Document ID:</strong> {doc.id}
          </div>
          <span className="es-match-count">
            {totalMatches} match{totalMatches !== 1 ? 'es' : ''} in {groups.length} field{groups.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="es-search-matches">
          {groups.map((group, idx) => (
            <div key={idx} className="es-search-match">
              <div className="es-match-location">
                {group.positions.length} match{group.positions.length !== 1 ? 'es' : ''} in <strong>{group.match_in}</strong>
              </div>
              <div className="es-match-field">
                <span className="es-field-label">Key:</span>
                {group.match_in === 'key' ? (
                  <code className="es-field-value">
                    {highlightMultipleMatches(group.key, group.positions)}
                  </code>
                ) : (
                  <code className="es-field-value">{group.key}</code>
                )}
              </div>
              <div className="es-match-field">
                <span className="es-field-label">Value:</span>
                {group.match_in === 'value' ? (
                  <code className="es-field-value">
                    {highlightMultipleMatches(group.value, group.positions)}
                  </code>
                ) : (
                  <code className="es-field-value">{group.value}</code>
                )}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  const renderSeparateMatches = () => {
    return (
      <>
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
                    {highlightSingleMatch(match.key, match.start_index, match.end_index)}
                  </code>
                ) : (
                  <code className="es-field-value">{match.key}</code>
                )}
              </div>
              <div className="es-match-field">
                <span className="es-field-label">Value:</span>
                {match.match_in === 'value' ? (
                  <code className="es-field-value">
                    {highlightSingleMatch(match.value, match.start_index, match.end_index)}
                  </code>
                ) : (
                  <code className="es-field-value">{match.value}</code>
                )}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="es-search-result-card">
      {mergeMatchesForSameKey ? renderMergedMatches() : renderSeparateMatches()}
    </div>
  );
};

// Search panel component
const SearchPanel = observer(({ esIndexName, store }) => {
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
    if (!esIndexName || !query.trim()) return;

    setSearching(true);
    setError(null);
    setHasSearched(true);
    if (page === 1) {
      setResults([]);
      setCurrentPage(1);
    }

    try {
      const response = await fetch(`${store.serverUrl}/elasticsearch/indices/${encodeURIComponent(esIndexName)}/search/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          search_in_paths: searchInKeys,
          search_in_values: searchInValues,
          page: page,
          page_size: pageSize
        })
      });

      const result = await response.json();
      
      if (result.code === 0) {
        setResults(result.data.results || []);
        setTotalResults(result.data.total || 0);
        setTotalPages(result.data.total_pages || 0);
        setCurrentPage(page);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err.message || 'Search failed');
    }
    
    setSearching(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !searching) {
      handleSearch(1);
    }
  };

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
          <strong>Error</strong>
          <div className="result-message">{error}</div>
        </div>
      )}

      {!searching && results.length > 0 && (
        <div style={{ marginTop: '12px'}}>
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
});

// Collections list panel
const CollectionsPanel = observer(({ collections, appId }) => {
  const APP_DB_NAME = 'mongo-app';
  const appPrefix = `${appId}_`;
  
  const internalCollections = collections.filter(coll => 
    coll.database === APP_DB_NAME && coll.collection.startsWith(appPrefix)
  );
  const externalCollections = collections.filter(coll => 
    coll.database !== APP_DB_NAME || !coll.collection.startsWith(appPrefix)
  );

  return (
    <div style={{ padding: '8px 0' }}>
      {collections.length === 0 ? (
        <div className="no-items-text">No collections monitored</div>
      ) : (
        <div className="collection-indices-container">
          {internalCollections.length > 0 && (
            <div>
              <div className="collection-item-details-label">App Collections:</div>
              <div className="collection-indices-row" style={{ marginTop: '4px' }}>
                {internalCollections.map((coll, idx) => {
                  const displayName = coll.collection.replace(appPrefix, '');
                  return (
                    <span key={idx} className="collection-tag-internal">
                      {displayName}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {externalCollections.length > 0 && (
            <div style={{ marginTop: internalCollections.length > 0 ? '8px' : '0' }}>
              <div className="external-label">External Collections:</div>
              <div className="collection-indices-row" style={{ marginTop: '4px' }}>
                {externalCollections.map((coll, idx) => (
                  <span key={idx} className="collection-tag-external">
                    {coll.database}/{coll.collection}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// Main component with tabs (embedded, not modal)
const MongoAppEsIndexCard = observer(({ esIndexName, indexInfo, appId, store }) => {
  const collections = indexInfo?.collections || [];

  return (
    <div style={{ marginTop: '8px' }}>
      <TabsOnTop defaultTab="Collections">
        <TabsOnTop.Tab label="Collections">
          <CollectionsPanel collections={collections} appId={appId} />
        </TabsOnTop.Tab>
        <TabsOnTop.Tab label="Search">
          <SearchPanel esIndexName={esIndexName} store={store} />
        </TabsOnTop.Tab>
      </TabsOnTop>
    </div>
  );
});

export default MongoAppEsIndexCard;
