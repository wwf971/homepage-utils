import React, { useState } from 'react';
import { PanelPopup } from '@wwf971/react-comp-misc';
import { getIdByValue, listIds, searchIds, convertId, searchIdsBySubstring, deleteId } from '../remote/dataStore';
import { formatTimestamp, extractTimestampMs } from './idUtils';
import '../styles/common.css';

const IdSearch = () => {
  const [searchType, setSearchType] = useState('byInteger'); // 'byInteger', 'byString', 'list', 'filter'
  const [searchValue, setSearchValue] = useState('');
  const [filterSelfType, setFilterSelfType] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [errorDialog, setErrorDialog] = useState(null);

  const handleSearch = async () => {
    setSearching(true);
    setError(null);
    setResults(null);

    try {
      let response;

      if (searchType === 'byInteger') {
        if (!searchValue.trim()) {
          setError('Please enter an ID value');
          setSearching(false);
          return;
        }

        response = await getIdByValue(searchValue.trim());
        if (response.code === 0) {
          // Get conversions
          const conversionResult = await convertId(response.data.value, 'all');
          const idWithConversions = {
            ...response.data,
            conversions: conversionResult.code === 0 ? conversionResult.data : null
          };
          setResults({
            ids: [idWithConversions],
            totalCount: 1,
            page: 0,
            pageSize: 1
          });
        } else {
          setError(response.message || 'ID not found');
        }
      } else if (searchType === 'byString') {
        if (!searchValue.trim()) {
          setError('Please enter a substring to search');
          setSearching(false);
          return;
        }

        const request = {
          substring: searchValue.trim(),
          page,
          pageSize
        };

        response = await searchIdsBySubstring(request);
        if (response.code === 0) {
          // Get conversions for all IDs
          const idsWithConversions = await Promise.all(
            response.data.ids.map(async (id) => {
              const conversionResult = await convertId(id.value, 'all');
              return {
                ...id,
                conversions: conversionResult.code === 0 ? conversionResult.data : null
              };
            })
          );
          setResults({
            ...response.data,
            ids: idsWithConversions
          });
        } else {
          setError(response.message || 'Failed to search IDs');
        }
      } else if (searchType === 'list') {
        response = await listIds(page, pageSize);
        if (response.code === 0) {
          // Get conversions for all IDs
          const idsWithConversions = await Promise.all(
            response.data.ids.map(async (id) => {
              const conversionResult = await convertId(id.value, 'all');
              return {
                ...id,
                conversions: conversionResult.code === 0 ? conversionResult.data : null
              };
            })
          );
          setResults({
            ...response.data,
            ids: idsWithConversions
          });
        } else {
          setError(response.message || 'Failed to list IDs');
        }
      } else if (searchType === 'filter') {
        const request = {
          selfType: filterSelfType ? parseInt(filterSelfType) : null,
          type: filterType || null,
          createAtStart: filterDateStart ? new Date(filterDateStart).getTime() : null,
          createAtEnd: filterDateEnd ? new Date(filterDateEnd).getTime() : null,
          page,
          pageSize
        };

        response = await searchIds(request);
        if (response.code === 0) {
          // Get conversions for all IDs
          const idsWithConversions = await Promise.all(
            response.data.ids.map(async (id) => {
              const conversionResult = await convertId(id.value, 'all');
              return {
                ...id,
                conversions: conversionResult.code === 0 ? conversionResult.data : null
              };
            })
          );
          setResults({
            ...response.data,
            ids: idsWithConversions
          });
        } else {
          setError(response.message || 'Failed to search IDs');
        }
      }
    } catch (err) {
      setError(err.message || 'Unknown error');
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = (idValue) => {
    setConfirmDialog({
      message: 'Are you sure you want to delete this ID?',
      onConfirm: async () => {
        setConfirmDialog(null);
        setDeletingId(idValue);
        try {
          const response = await deleteId(idValue);
          if (response.code === 0) {
            // Remove the deleted ID from results
            setResults(prev => ({
              ...prev,
              ids: prev.ids.filter(id => id.value !== idValue),
              totalCount: prev.totalCount - 1
            }));
          } else {
            setErrorDialog({
              message: 'Failed to delete ID: ' + (response.message || 'Unknown error')
            });
          }
        } catch (err) {
          setErrorDialog({
            message: 'Failed to delete ID: ' + (err.message || 'Unknown error')
          });
        } finally {
          setDeletingId(null);
        }
      }
    });
  };

  const renderIdRow = (id) => {
    const isDeleting = deletingId === id.value;
    
    return (
      <div key={id.value} style={{ marginBottom: '12px', padding: '12px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#fafafa', position: 'relative' }}>
        <button
          onClick={() => handleDelete(id.value)}
          disabled={isDeleting}
          className="button-danger"
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            padding: '4px 8px',
            fontSize: '12px',
            opacity: isDeleting ? 0.6 : 1
          }}
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
        
        <div style={{ fontFamily: 'monospace', fontSize: '13px', paddingRight: '80px' }}>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: '500', color: '#555' }}>Integer:</span> {id.value}
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: '500', color: '#555' }}>Base36:</span> {id.conversions?.valueBase36 || 'N/A'}
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: '500', color: '#555' }}>Base64:</span> {id.conversions?.valueBase64 || 'N/A'}
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: '500', color: '#555' }}>Hex:</span> {id.conversions?.valueHex || 'N/A'}
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: '500', color: '#555' }}>Type:</span> {id.selfType === 0 ? 'Random' : 'ms_48 (Timestamp)'}
          </div>
          {id.selfType === 1 && (
            <div style={{ marginBottom: '4px' }}>
              <span style={{ fontWeight: '500', color: '#555' }}>Timestamp:</span> {formatTimestamp(extractTimestampMs(id.value), id.createAtTimezone)}
            </div>
          )}
          {id.type && (
            <div style={{ marginBottom: '4px' }}>
              <span style={{ fontWeight: '500', color: '#555' }}>Tag:</span> {id.type}
            </div>
          )}
          {id.metadata && (
            <div style={{ marginBottom: '4px' }}>
              <span style={{ fontWeight: '500', color: '#555' }}>Metadata:</span> {id.metadata}
            </div>
          )}
          <div style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: '500', color: '#555' }}>Created:</span> {formatTimestamp(id.createAt, id.createAtTimezone)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '12px', paddingTop: '0px' }}>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>Search Type</div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              value="byInteger"
              checked={searchType === 'byInteger'}
              onChange={(e) => setSearchType(e.target.value)}
              style={{ marginRight: '4px' }}
            />
            int64
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              value="byString"
              checked={searchType === 'byString'}
              onChange={(e) => setSearchType(e.target.value)}
              style={{ marginRight: '4px' }}
            />
            09az
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              value="list"
              checked={searchType === 'list'}
              onChange={(e) => setSearchType(e.target.value)}
              style={{ marginRight: '4px' }}
            />
            List All
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              value="filter"
              checked={searchType === 'filter'}
              onChange={(e) => setSearchType(e.target.value)}
              style={{ marginRight: '4px' }}
            />
            Filter
          </label>
        </div>
      </div>

      {searchType === 'byInteger' && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>ID Value (Integer)</div>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Integer, base36, base64, or hex"
            className="input-text"
            style={{ width: '100%', maxWidth: '400px' }}
          />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            Exact match by ID value in any format
          </div>
        </div>
      )}

      {searchType === 'byString' && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>Substring (0-9a-z)</div>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="e.g., abc, 123, a1b2"
            className="input-text"
            style={{ width: '100%', maxWidth: '400px' }}
          />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            Searches for IDs whose base36 string contains this substring
          </div>
        </div>
      )}

      {searchType === 'filter' && (
        <div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>Self Type</div>
            <select
              value={filterSelfType}
              onChange={(e) => setFilterSelfType(e.target.value)}
              className="input-text"
              style={{ width: '200px' }}
            >
              <option value="">All</option>
              <option value="0">Random</option>
              <option value="1">ms_48 (Timestamp)</option>
            </select>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>Type Tag</div>
            <input
              type="text"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              placeholder="e.g., user, order"
              className="input-text"
              style={{ width: '100%', maxWidth: '400px' }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>Date Range</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="datetime-local"
                value={filterDateStart}
                onChange={(e) => setFilterDateStart(e.target.value)}
                className="input-text"
              />
              <span>to</span>
              <input
                type="datetime-local"
                value={filterDateEnd}
                onChange={(e) => setFilterDateEnd(e.target.value)}
                className="input-text"
              />
            </div>
          </div>
        </div>
      )}

      {(searchType === 'byString' || searchType === 'list' || searchType === 'filter') && (
        <div style={{ marginBottom: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div>
            <div style={{ marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>Page</div>
            <input
              type="number"
              value={page}
              onChange={(e) => setPage(parseInt(e.target.value) || 0)}
              min="0"
              className="input-text"
              style={{ width: '80px' }}
            />
          </div>
          <div>
            <div style={{ marginBottom: '4px', fontSize: '13px', fontWeight: '500' }}>Page Size</div>
            <input
              type="number"
              value={pageSize}
              onChange={(e) => setPageSize(parseInt(e.target.value) || 20)}
              min="1"
              max="1000"
              className="input-text"
              style={{ width: '80px' }}
            />
          </div>
        </div>
      )}

      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={handleSearch}
          disabled={searching}
          className="button-primary"
          style={{ opacity: searching ? 0.6 : 1 }}
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ marginTop: '12px', padding: '8px', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c33' }}>
          Error: {error}
        </div>
      )}

      {results && (
        <div style={{ marginTop: '12px' }}>
          <div className="section-title" style={{ marginBottom: '8px' }}>
            Results ({results.ids.length} of {results.totalCount})
          </div>

          {results.ids.length === 0 ? (
            <div style={{ padding: '12px', color: '#666', fontStyle: 'italic' }}>No IDs found</div>
          ) : (
            <div>
              {results.ids.map(renderIdRow)}
              
              {results.totalCount > results.pageSize && (
                <div style={{ marginTop: '12px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
                  <div style={{ fontSize: '13px' }}>
                    Page {results.page + 1} of {Math.ceil(results.totalCount / results.pageSize)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {confirmDialog && (
        <PanelPopup
          type="confirm"
          title="Confirm Delete"
          message={confirmDialog.message}
          confirmText="Delete"
          cancelText="Cancel"
          danger={true}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {errorDialog && (
        <PanelPopup
          type="alert"
          title="Error"
          message={errorDialog.message}
          confirmText="OK"
          onConfirm={() => setErrorDialog(null)}
        />
      )}
    </div>
  );
};

export default IdSearch;
