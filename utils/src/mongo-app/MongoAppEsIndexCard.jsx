import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { SpinningCircle, TabsOnTop } from '@wwf971/react-comp-misc';
import EsDocSearchResult from '../elasticsearch/EsDocSearchResult';
import './MongoAppConfig.css';
import '../elasticsearch/elasticsearch.css';

// Search panel component
const SearchPanel = observer(({ esIndexName, store }) => {
  const pageSize = 20;
  const [query, setQuery] = useState('');
  const [searchInKeys, setSearchInKeys] = useState(false);
  const [searchInValues, setSearchInValues] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPageNum, setTotalPageNum] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [mergeMatches, setMergeMatches] = useState(true);

  const handleSearch = async (page = 1) => {
    if (!esIndexName || !query.trim()) return;

    setSearching(true);
    setError(null);
    setHasSearched(true);
    if (page === 1) {
      setResults([]);
      setCurrentPageIndex(1);
    }

    try {
      const response = await fetch(`${store.backendUrl}/elasticsearch/indices/${encodeURIComponent(esIndexName)}/search/`, {
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
        setTotalPageNum(result.data.total_pages || 0);
        setCurrentPageIndex(page);
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
                {totalPageNum > 1 && (
                  <span style={{ marginLeft: '8px', color: '#666' }}>
                    (Page {currentPageIndex}/{totalPageNum})
                  </span>
                )}
              </span>
              <button
                onClick={() => {
                  setResults([]);
                  setHasSearched(false);
                  setTotalResults(0);
                  setTotalPageNum(0);
                  setCurrentPageIndex(1);
                }}
                className="es-button-clear-search-results"
              >
                Clear Results
              </button>
            </div>
            {totalPageNum > 1 && (
              <div className="es-pagination">
                <button
                  onClick={() => handleSearch(1)}
                  disabled={currentPageIndex === 1 || searching}
                  className="es-button-secondary"
                >
                  First
                </button>
                <button
                  onClick={() => handleSearch(currentPageIndex - 1)}
                  disabled={currentPageIndex === 1 || searching}
                  className="es-button-secondary"
                >
                  Previous
                </button>
                <span style={{ margin: '0 8px' }}>
                  Page {currentPageIndex} of {totalPageNum}
                </span>
                <button
                  onClick={() => handleSearch(currentPageIndex + 1)}
                  disabled={currentPageIndex === totalPageNum || searching}
                  className="es-button-secondary"
                >
                  Next
                </button>
                <button
                  onClick={() => handleSearch(totalPageNum)}
                  disabled={currentPageIndex === totalPageNum || searching}
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
