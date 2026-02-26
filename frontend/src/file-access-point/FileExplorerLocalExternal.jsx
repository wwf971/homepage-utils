import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { makeAutoObservable, runInAction } from 'mobx';
import { FolderView, PathBar, UpIcon, SpinningCircle } from '@wwf971/react-comp-misc';
import fileStore, { fetchFileList, renameFile } from './fileStore';
import { formatTimestamp, formatFileSize } from './fileUtils';
import { getBackendServerUrl } from '../remote/backendServerStore';
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
    fileSelectedId: null,
    viewingFile: null,
    menuRowId: null,
    menuPosition: { x: 0, y: 0 },
    columnsOrder: ['name', 'size', 'modified'],
    columnsSize: {
      name: { width: 300, minWidth: 200, resizable: true },
      size: { width: 120, minWidth: 80, resizable: true },
      modified: { width: 200, minWidth: 150, resizable: true }
    },
    // Rename state
    renamingFileId: null,
    isRenamingInProgress: false,
    renameStatus: null, // { type: 'success' | 'error', message: string }
    renameInitialized: false
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

  // Handle row click (select only)
  const handleRowClick = (rowId) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    // If currently renaming any row (including this one), blur it to submit/cancel the edit
    if (explorerState.renamingFileId) {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.classList.contains('file-name-editable')) {
        activeEl.blur();
        // Wait for blur to process before selecting new row
        setTimeout(() => {
          runInAction(() => {
            explorerState.fileSelectedId = rowId;
          });
        }, 0);
        return;
      }
      // Recover from stale rename state only when user moved to a different row.
      if (explorerState.renamingFileId !== rowId) {
        handleRenameCancel();
      }
    }

    // Select file or folder
    runInAction(() => {
      explorerState.fileSelectedId = rowId;
    });
  };

  // Handle row double click (navigate directories)
  const handleRowDoubleClick = (rowId) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    if (row.data.isDirectory) {
      // Navigate into directory
      loadFiles(row.data.file.path, 0);
    }
  };

  // Handle row right-click
  const handleRowRightClick = (event, rowId) => {
    event.preventDefault();
    event.stopPropagation();
    
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    // If in rename mode, check if we need to exit it
    if (explorerState.renamingFileId) {
      const activeEl = document.activeElement;
      const hasActiveEditable = activeEl && activeEl.classList.contains('file-name-editable');
      
      if (explorerState.renamingFileId !== rowId) {
        // Different row - cancel rename
        if (hasActiveEditable) {
          activeEl.blur();
        } else {
          handleRenameCancel();
        }
      } else if (!hasActiveEditable) {
        // Same row but no active editable - force cancel stale state
        handleRenameCancel();
      }
    }

    // Select the row and open menu atomically
    runInAction(() => {
      explorerState.fileSelectedId = rowId;
      explorerState.menuRowId = rowId;
      explorerState.menuPosition = { x: event.clientX, y: event.clientY };
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
    const rowElement = clickedElement?.closest('[data-row-id]');
    
    if (rowElement) {
      const clickedRowId = rowElement.getAttribute('data-row-id');
      const clickedRow = rows.find(r => String(r.id) === String(clickedRowId));
      
      if (clickedRow) {
        
        // If in rename mode, check if we need to exit it
        if (explorerState.renamingFileId) {
          const activeEl = document.activeElement;
          const hasActiveEditable = activeEl && activeEl.classList.contains('file-name-editable');
          
          if (explorerState.renamingFileId !== clickedRow.id) {
            // Different row - cancel rename
            if (hasActiveEditable) {
              activeEl.blur();
            } else {
              handleRenameCancel();
            }
          } else if (!hasActiveEditable) {
            // Same row but no active editable - force cancel stale state
            handleRenameCancel();
          }
        }
        
        // Select the row and open menu atomically
        runInAction(() => {
          explorerState.fileSelectedId = clickedRow.id;
          explorerState.menuRowId = clickedRow.id;
          explorerState.menuPosition = { x: e.clientX, y: e.clientY };
        });
      } else {
        // Clicked outside files - just close menu
        runInAction(() => {
          explorerState.menuRowId = null;
        });
      }
    } else {
      // Clicked outside files - just close menu
      runInAction(() => {
        explorerState.menuRowId = null;
      });
    }
  };

  // File operations
  const handleDownload = async (file) => {
    const fileId = file.id || file.path;
    const encodedFileId = fileId.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const backendUrl = getBackendServerUrl();
    const url = `${backendUrl}/file_access_point/${encodeURIComponent(fileAccessPoint.id)}/${encodedFileId}?action=download`;
    
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL after a short delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };

  const handleShow = (file) => {
    runInAction(() => {
      explorerState.viewingFile = file;
    });
  };

  const handleOpenInNewTab = (file) => {
    const fileId = file.id || file.path;
    const encodedFileId = fileId.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const backendUrl = getBackendServerUrl();
    const url = `${backendUrl}/file_access_point/${encodeURIComponent(fileAccessPoint.id)}/${encodedFileId}`;
    
    window.open(url, '_blank');
  };

  const handleRenameStart = (file) => {
    // Use the currently selected row ID instead of the file object's ID
    // This ensures we rename the correct row even if there's a timing issue with menu updates
    const fileId = explorerState.fileSelectedId;
    
    runInAction(() => {
      explorerState.renamingFileId = fileId;
      explorerState.renameStatus = null;
      explorerState.renameInitialized = false;
    });
  };

  const handleRenameSubmit = async (fileId, newName, originalName) => {
    runInAction(() => {
      explorerState.isRenamingInProgress = true;
      explorerState.renameStatus = null;
    });

    try {
      const result = await renameFile(fileAccessPoint.id, fileId, newName);
      
      if (result.code === 0) {
        // Update file list with new name
        runInAction(() => {
          explorerState.files = explorerState.files.map(f => {
            const fId = f.id || f.path;
            return fId === fileId ? { ...f, name: newName } : f;
          });
          explorerState.renameStatus = { type: 'success', message: 'Renamed' };
        });

        // Clear status after 500ms
        setTimeout(() => {
          runInAction(() => {
            explorerState.renamingFileId = null;
            explorerState.renameStatus = null;
            explorerState.renameInitialized = false;
          });
        }, 500);
      } else {
        // Show error and revert
        runInAction(() => {
          explorerState.renameStatus = { type: 'error', message: result.message || 'Failed' };
        });

        // Clear error and reset after 500ms
        setTimeout(() => {
          runInAction(() => {
            explorerState.renamingFileId = null;
            explorerState.renameStatus = null;
            explorerState.renameInitialized = false;
          });
        }, 500);
      }
    } catch (error) {
      runInAction(() => {
        explorerState.renameStatus = { type: 'error', message: 'Network error' };
      });

      setTimeout(() => {
        runInAction(() => {
          explorerState.renamingFileId = null;
          explorerState.renameStatus = null;
          explorerState.renameInitialized = false;
        });
      }, 500);
    } finally {
      runInAction(() => {
        explorerState.isRenamingInProgress = false;
      });
    }
  };

  const handleRenameCancel = () => {
    runInAction(() => {
      explorerState.renamingFileId = null;
      explorerState.renameStatus = null;
      explorerState.renameInitialized = false;
    });
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

  // Handle path segment click (navigate to that level)
  const handlePathSegClick = (segmentIndex) => {
    const parts = explorerState.currentPath.split('/').filter(p => p);
    const targetPath = parts.slice(0, segmentIndex + 1).join('/');
    loadFiles(targetPath, 0);
  };

  // Convert current path to segments for PathBar
  const pathSegments = useMemo(() => {
    if (!explorerState.currentPath) return [];
    const parts = explorerState.currentPath.split('/').filter(p => p);
    return parts.map((name, index) => ({ name, id: `seg-${index}` }));
  }, [explorerState.currentPath]);

  // No custom header component needed anymore
  const getHeaderComponent = (colId) => {
    return null;
  };

  // Custom body component for file icons and styling
  const getBodyComponent = (colId, rowId) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return null;

    if (colId === 'name') {
      const isRenaming = explorerState.renamingFileId === rowId;
      
      return () => (
        <div 
          className="file-explorer-file-name-cell"
        >
          <span className="file-explorer-file-icon">
            {row.data.isDirectory ? '📁' : '📄'}
          </span>
          {isRenaming ? (
            <span className="file-name-rename-wrapper">
              <span
                className="file-name-editable"
                contentEditable={!explorerState.isRenamingInProgress}
                suppressContentEditableWarning
                onBlur={(e) => {
                  if (explorerState.isRenamingInProgress || explorerState.renameStatus) return;
                  
                  const newName = e.target.textContent?.trim() || '';
                  if (newName && newName !== row.data.name) {
                    handleRenameSubmit(rowId, newName, row.data.name);
                  } else {
                    handleRenameCancel();
                  }
                }}
                onKeyDown={(e) => {
                  if (explorerState.isRenamingInProgress) {
                    e.preventDefault();
                    return;
                  }
                  
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleRenameCancel();
                  }
                }}
                ref={(el) => {
                  if (el && isRenaming && !explorerState.isRenamingInProgress && !explorerState.renameStatus && !explorerState.renameInitialized) {
                    el.textContent = row.data.name;
                    
                    // Trigger a click to ensure browser sets up focus state properly
                    el.click();
                    
                    // Select all text after click is processed
                    requestAnimationFrame(() => {
                      const range = document.createRange();
                      const sel = window.getSelection();
                      const textNode = el.firstChild;
                      
                      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                        range.selectNodeContents(el);
                        sel?.removeAllRanges();
                        sel?.addRange(range);
                      }
                    });
                    
                    runInAction(() => {
                      explorerState.renameInitialized = true;
                    });
                  }
                }}
              >
                {row.data.name}
              </span>
              {explorerState.isRenamingInProgress && (
                <span className="file-rename-status">
                  <SpinningCircle width={14} height={14} />
                </span>
              )}
              {explorerState.renameStatus && (
                <span className={`file-rename-status ${explorerState.renameStatus.type}`}>
                  {explorerState.renameStatus.message}
                </span>
              )}
            </span>
          ) : (
            <span>{row.data.name}</span>
          )}
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
      {/* Navigation Bar */}
      <div className="file-explorer-nav-bar">
        <div className="file-explorer-nav-controls">
          <button
            onClick={handleNavigateUp}
            disabled={!explorerState.currentPath || explorerState.loading}
            className="file-explorer-nav-button"
            title="Go up one level"
          >
            <UpIcon width={16} height={16} />
          </button>
        </div>
        <PathBar
          pathData={{ segments: pathSegments }}
          onPathSegClicked={handlePathSegClick}
          addSlashBeforeFirstSeg={true}
          allowEditText={false}
          height={26}
        />
      </div>

      {/* File Table */}
      <FolderView
        columns={columns}
        columnsOrder={explorerState.columnsOrder}
        columnsSizeInit={explorerState.columnsSize}
        rows={rows}
        getHeaderComponent={getHeaderComponent}
        getBodyComponent={getBodyComponent}
        onRowClick={handleRowClick}
        onRowDoubleClick={handleRowDoubleClick}
        onRowContextMenu={handleRowRightClick}
        selectedRowId={explorerState.fileSelectedId}
        allowColumnReorder={true}
        onDataChangeRequest={handleDataChangeRequest}
        showStatusBar={true}
        loading={explorerState.loading}
        loadingMessage="Loading files..."
        error={explorerState.error}
        bodyHeight={Math.min(rows.length * 32 + 40, 500)}
      />

      {explorerState.menuRowId && (() => {
        const menuRow = rows.find(r => r.id === explorerState.menuRowId);
        if (!menuRow) return null;
        return (
          <FileMenu
            file={menuRow.data.file}
            position={explorerState.menuPosition}
            onClose={() => runInAction(() => explorerState.menuRowId = null)}
            onDownload={handleDownload}
            onShow={handleShow}
            onOpenInNewTab={handleOpenInNewTab}
            onRename={handleRenameStart}
            onContextMenu={handleBackdropContextMenu}
          />
        );
      })()}

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
