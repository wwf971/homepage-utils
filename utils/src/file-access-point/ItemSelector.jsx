import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { observer } from 'mobx-react-lite';
import { makeAutoObservable, runInAction } from 'mobx';
import { FolderView, PathBar, FolderIcon, UpIcon } from '@wwf971/react-comp-misc';

/**
 * ItemSelector - File/folder selector component using FolderView
 * 
 * Props:
 * - serverUrl: string - Backend server URL
 * - fileAccessPointId: string - File access point ID
 * - initialPath: string - Starting path (default: '/')
 * - selectionConfig: {
 *     mode: 'single' | 'multiple' (default: 'single')
 *     allowedTypes: ['file', 'folder'] or ['file'] or ['folder'] (default: ['file', 'folder'])
 *     allowMixed: boolean - If false and mode=multiple, all selected must be same type (default: false)
 *   }
 * - onConfirm: (selectedItems) => void - Called with array of selected items
 * - onCancel: () => void
 * - height: number - Fixed height for FolderView body (default: 400)
 * - showTitle: boolean - Whether to show the default title (default: true)
 */
const ItemSelector = observer(forwardRef(({ 
  serverUrl,
  fileAccessPointId,
  initialPath = '/',
  selectionConfig = { mode: 'single', allowedTypes: ['file', 'folder'], allowMixed: false },
  onConfirm,
  onCancel,
  height = 400,
  showTitle = true
}, ref) => {
  const [store] = useState(() => makeAutoObservable({
    // Navigation
    currentPath: initialPath,
    
    // Data
    itemsById: new Map(),
    itemsOrder: [],
    loading: false,
    error: null,
    
    // Selection
    selectedRowIds: [],
    
    // Double-click detection
    lastClickRowId: null,
    lastClickTime: 0,
    doubleClickThreshold: 400, // 800ms for longer double-click window
    
    // Columns config
    columnsOrder: ['name', 'size', 'modified'],
    columnsSize: {
      name: { width: 300, minWidth: 150, resizable: true },
      size: { width: 120, minWidth: 80, resizable: true },
      modified: { width: 180, minWidth: 120, resizable: true }
    },
    
    // Computed
    get rows() {
      return this.itemsOrder.map(id => ({ id }));
    },
    
    get selectedItems() {
      return this.selectedRowIds.map(id => this.itemsById.get(id)).filter(Boolean);
    },
    
    // Actions
    async navigateToPath(path) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await fetch(
          `${serverUrl}/file_access_point/${encodeURIComponent(fileAccessPointId)}/files/?path=${encodeURIComponent(path)}&page=0&pageSize=1000`
        );
        const result = await response.json();
        
        if (result.code === 0) {
          runInAction(() => {
            this.currentPath = path;
            this.itemsById.clear();
            this.itemsOrder = [];
            
            result.data.forEach(item => {
              const itemId = item.id || item.path;
              const isDirectory = item.isDirectory || item.directory;
              
              this.itemsById.set(itemId, {
                id: itemId,
                name: item.name,
                path: item.path || itemId,
                type: isDirectory ? 'folder' : 'file',
                size: item.size,
                lastModified: item.lastModified,
                isDirectory
              });
              this.itemsOrder.push(itemId);
            });
            
            this.loading = false;
          });
        } else {
          runInAction(() => {
            this.error = { message: result.message || 'Failed to load items' };
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
    
    async refresh() {
      await this.navigateToPath(this.currentPath);
    },
    
    navigateUp() {
      if (this.currentPath === '/' || this.currentPath === '') return;
      const parentPath = this.currentPath.split('/').slice(0, -1).join('/') || '/';
      this.navigateToPath(parentPath);
    },
    
    getRowData(rowId, columnId) {
      const item = this.itemsById.get(rowId);
      if (!item) return null;
      
      if (columnId === 'name') return item.name;
      if (columnId === 'size') {
        if (item.type === 'folder') return '--';
        if (item.size === undefined || item.size === null) return '-';
        return formatFileSize(item.size);
      }
      if (columnId === 'modified') {
        return item.lastModified ? formatTimestamp(item.lastModified) : '-';
      }
      return null;
    },
    
    handleRowInteraction(event) {
      const { type, rowId, modifiers } = event;
      const item = this.itemsById.get(rowId);
      if (!item) return;
      
      if (type === 'double-click') {
        // Native double-click event - also navigate into folder
        if (item.type === 'folder') {
          this.navigateToPath(item.path);
          this.selectedRowIds = [];
        }
        return;
      }
      
      if (type === 'click') {
        // Custom double-click detection with longer threshold
        const now = Date.now();
        const isDoubleClick = 
          this.lastClickRowId === rowId && 
          (now - this.lastClickTime) <= this.doubleClickThreshold;
        
        if (isDoubleClick) {
          // Double-click detected - navigate into folder
          if (item.type === 'folder') {
            this.navigateToPath(item.path);
            this.selectedRowIds = [];
          }
          // Reset double-click tracking
          this.lastClickRowId = null;
          this.lastClickTime = 0;
          return;
        }
        
        // Record this click for double-click detection
        this.lastClickRowId = rowId;
        this.lastClickTime = now;
        // Selection validation
        if (!selectionConfig.allowedTypes.includes(item.type)) {
          console.log(`Cannot select ${item.type}, only ${selectionConfig.allowedTypes.join(', ')} allowed`);
          return;
        }
        
        // Check type compatibility if mixed not allowed
        if (selectionConfig.mode === 'multiple' && !selectionConfig.allowMixed && this.selectedRowIds.length > 0) {
          const firstSelectedId = this.selectedRowIds[0];
          const firstSelectedItem = this.itemsById.get(firstSelectedId);
          if (firstSelectedItem && firstSelectedItem.type !== item.type) {
            console.log(`Cannot mix types: already selected ${firstSelectedItem.type}, trying to select ${item.type}`);
            return;
          }
        }
        
        // Selection logic
        if (selectionConfig.mode === 'single') {
          // Toggle selection
          if (this.selectedRowIds.includes(rowId)) {
            this.selectedRowIds = [];
          } else {
            this.selectedRowIds = [rowId];
          }
        } else if (selectionConfig.mode === 'multiple') {
          if (modifiers.ctrl || modifiers.meta) {
            // Ctrl: toggle
            if (this.selectedRowIds.includes(rowId)) {
              this.selectedRowIds = this.selectedRowIds.filter(id => id !== rowId);
            } else {
              this.selectedRowIds.push(rowId);
            }
          } else if (modifiers.shift && this.selectedRowIds.length > 0) {
            // Shift: range selection
            const lastSelectedId = this.selectedRowIds[this.selectedRowIds.length - 1];
            const lastIndex = this.itemsOrder.indexOf(lastSelectedId);
            const currentIndex = this.itemsOrder.indexOf(rowId);
            const start = Math.min(lastIndex, currentIndex);
            const end = Math.max(lastIndex, currentIndex);
            
            const rangeIds = this.itemsOrder.slice(start, end + 1).filter(id => {
              const rangeItem = this.itemsById.get(id);
              return rangeItem && selectionConfig.allowedTypes.includes(rangeItem.type);
            });
            
            // Add range to selection (union)
            const newSelection = [...new Set([...this.selectedRowIds, ...rangeIds])];
            this.selectedRowIds = newSelection;
          } else {
            // No modifier: replace selection
            this.selectedRowIds = [rowId];
          }
        }
      }
    },
    
    clearSelection() {
      this.selectedRowIds = [];
    }
  }));
  
  // Initial load
  useEffect(() => {
    store.navigateToPath(initialPath);
  }, [fileAccessPointId, initialPath]);
  
  // Helper functions
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };
  
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm(store.selectedItems);
    }
  };
  
  const handleDataChangeRequest = (type, params) => {
    if (type === 'reorder' && params.columnId) {
      store.columnsOrder = params.newOrder;
    }
  };
  
  // Custom component for name column (with folder icon)
  const NameCellComponent = observer(({ data, rowId }) => {
    const item = store.itemsById.get(rowId);
    if (!item) return <span>{data}</span>;
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {item.type === 'folder' && (
          <FolderIcon width={16} height={16} color="#F7B64C" />
        )}
        {item.type === 'file' && (
          <span style={{ fontSize: '14px' }}>📄</span>
        )}
        <span>{data}</span>
      </div>
    );
  });
  
  const getBodyComponent = (columnId, rowId) => {
    if (columnId === 'name') {
      return NameCellComponent;
    }
    return undefined;
  };
  
  const columns = {
    name: { data: 'Name', align: 'left' },
    size: { data: 'Size', align: 'left' },
    modified: { data: 'Modified', align: 'left' }
  };
  
  // Path segments for breadcrumb
  const pathSegments = store.currentPath === '/' ? [] : store.currentPath.split('/').filter(Boolean);
  
  // Expose refresh method via ref
  useImperativeHandle(ref, () => ({
    refresh: () => store.refresh()
  }));
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      backgroundColor: '#fff'
    }}>
      {/* Title */}
      {showTitle && (
        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
          Select {selectionConfig.allowedTypes.join('/')}
        </div>
      )}
      
      {/* Path navigation */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        padding: '6px',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px'
      }}>
        <button
          onClick={() => store.navigateUp()}
          disabled={store.currentPath === '/' || store.loading}
          style={{
            padding: '4px 6px 4px 4px',
            fontSize: '12px',
            backgroundColor: store.currentPath === '/' ? '#e0e0e0' : '#fff',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: store.currentPath === '/' || store.loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '2px'
          }}
        >
          <UpIcon width={16} height={16} />
          Up
        </button>
        <div style={{ fontSize: '12px', color: '#666' }}>
          <span style={{ fontWeight: 'bold' }}>Path:</span>{' '}
          <span style={{ fontFamily: 'monospace' }}>
            {store.currentPath || '/'}
          </span>
        </div>
      </div>
      
      {/* Error display */}
      {store.error && (
        <div style={{
          padding: '8px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#c00'
        }}>
          {store.error.message}
        </div>
      )}
      
      {/* File/folder list */}
      <FolderView
        columns={columns}
        columnsOrder={store.columnsOrder}
        columnsSizeInit={store.columnsSize}
        rows={store.rows}
        dataStore={store}
        getRowData={(rowId, colId) => store.getRowData(rowId, colId)}
        getBodyComponent={getBodyComponent}
        selectedRowIds={store.selectedRowIds}
        selectionMode={selectionConfig.mode}
        onRowInteraction={(event) => store.handleRowInteraction(event)}
        allowColumnReorder={true}
        onDataChangeRequest={handleDataChangeRequest}
        showStatusBar={true}
        loading={store.loading}
        loadingMessage="Loading items..."
        error={store.error}
        bodyHeight={height}
      />
      
      {/* Selection info */}
      <div style={{ 
        fontSize: '12px', 
        color: '#666',
        padding: '6px',
        backgroundColor: '#f9f9f9',
        borderRadius: '4px'
      }}>
        <strong>Selected:</strong> {store.selectedRowIds.length > 0
          ? store.selectedItems.map(item => item.name).join(', ')
          : 'None'}
      </div>
      
      {/* Action buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        justifyContent: 'flex-end',
        paddingTop: '8px',
        borderTop: '1px solid #e0e0e0'
      }}>
        <button
          onClick={onCancel}
          style={{
            padding: '6px 16px',
            fontSize: '13px',
            backgroundColor: '#999',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={store.selectedRowIds.length === 0}
          style={{
            padding: '6px 16px',
            fontSize: '13px',
            backgroundColor: store.selectedRowIds.length === 0 ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: store.selectedRowIds.length === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          OK ({store.selectedRowIds.length})
        </button>
      </div>
    </div>
  );
}));

export default ItemSelector;
