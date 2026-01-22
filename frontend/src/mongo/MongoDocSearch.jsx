import React, { useState } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { KeyValuesComp, EditableValueComp, PlusIcon, SpinningCircle } from '@wwf971/react-comp-misc';
import { getBackendServerUrl, mongoDocsAtom } from '../remote/dataStore';
import { extractDocId } from '../remote/dataStore';
import DocList from './DocList';
import './mongo.css';

/**
 * Adapter component for EditableValueComp to work with KeyValuesComp
 */
const EditableValueAdapter = ({ data, onChangeAttempt, isEditable, field, index, onAction }) => {
  const handleUpdate = async (configKey, newValue) => {
    if (onChangeAttempt) {
      // Ensure newValue is a string, not an object
      const actualValue = typeof newValue === 'object' && newValue !== null 
        ? (newValue.value !== undefined ? newValue.value : String(newValue))
        : newValue;
      onChangeAttempt(index, field, actualValue);
    }
    return { code: 0, message: 'Updated successfully' };
  };

  const configKey = `${field}_${index}`;

  return (
    <EditableValueComp
      data={data}
      configKey={configKey}
      onUpdate={handleUpdate}
      onAction={onAction}
      valueType="text"
      isNotSet={false}
      index={index}
      field={field}
    />
  );
};

/**
 * MongoDocSearch - Component for searching MongoDB documents with filters
 * 
 * @param {string} dbName - Currently selected database
 * @param {string} collName - Currently selected collection
 */
