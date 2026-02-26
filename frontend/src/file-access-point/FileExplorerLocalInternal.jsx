import React, { useState, useEffect, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { makeAutoObservable, runInAction } from 'mobx';
import { FolderView, SpinningCircle } from '@wwf971/react-comp-misc';
import fileStore, { fetchFileList, renameFile } from './fileStore';
import { formatTimestamp, formatFileSize } from './fileUtils';
import { getBackendServerUrl } from '../remote/backendServerStore';
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
    fileSelectedId: null,
    viewingFile: null,
    menuRowId: null,
    menuPosition: { x: 0, y: 0 },
    columnsOrder: ['name', 'size', 'modified'],
    columnsSize: {
      name: { width: 400, minWidth: 200, resizable: true },
      size: { width: 120, minWidth: 80, resizable: true },
      modified: { width: 200, minWidth: 150, resizable: true }
    },
    // Rename state
    renamingFileId: null,
    isRenamingInProgress: false,
    renameStatus: null,
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

    runInAction(() => {
      explorerState.fileSelectedId = rowId;
    });
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
    const rowEl = clickedElement?.closest('[data-row-id]');
    
    if (rowEl) {
      const clickedRowId = rowEl.getAttribute('data-row-id');
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
        // Show error
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
          <span className="file-explorer-file-icon">📄</span>
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

export default FileExplorerLocalInternal;
