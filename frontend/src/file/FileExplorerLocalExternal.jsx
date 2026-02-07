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
 * FileExplorerLocalExternal - File browser using FolderView for local/external file access points
 * 
 * @param {Object} fileAccessPoint - The file access point configuration
 */
const FileExplorerLocalExternal = observer(({ fileAccessPoint }) => {
  const [explorerState] = useState(() => makeAutoObservable({
    files: [],
    loading: false,
    error: null,
    currentPath: '',
    page: 0,
    selectedFileId: null,
    viewingFile: null,
    menuFile: null,
    menuPosition: { x: 0, y: 0 },
    columnsOrder: ['name', 'size', 'modified'],
    columnsSize: {
      name: { width: 300, minWidth: 200, resizable: true },
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
  const loadFiles = useCallback(async (pathToLoad = explorerState.currentPath, pageNum = 0) => {
    runInAction(() => {
      explorerState.loading = true;
      explorerState.error = null;
    });

    try {
      const result = await fetchFileList(fileAccessPoint.id, pathToLoad, pageNum, pageSize);

      runInAction(() => {
        if (result.code === 0) {
          explorerState.files = result.data;
          explorerState.page = pageNum;
          explorerState.currentPath = pathToLoad;
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
    const isDirectory = file.isDirectory || file.directory;
    
    return {
      id: fileId,
      data: {
        name: file.name,
        size: isDirectory ? '--' : (file.size >= 0 ? formatFileSize(file.size) : '-'),
        modified: formatTimestamp(file.lastModified),
        isDirectory: isDirectory,
        file: file // Store original file object
      }
    };
  });

  // Handle row click (navigate directories or select files)
  const handleRowClick = (rowId) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    if (row.data.isDirectory) {
      // Navigate into directory
      loadFiles(row.data.file.path, 0);
    } else {
      // Select file
      runInAction(() => {
        explorerState.selectedFileId = rowId;
      });
    }
  };

  // Handle row right-click
  const handleRowRightClick = (event, rowId) => {
    event.preventDefault();
    event.stopPropagation();
    
    const row = rows.find(r => r.id === rowId);
    if (!row || row.data.isDirectory) return;

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
      // Find which row was clicked by matching the element
      const clickedRow = rows.find((row) => {
        const nameCell = rowElement.querySelector('.file-explorer-file-name-cell');
        return nameCell && nameCell.textContent.includes(row.data.name);
      });
      
      if (clickedRow && !clickedRow.data.isDirectory) {
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
        // Clicked on directory or outside files - just close menu
        runInAction(() => {
          explorerState.menuFile = null;
        });
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

  // Navigate up one level
  const handleNavigateUp = () => {
    if (!explorerState.currentPath) return;
    
    const parts = explorerState.currentPath.split('/').filter(p => p);
    parts.pop();
    const parentPath = parts.join('/');
    loadFiles(parentPath, 0);
  };

  // Custom header component to show current path and navigation
  const getHeaderComponent = (colId) => {
    if (colId === 'name') {
      return () => (
        <div className="file-explorer-header-nav">
          {explorerState.currentPath && (
            <button
              onClick={handleNavigateUp}
              className="file-explorer-up-button"
              title="Go up one level"
            >
              ↑ Up
            </button>
          )}
          <span>Name {explorerState.currentPath && `(/${explorerState.currentPath})`}</span>
        </div>
      );
    }
    return null;
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
          <span className="file-explorer-file-icon">
            {row.data.isDirectory ? '📁' : '📄'}
          </span>
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

  return (
    <div className="file-explorer-wrapper">
      <FolderView
        columns={columns}
        columnsOrder={explorerState.columnsOrder}
        columnsSizeInit={explorerState.columnsSize}
        rows={rows}
        getHeaderComponent={getHeaderComponent}
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

export default FileExplorerLocalExternal;