const MongoDocSearch = ({ dbName, collName }) => {
  const [filterPairs, setFilterPairs] = useState([
    { key: '', value: '' }
  ]);
  const [sort, setSort] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [searchResultIds, setSearchResultIds] = useState(null); // Store only IDs for current search
  
  // Use jotai atom for document cache
  const [cachedDocs, setCachedDocs] = useAtom(mongoDocsAtom);

  const handleFilterChange = (index, field, newValue) => {
    setFilterPairs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: newValue };
      return updated;
    });
  };

  const handleAction = async (action, actionData) => {
    const { index } = actionData;
    
    switch (action) {
      case 'addEntryAbove':
        setFilterPairs(prev => {
          const updated = [...prev];
          updated.splice(index, 0, { key: '', value: '' });
          return updated;
        });
        break;
        
      case 'addEntryBelow':
        setFilterPairs(prev => {
          const updated = [...prev];
          updated.splice(index + 1, 0, { key: '', value: '' });
          return updated;
        });
        break;
        
      case 'deleteEntry':
        if (filterPairs.length <= 1) {
          return { code: -1, message: 'Cannot delete the last entry' };
        }
        setFilterPairs(prev => {
          const updated = [...prev];
          updated.splice(index, 1);
          return updated;
        });
        break;
        
      default:
        return { code: -1, message: `Unknown action: ${action}` };
    }
    
    return { code: 0, message: 'Success' };
  };

  const handleAddEntry = () => {
    setFilterPairs(prev => [...prev, { key: '', value: '' }]);
  };

  const handleSearch = async (targetPage = 1) => {
    if (!dbName || !collName) {
      setError('Please select a database and collection first');
      return;
    }

    setSearching(true);
    setError(null);
    if (targetPage === 1) {
      setSearchResultIds(null);
    }

    try {
      const backendUrl = getBackendServerUrl();
      const params = new URLSearchParams();

      // Add filter key-value pairs (skip empty keys)
      filterPairs.forEach(pair => {
        if (pair.key && pair.key.trim()) {
          // Convert value to string, handle null/undefined
          const value = pair.value !== null && pair.value !== undefined 
            ? String(pair.value) 
            : '';
          params.append(pair.key, value);
        }
      });

      // Add sort
      if (sort && sort.trim()) {
        params.append('sort', sort);
      }

      // Add sortOrder
      if (sort && sort.trim() && sortOrder) {
        params.append('sortOrder', sortOrder);
      }

      // Add pagination
      params.append('page', String(targetPage));
      params.append('pageSize', String(pageSize));

      const url = `${backendUrl}/mongo/db/${dbName}/coll/${collName}/docs/list?${params.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.code === 0) {
        // data.data now contains {documents, total, page, pageSize}
        const resultData = data.data;
        if (resultData.documents) {
          const newDocs = resultData.documents;
          
          // Merge new documents into cache, avoiding duplicates
          setCachedDocs(prevDocs => {
            const existingIds = new Set(prevDocs.map(d => extractDocId(d)));
            const docsToAdd = newDocs.filter(d => !existingIds.has(extractDocId(d)));
            return [...prevDocs, ...docsToAdd];
          });
          
          // Store only the IDs for this search result
          const resultIds = newDocs.map(d => extractDocId(d));
          setSearchResultIds(resultIds);
          setTotal(resultData.total || 0);
          setPage(resultData.page || targetPage);
        } else {
          // Fallback for backward compatibility
          const results = Array.isArray(data.data) ? data.data : [data.data];
          
          // Merge into cache
          setCachedDocs(prevDocs => {
            const existingIds = new Set(prevDocs.map(d => extractDocId(d)));
            const docsToAdd = results.filter(d => !existingIds.has(extractDocId(d)));
            return [...prevDocs, ...docsToAdd];
          });
          
          const resultIds = results.map(d => extractDocId(d));
          setSearchResultIds(resultIds);
          setTotal(results.length);
          setPage(targetPage);
        }
      } else {
        setError(data.message || 'Search failed');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setSearching(false);
    }
  };

  const handlePageChange = (newPage) => {
    handleSearch(newPage);
  };

  if (!collName) {
    return null;
  }

  // Create data with EditableValueAdapter for all keys and values
  const dataWithComp = filterPairs.map((pair, idx) => ({
    key: pair.key,
    value: pair.value,
    keyComp: (props) => <EditableValueAdapter {...props} onAction={handleAction} />,
    valueComp: (props) => <EditableValueAdapter {...props} onAction={handleAction} />
  }));

  return (
    <div className="mongo-search-section" style={{ marginTop: '6px' }}>
      <div className="mongo-section-header">
        <h3>Search Documents in "{collName}"</h3>
      </div>

      <div style={{ marginTop: '12px' }}>
        <div style={{ marginBottom: '12px' }}>
          <h4 style={{ marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>Filter Conditions</h4>
          <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>
            Right-click on any field to add/delete entries
          </div>
          
          <KeyValuesComp 
            data={dataWithComp}
            onChangeAttempt={handleFilterChange}
            isKeyEditable={true}
            isValueEditable={true}
            keyColWidth="150px"
          />
          
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px',
            marginTop: '8px',
            padding: '6px 10px',
            cursor: 'pointer',
            color: '#666',
            border: '1px solid #ccc',
            borderRadius: '4px',
            transition: 'all 0.2s',
            width: 'fit-content'
          }}
            onClick={handleAddEntry}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#333';
              e.currentTarget.style.borderColor = '#999';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#666';
              e.currentTarget.style.borderColor = '#ccc';
            }}
          >
            <PlusIcon width={16} height={16} />
            <span style={{ fontSize: '13px' }}>Add Filter</span>
          </div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, 1fr)', 
          gap: '12px',
          marginBottom: '12px'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>
              Sort By
            </label>
            <input 
              type="text" 
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              placeholder="field1,field2"
              style={{
                width: '100%',
                padding: '4px',
                border: '1px solid #ddd',
                borderRadius: '2px',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>
              Sort Order
            </label>
            <select 
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{
                width: '100%',
                padding: '4px',
                border: '1px solid #ddd',
                borderRadius: '2px',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => handleSearch(1)}
          disabled={searching}
          style={{
            padding: '6px 16px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: searching ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {searching && <SpinningCircle width={16} height={16} color="white" />}
          {searching ? 'Searching...' : 'Search'}
        </button>

        {error && (
          <div className="test-result error" style={{ marginTop: '12px' }}>
            <strong>✗ Error</strong>
            <div className="result-message">{error}</div>
          </div>
        )}

        {searchResultIds && (
          <div style={{ marginTop: '12px' }}>
            <h4 style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}>
              Search Results ({total} total)
            </h4>
            <DocList
              docs={cachedDocs.filter(d => searchResultIds.includes(extractDocId(d)))}
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              paginated={true}
              emptyMessage="No documents match the search criteria"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MongoDocSearch;

