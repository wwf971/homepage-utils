import React, { useState, useEffect, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { makeAutoObservable, runInAction } from 'mobx';
import { FolderView } from '@wwf971/react-comp-misc';
import fileStore, { fetchFileList } from './fileStore';
import { formatTimestamp, formatFileSize } from './fileUtils';
import FileView from './FileView';
import FileMenu from './FileMenu';
import './file.css';


/**
 * FileExplorerLocalInternal - File browser using FolderView for local/internal file access points
 * 
 * @param {Object} fileAccessPoint - The file access point configuration
 */
const FileExplorerLocalInternal = observer(({ fileAccessPoint }) => {
  const [explorerState] = useState(() => makeAutoObservable({
    files: [],
    loading: false,
    error: null,
    page: 0,
    pageInput: '1',
    hasMore: true,
    totalCount: 0,
    selectedFileId: null,
    viewingFile: null,
    menuFile: null,
    menuPosition: { x: 0, y: 0 },
    columnsOrder: ['name', 'size', 'modified'],
    columnsSize: {
      name: { width: 400, minWidth: 200, resizable: true },
      size: { width: 120, minWidth: 80, resizable: true },
      modified: { width: 200, minWidth: 150, resizable: true }
    }
  }));
  const pageSize = 50;

  // Define columns for FolderView
  const columns = {
    name: { data: 'Name', align: 'left' },
    size: { data: 'Size', align: 'left' },
    modified: { data: 'Modified', align: 'left' }
  };

  // Load files
  const loadFiles = useCallback(async (pageNum = 0) => {
    runInAction(() => {
      explorerState.loading = true;
      explorerState.error = null;
    });

    try {
      // local/internal doesn't have path navigation, just list all files
      const result = await fetchFileList(fileAccessPoint.id, '', pageNum, pageSize);

      runInAction(() => {
        if (result.code === 0) {
          explorerState.files = result.data;
          explorerState.page = pageNum;
          explorerState.pageInput = String(pageNum + 1);
          explorerState.hasMore = result.data.length === pageSize;
          // Update total count estimate
          if (result.data.length < pageSize) {
            explorerState.totalCount = pageNum * pageSize + result.data.length;
          } else {
            explorerState.totalCount = (pageNum + 1) * pageSize; // Estimate, more might exist
          }
        } else {
          explorerState.error = { message: result.message || 'Failed to load files' };
        }
        explorerState.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        explorerState.error = { message: err.message || 'Network error' };
        explorerState.loading = false;
      });
    }
  }, [fileAccessPoint.id, explorerState]);

  // Initial load
  useEffect(() => {
    loadFiles();
  }, [fileAccessPoint.id]);

  // Convert files to FolderView rows format
  const rows = explorerState.files.map((file, idx) => {
    const fileId = file.id || file.path;
    
    return {
      id: fileId,
      data: {
        name: file.name,
        size: file.size >= 0 ? formatFileSize(file.size) : '-',
        modified: formatTimestamp(file.lastModified),
        file: file // Store original file object
      }
    };
  });

  // Handle row click (select file)
  const handleRowClick = (rowId) => {
    runInAction(() => {
      explorerState.selectedFileId = rowId;
    });
  };

  // Handle row right-click
  const handleRowRightClick = (event, rowId) => {
    event.preventDefault();
    event.stopPropagation();
    
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    // Close existing menu first
    runInAction(() => {
      explorerState.menuFile = null;
    });

    // Use requestAnimationFrame to ensure React completes unmount before remounting
    requestAnimationFrame(() => {
      runInAction(() => {
        explorerState.menuFile = row.data.file;
        explorerState.menuPosition = { x: event.clientX, y: event.clientY };
      });
    });
  };

  // Handle backdrop right-click (for repositioning menu when clicking on another file while menu is open)
  const handleBackdropContextMenu = (e) => {
    e.preventDefault();
    
    // Temporarily hide backdrop to find element underneath
    const backdrop = e.currentTarget;
    backdrop.style.pointerEvents = 'none';
    const clickedElement = document.elementFromPoint(e.clientX, e.clientY);
    backdrop.style.pointerEvents = '';
    
    // Find the file row element
    const rowElement = clickedElement?.closest('.folder-body-row');
    
    if (rowElement) {
      // Get the row data
      const rowCells = rowElement.querySelectorAll('.folder-body-cell');
      if (rowCells.length > 0) {
        // Find which row was clicked by matching the element
        const clickedRow = rows.find((row) => {
          // Check if any cell content matches
          const nameCell = rowElement.querySelector('.file-explorer-file-name-cell');
          return nameCell && nameCell.textContent.includes(row.data.name);
        });
        
        if (clickedRow) {
          // Close existing menu first
          runInAction(() => {
            explorerState.menuFile = null;
          });
          
          // Use requestAnimationFrame to ensure React completes unmount before remounting
          requestAnimationFrame(() => {
            runInAction(() => {
              explorerState.menuFile = clickedRow.data.file;
              explorerState.menuPosition = { x: e.clientX, y: e.clientY };
            });
          });
        } else {
          // Clicked outside files - just close menu
          runInAction(() => {
            explorerState.menuFile = null;
          });
        }
      }
    } else {
      // Clicked outside files - just close menu
      runInAction(() => {
        explorerState.menuFile = null;
      });
    }
  };

  // File operations
  const handleDownload = (file) => {
    const fileId = file.id || file.path;
    const encodedFileId = fileId.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const url = `/file_access_point/${encodeURIComponent(fileAccessPoint.id)}/${encodedFileId}?action=download`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShow = (file) => {
    runInAction(() => {
      explorerState.viewingFile = file;
    });
  };

  const handleRenameStart = (file) => {
    // TODO: Implement inline rename or dialog
    console.log('Rename:', file.name);
  };

  const handleFileUpdate = (updatedFile) => {
    runInAction(() => {
      explorerState.files = explorerState.files.map(f => {
        const fId = f.id || f.path;
        const updatedId = updatedFile.id || updatedFile.path;
        return fId === updatedId ? { ...f, ...updatedFile } : f;
      });
    });
  };

  // Custom body component for file icons and styling
  const getBodyComponent = (colId, rowId) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return null;

    if (colId === 'name') {
      return () => (
        <div 
          className="file-explorer-file-name-cell"
          onContextMenu={(e) => handleRowRightClick(e, rowId)}
        >
          <span className="file-explorer-file-icon">📄</span>
          <span>{row.data.name}</span>
        </div>
      );
    }
    
    return null;
  };

  // Handle data change requests from FolderView (column reorder, resize, etc.)
  const handleDataChangeRequest = (type, params) => {
    if (type === 'reorder' && params.columnId) {
      // Column reorder - update the order
      explorerState.columnsOrder.replace(params.newOrder);
    }
    // Note: We don't persist column widths - they're managed internally by FolderView
  };

  // Pagination handlers
  const handleNextPage = () => {
    if (!explorerState.hasMore || explorerState.loading) return;
    loadFiles(explorerState.page + 1);
  };

  const handlePrevPage = () => {
    if (explorerState.page === 0 || explorerState.loading) return;
    loadFiles(explorerState.page - 1);
  };

  const handlePageInputChange = (e) => {
    const value = e.target.value;
    // Allow empty or valid numbers
    if (value === '' || /^\d+$/.test(value)) {
      runInAction(() => {
        explorerState.pageInput = value;
      });
    }
  };

  const handlePageInputSubmit = (e) => {
    e.preventDefault();
    const pageNum = parseInt(explorerState.pageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1) {
      // Convert to 0-based index
      loadFiles(pageNum - 1);
    }
  };

  const handlePageInputBlur = () => {
    // Reset input to current page on blur
    runInAction(() => {
      explorerState.pageInput = String(explorerState.page + 1);
    });
  };

  // Pagination bar info
  const startIndex = explorerState.page * pageSize + 1;
  const endIndex = explorerState.page * pageSize + explorerState.files.length;
  const showTotalCount = !explorerState.hasMore ? explorerState.totalCount : `${explorerState.totalCount}+`;

  return (
    <div className="file-explorer-wrapper">
      {/* Pagination Bar */}
      <div className="file-explorer-pagination-bar">
        <div className="file-explorer-pagination-controls">
          <button
            onClick={handlePrevPage}
            disabled={explorerState.page === 0 || explorerState.loading}
            className="file-explorer-page-nav-button"
            title="Previous page"
          >
            ← Previous
          </button>
          <form onSubmit={handlePageInputSubmit} className="file-explorer-page-input-form">
            <span className="file-explorer-page-label">Page</span>
            <input
              type="text"
              value={explorerState.pageInput}
              onChange={handlePageInputChange}
              onBlur={handlePageInputBlur}
              disabled={explorerState.loading}
              className="file-explorer-page-input"
              title="Enter page number and press Enter"
            />
            <button
              type="submit"
              className="file-explorer-page-go-button"
              title="Go to page"
            >
              Go
            </button>
          </form>
          <button
            onClick={handleNextPage}
            disabled={!explorerState.hasMore || explorerState.loading}
            className="file-explorer-page-nav-button"
            title="Next page"
          >
            Next →
          </button>
        </div>
        <span className="file-explorer-page-info">
          {explorerState.files.length > 0 ? `Showing ${startIndex}-${endIndex} of ${showTotalCount} files` : 'No files'}
        </span>
      </div>

      {/* File Table */}
      <FolderView
        columns={columns}
        columnsOrder={explorerState.columnsOrder}
        columnsSizeInit={explorerState.columnsSize}
        rows={rows}
        getBodyComponent={getBodyComponent}
        onRowClick={handleRowClick}
        selectedRowId={explorerState.selectedFileId}
        allowColumnReorder={true}
        onDataChangeRequest={handleDataChangeRequest}
        showStatusBar={true}
        loading={explorerState.loading}
        loadingMessage="Loading files..."
        error={explorerState.error}
        bodyHeight={Math.min(rows.length * 32 + 40, 500)}
      />

      {explorerState.menuFile && (
        <FileMenu
          file={explorerState.menuFile}
          position={explorerState.menuPosition}
          onClose={() => runInAction(() => explorerState.menuFile = null)}
          onDownload={handleDownload}
          onShow={handleShow}
          onRename={handleRenameStart}
          onContextMenu={handleBackdropContextMenu}
        />
      )}

      {explorerState.viewingFile && (
        <FileView
          file={explorerState.viewingFile}
          fileAccessPointId={fileAccessPoint.id}
          onClose={() => runInAction(() => explorerState.viewingFile = null)}
          onFileUpdate={handleFileUpdate}
        />
      )}
    </div>
  );
});

export default FileExplorerLocalInternal;
