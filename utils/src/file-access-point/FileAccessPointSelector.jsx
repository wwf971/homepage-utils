import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { makeAutoObservable } from 'mobx';
import Tag from '../ui/Tag.jsx';
import fileStore from './fileStore.js';

/**
 * FileAccessPointSelector - Select a file access point from list
 * 
 * Props:
 * - title: string - Custom title text (optional, if empty/null/undefined, no title shown)
 * - viewMode: 'list' | 'tags' - Display as vertical list or horizontal tags (default: 'list')
 * - showActions: boolean - Whether to show Confirm/Cancel buttons (default: false)
 * - onConfirm: (fileAccessPoint) => void - Called when Confirm button is clicked (requires showActions=true)
 * - onCancel: () => void - Called when Cancel button is clicked (requires showActions=true)
 * - onSelect: (fileAccessPoint) => void - Called when a file access point is clicked (immediate selection without confirm)
 * - selectedId: string - Currently selected file access point ID (optional)
 * 
 * Data source: Automatically fetches from fileStore.getAllFap()
 */
const FileAccessPointSelector = observer(({ 
  title,
  viewMode = 'tags',
  showActions = false,
  onConfirm,
  onCancel,
  onSelect, 
  selectedId
}) => {
  // Get file access points from store
  const fileAccessPoints = fileStore.getAllFap();
  // Local UI state (not data state - that comes from props)
  const [store] = useState(() => makeAutoObservable({
    searchQuery: '',
    currentViewMode: viewMode,
    
    setSearchQuery(query) {
      this.searchQuery = query;
    },
    
    toggleViewMode() {
      this.currentViewMode = this.currentViewMode === 'list' ? 'tags' : 'list';
    }
  }));
  
  // Compute filtered list based on search query
  // This is computed locally but uses data from props (which should be observable from parent)
  const filteredFaps = (() => {
    // Filter out system FAPs
    const nonSystemFaps = (fileAccessPoints || []).filter(fap => !fap.content?.systemRole);
    
    if (!store.searchQuery.trim()) {
      return nonSystemFaps;
    }
    
    const query = store.searchQuery.toLowerCase();
    return nonSystemFaps.filter(fap => {
      const name = (fap.content?.name || fap.name || '').toLowerCase();
      const id = (fap.id || '').toLowerCase();
      return name.includes(query) || id.includes(query);
    });
  })();
  
  const [tempSelectedFap, setTempSelectedFap] = useState(null);
  
  const handleItemClick = (fap) => {
    if (showActions) {
      // In actions mode, just update temp selection
      setTempSelectedFap(fap);
    } else {
      // In immediate mode, call onSelect directly
      if (onSelect) {
        onSelect(fap);
      }
    }
  };
  
  const handleConfirm = () => {
    if (tempSelectedFap && onConfirm) {
      onConfirm(tempSelectedFap);
    }
  };
  
  const handleCancel = () => {
    setTempSelectedFap(null);
    if (onCancel) {
      onCancel();
    }
  };
  
  // Determine which ID to highlight
  const highlightedId = showActions ? tempSelectedFap?.id : selectedId;
  
  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '4px',
      backgroundColor: '#fff',
      padding: '12px',
      position: 'relative',
      maxHeight: '500px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header: Title and Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: title || showActions ? '12px' : '0', flexShrink: 0 }}>
        {/* Title - only show if provided */}
        {title && (
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
            {title}
          </div>
        )}
        
        {/* Confirm/Cancel buttons - only show if showActions is true */}
        {showActions && (
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <button
              onClick={handleCancel}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                backgroundColor: '#f5f5f5',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!tempSelectedFap}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                backgroundColor: tempSelectedFap ? '#2196F3' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: tempSelectedFap ? 'pointer' : 'not-allowed'
              }}
            >
              Confirm
            </button>
          </div>
        )}
      </div>
      
      {/* Search bar */}
      <div style={{ marginBottom: '8px' }}>
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
      
      {/* Button group: View mode toggle and Clear */}
      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
        <button
          onClick={() => store.toggleViewMode()}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            minWidth: '50px'
          }}
          title={`Switch to ${store.currentViewMode === 'list' ? 'tags' : 'list'} view`}
        >
          {store.currentViewMode === 'list' ? 'Tags' : 'List'}
        </button>
        <button
          onClick={() => store.setSearchQuery('')}
          disabled={!store.searchQuery}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: store.searchQuery ? '#f5f5f5' : '#fafafa',
            color: store.searchQuery ? '#333' : '#999',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: store.searchQuery ? 'pointer' : 'not-allowed'
          }}
          title="Clear search"
        >
          Clear
        </button>
      </div>
      
      {/* Scrollable content area */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* List of file access points */}
        {(
          <div style={{
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            backgroundColor: '#fafafa',
            padding: store.currentViewMode === 'tags' ? '8px' : '0',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto'
          }}>
          {filteredFaps.length === 0 ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              fontSize: '12px',
              color: '#999'
            }}>
              {store.searchQuery ? 'No matching file access points found' : 'No file access points available'}
            </div>
          ) : store.currentViewMode === 'tags' ? (
            /* Tags view - horizontal wrap layout */
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {filteredFaps.map((fap) => {
                const displayName = fap.content?.name || fap.name || 'Unnamed';
                const displayType = fap.content?.setting?.type || fap.type;
                
                return (
                  <Tag
                    key={fap.id}
                    isClickable
                    isSelected={highlightedId === fap.id}
                    onClick={() => handleItemClick(fap)}
                    contentComponent={
                      <>
                        <div style={{ fontSize: '13px' }}>
                          {displayName}
                          <span style={{ marginLeft: '6px', color: '#999', fontSize: '11px' }}>
                            ({fap.id})
                          </span>
                        </div>
                        {displayType && (
                          <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                            Type: {displayType}
                          </div>
                        )}
                      </>
                    }
                  />
                );
              })}
            </div>
          ) : (
            /* List view - vertical stack layout */
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredFaps.map((fap) => {
                const displayName = fap.content?.name || fap.name || 'Unnamed';
                const displayType = fap.content?.setting?.type || fap.type;
                
                return (
                  <div
                    key={fap.id}
                    onClick={() => handleItemClick(fap)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #e8e8e8',
                      backgroundColor: highlightedId === fap.id ? '#e3f2fd' : 'transparent',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      if (highlightedId !== fap.id) {
                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (highlightedId !== fap.id) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ fontSize: '13px' }}>
                      {displayName}
                      <span style={{ marginLeft: '6px', color: '#999', fontSize: '11px' }}>
                        ({fap.id})
                      </span>
                    </div>
                    {displayType && (
                      <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                        Type: {displayType}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
});

export default FileAccessPointSelector;
