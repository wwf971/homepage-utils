import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { makeAutoObservable, runInAction } from 'mobx';
import { CrossIcon } from '@wwf971/react-comp-misc';

/**
 * FileAccessPointSelector - Select a file access point from list
 * 
 * Props:
 * - serverUrl: string - Backend server URL
 * - onSelect: (fileAccessPoint) => void - Called when a file access point is selected
 * - onCancel: () => void - Called when cancel button is clicked
 * - selectedId: string - Currently selected file access point ID (optional)
 */
const FileAccessPointSelector = observer(({ 
  serverUrl, 
  onSelect, 
  onCancel,
  selectedId
}) => {
  const [store] = useState(() => makeAutoObservable({
    fileAccessPoints: [],
    loading: false,
    error: null,
    searchQuery: '',
    
    get filteredFileAccessPoints() {
      if (!this.searchQuery.trim()) {
        return this.fileAccessPoints;
      }
      
      const query = this.searchQuery.toLowerCase();
      return this.fileAccessPoints.filter(fap => {
        const name = (fap.name || '').toLowerCase();
        const id = (fap.id || '').toLowerCase();
        return name.includes(query) || id.includes(query);
      });
    },
    
    async fetchFileAccessPoints() {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await fetch(`${serverUrl}/file_access_point/list/`);
        const result = await response.json();
        
        if (result.code === 0) {
          runInAction(() => {
            this.fileAccessPoints = result.data || [];
            this.loading = false;
          });
        } else {
          runInAction(() => {
            this.error = { message: result.message || 'Failed to load file access points' };
            this.loading = false;
          });
        }
      } catch (err) {
        runInAction(() => {
          this.error = { message: err.message || 'Network error' };
          this.loading = false;
        });
      }
    },
    
    setSearchQuery(query) {
      this.searchQuery = query;
    }
  }));
  
  useEffect(() => {
    store.fetchFileAccessPoints();
  }, [serverUrl]);
  
  const handleSelect = (fap) => {
    if (onSelect) {
      onSelect(fap);
    }
  };
  
  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '4px',
      backgroundColor: '#fff',
      padding: '12px',
      position: 'relative'
    }}>
      {/* Close button */}
      <button
        onClick={onCancel}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '4px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Cancel"
      >
        <CrossIcon size={16} color="#666" strokeWidth={2} />
      </button>
      
      {/* Title */}
      <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>
        Select File Access Point
      </div>
      
      {/* Search bar */}
      <div style={{ marginBottom: '12px' }}>
        <input
          type="text"
          placeholder="Search by name or ID..."
          value={store.searchQuery}
          onChange={(e) => store.setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: '12px',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        />
      </div>
      
      {/* Error display */}
      {store.error && (
        <div style={{
          padding: '8px',
          marginBottom: '12px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#c00'
        }}>
          {store.error.message}
        </div>
      )}
      
      {/* Loading indicator */}
      {store.loading && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#666'
        }}>
          Loading file access points...
        </div>
      )}
      
      {/* List of file access points */}
      {!store.loading && (
        <div style={{
          maxHeight: '300px',
          overflowY: 'auto',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          backgroundColor: '#fafafa'
        }}>
          {store.filteredFileAccessPoints.length === 0 ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              fontSize: '12px',
              color: '#999'
            }}>
              {store.searchQuery ? 'No matching file access points found' : 'No file access points available'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {store.filteredFileAccessPoints.map((fap) => (
                <div
                  key={fap.id}
                  onClick={() => handleSelect(fap)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #e8e8e8',
                    backgroundColor: selectedId === fap.id ? '#e3f2fd' : 'transparent',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedId !== fap.id) {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedId !== fap.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ fontSize: '13px' }}>
                    {fap.name || 'Unnamed'}
                    <span style={{ marginLeft: '6px', color: '#999', fontSize: '11px' }}>
                      ({fap.id})
                    </span>
                  </div>
                  {fap.type && (
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                      Type: {fap.type}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default FileAccessPointSelector;
