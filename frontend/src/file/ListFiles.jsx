import React, { useState, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { SpinningCircle, RefreshIcon } from '@wwf971/react-comp-misc';
import { formatTimestamp, formatFileSize } from './fileUtils';
import { fileCacheAtom, getCachedFile, fetchFileList, renameFile } from './fileStore';
import FileMenu from './FileMenu';
import FileView from './FileView';
import './file.css';

/**
 * ListFiles - Component for listing files in a file access point
 * 
 * @param {Object} fileAccessPoint - The file access point object
 * @param {Object} tabsState - Tab state object from TabsOnTop {tabKey: {clickCount, isFocused}}
 * @param {string} tabKey - The tab key this component belongs to
 */
const ListFiles = ({ fileAccessPoint, tabsState, tabKey }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [menuFile, setMenuFile] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [renamingFile, setRenamingFile] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingInProgress, setRenamingInProgress] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);
  const renameInputRef = useRef(null);
  const pageSize = 50;
  
  // Get unified file cache
  const [fileCache, setFileCache] = useAtom(fileCacheAtom);

  const settingType = fileAccessPoint?.content?.setting?.type || 'NOT SET';

  // Get this tab's state
  const myTabState = tabsState && tabKey ? tabsState[tabKey] : null;

  // Load files when tab is first clicked (clickCount changes from 0)
  useEffect(() => {
    if (myTabState && myTabState.clickCount > 0 && !hasLoaded) {
      console.log(`ListFiles: Tab ${tabKey} clicked (count: ${myTabState.clickCount}), loading files...`);
      loadFiles();
    }
  }, [myTabState?.clickCount, hasLoaded]);

  const loadFiles = async (pathToLoad = currentPath, pageNum = 0) => {
    // Check if type is supported
    if (settingType !== 'local/internal' && settingType !== 'local/external') {
      setError(`Type "${settingType}" not supported yet. Only "local/internal" and "local/external" are currently supported.`);
      setHasLoaded(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use the unified cache function from fileStore
      const result = await fetchFileList(fileAccessPoint.id, pathToLoad, pageNum, pageSize, setFileCache);

      if (result.code === 0) {
        setFiles(result.data);
        setHasMore(result.data.length === pageSize);
        setPage(pageNum);
        setCurrentPath(pathToLoad);
        setHasLoaded(true);
        // Update total count estimate
        if (result.data.length < pageSize) {
          setTotalCount(pageNum * pageSize + result.data.length);
        } else {
          setTotalCount((pageNum + 1) * pageSize); // Estimate, more might exist
        }
      } else {
        setError(result.message || 'Failed to load files');
        setHasLoaded(true);
      }
    } catch (err) {
      setError(err.message || 'Network error');
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadFiles(currentPath, page);
  };

  const handleNavigate = (file) => {
    if (file.isDirectory || file.directory) {
      loadFiles(file.path, 0);
    }
  };

  const handleNavigateUp = () => {
    if (!currentPath) return;
    
    const parts = currentPath.split('/').filter(p => p);
    parts.pop();
    const parentPath = parts.join('/');
    loadFiles(parentPath, 0);
  };

  const handleNextPage = () => {
    if (!hasMore || loading) return;
    loadFiles(currentPath, page + 1);
  };

  const handlePrevPage = () => {
    if (page === 0 || loading) return;
    loadFiles(currentPath, page - 1);
  };

  // Find file by checking data-file-index attribute
  const findFileFromTarget = (target) => {
    let element = target;
    // Traverse up to find the file row element
    while (element && element !== document.body) {
      if (element.dataset && element.dataset.fileIndex !== undefined) {
        const index = parseInt(element.dataset.fileIndex, 10);
        return { file: files[index], index };
      }
      element = element.parentElement;
    }
    return null;
  };

  const handleFileContextMenu = (e, file, index) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Don't show menu for directories
    if (file.isDirectory || file.directory) {
      return;
    }
    
    setMenuFile({ ...file, index });
    setMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const handleMenuBackdropContextMenu = (e) => {
    e.preventDefault();
    
    // Check if right-click landed on another file row
    const result = findFileFromTarget(e.target);
    if (result && result.file && !(result.file.isDirectory || result.file.directory)) {
      // Reposition menu to new file
      setMenuFile({ ...result.file, index: result.index });
      setMenuPosition({ x: e.clientX, y: e.clientY });
    } else {
      // Close menu if clicked elsewhere
      setMenuFile(null);
    }
  };

  const handleDownload = (file) => {
    // For local/internal, use the custom id field; for local/external, use the path
    const fileId = file.id || file.path;
    // Don't encode slashes in fileId for local/external types
    const encodedFileId = fileId.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const url = `/file_access_point/${encodeURIComponent(fileAccessPoint.id)}/${encodedFileId}?action=download`;
    
    // Open in new tab or trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShow = (file) => {
    setViewingFile(file);
  };
  
  const handleFileUpdate = (updatedFile) => {
    // Update the file in the local files array
    setFiles(prevFiles => 
      prevFiles.map(f => {
        const fId = f.id || f.path;
        const updatedId = updatedFile.id || updatedFile.path;
        return fId === updatedId ? { ...f, ...updatedFile } : f;
      })
    );
  };

  const handleRenameStart = (file) => {
    setRenamingFile(file);
    setRenameValue(file.name);
    // Focus will be handled in useEffect
  };

  // Focus rename input when renaming starts
  useEffect(() => {
    if (renamingFile && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingFile]);

  const handleRenameSubmit = async () => {
    if (!renamingFile || renameValue === renamingFile.name) {
      // No change, just cancel
      setRenamingFile(null);
      return;
    }

    if (!renameValue.trim()) {
      // Empty name, revert
      setRenamingFile(null);
      return;
    }

    setRenamingInProgress(true);

    try {
      // For local/internal, use the custom id field; for local/external, use the path
      const fileId = renamingFile.id || renamingFile.path;
      
      // Use the unified rename function from fileStore
      const result = await renameFile(fileAccessPoint.id, fileId, renameValue, setFileCache);

      if (result.code === 0) {
        // Success - update the file in the list
        setFiles(prevFiles => {
          const newFiles = [...prevFiles];
          const index = newFiles.findIndex(f => {
            const fId = f.id || f.path;
            const rId = renamingFile.id || renamingFile.path;
            return fId === rId;
          });
          if (index !== -1) {
            newFiles[index] = { ...newFiles[index], ...result.data };
          }
          return newFiles;
        });
        setRenamingFile(null);
      } else {
        console.error('Failed to rename file:', result.message);
        alert(`Failed to rename: ${result.message}`);
        setRenameValue(renamingFile.name); // Revert
      }
    } catch (err) {
      console.error('Error renaming file:', err);
      alert('Failed to rename file');
      setRenameValue(renamingFile.name); // Revert
    } finally {
      setRenamingInProgress(false);
      setRenamingFile(null);
    }
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setRenamingFile(null);
    }
  };

  // Get file size to display (from cache if available, otherwise from file object, or '-' if not available)
  const getFileSize = (file) => {
    if (file.isDirectory || file.directory) {
      return '--';
    }
    
    // Check cache first
    const fileId = file.id || file.path;
    const cachedFile = getCachedFile(fileCache, fileAccessPoint.id, fileId);
    
    // If cached and size has been fetched (>= 0), show it
    if (cachedFile && cachedFile.size >= 0) {
      return formatFileSize(cachedFile.size);
    }
    
    // Fall back to file.size if it has been fetched (>= 0)
    if (file.size >= 0) {
      return formatFileSize(file.size);
    }
    
    // Otherwise, show '-' to indicate not fetched (size is -1 or undefined/null)
    return '-';
  };


  if (loading && !hasLoaded) {
    return (
      <div className="files-list-container">
        <div className="loading">Loading files...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="files-list-container">
        <div className="files-list-toolbar">
          <button
            className="refresh-button"
            onClick={handleRefresh}
            disabled={loading}
            title="Retry loading files"
          >
            {loading ? (
              <SpinningCircle width={16} height={16} color="#666" />
            ) : (
              <RefreshIcon width={16} height={16} />
            )}
          </button>
        </div>
        <div className="error-message">
          {error}
        </div>
      </div>
    );
  }

  // Calculate display range
  const startIndex = page * pageSize + 1;
  const endIndex = page * pageSize + files.length;
  const showTotalCount = !hasMore ? totalCount : `${totalCount}+`;

  return (
    <div className="files-list-container">
      <div className="files-list-toolbar">
        <div className="files-list-left-controls">
          {settingType === 'local/external' && currentPath && (
            <button
              className="path-up-button"
              onClick={handleNavigateUp}
              disabled={loading}
              title="Go up one level"
            >
              ↑ Up
            </button>
          )}
          {settingType === 'local/external' && (
            <span className="files-list-path">Path: /{currentPath || ''}</span>
          )}
        </div>
        <div className="files-list-right-controls">
          <div className="files-pagination">
            <button
              onClick={handlePrevPage}
              disabled={page === 0 || loading}
              className="pagination-button"
            >
              ← Prev
            </button>
            <span className="pagination-info">
              {files.length > 0 ? `${startIndex}-${endIndex} of ${showTotalCount}` : '0 items'}
            </span>
            <button
              onClick={handleNextPage}
              disabled={!hasMore || loading}
              className="pagination-button"
            >
              Next →
            </button>
          </div>
          <button
            className="refresh-button"
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh file list"
          >
            {loading ? (
              <SpinningCircle width={16} height={16} color="#666" />
            ) : (
              <RefreshIcon width={16} height={16} />
            )}
          </button>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="empty-message">
          No files or directories found
        </div>
      ) : (
        <div className="files-table-wrapper">
          {loading && (
            <div className="files-loading-overlay">
              <SpinningCircle width={24} height={24} color="#666" />
            </div>
          )}
          <div className="files-table">
            <div className="files-table-header">
              <div className="file-col-name">Name</div>
              <div className="file-col-size">Size</div>
              <div className="file-col-modified">Modified</div>
            </div>
            {files.map((file, idx) => {
              const isRenaming = renamingFile && 
                ((file.id && file.id === renamingFile.id) ||
                 (file.path && file.path === renamingFile.path));
              
              return (
                <div 
                  key={idx}
                  data-file-index={idx}
                  className={`files-table-row ${file.isDirectory || file.directory ? 'directory' : 'file'}`}
                  onClick={() => handleNavigate(file)}
                  onContextMenu={(e) => handleFileContextMenu(e, file, idx)}
                  style={{ cursor: (file.isDirectory || file.directory) ? 'pointer' : 'default' }}
                >
                  <div className="file-col-name">
                    <span className="file-icon">{(file.isDirectory || file.directory) ? '📁' : '📄'}</span>
                    {isRenaming ? (
                      <span className="file-name-rename">
                        <input
                          ref={renameInputRef}
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={handleRenameSubmit}
                          onKeyDown={handleRenameKeyDown}
                          disabled={renamingInProgress}
                          className="rename-input"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {renamingInProgress && (
                          <SpinningCircle width={14} height={14} color="#666" />
                        )}
                      </span>
                    ) : (
                      <span className="file-name">{file.name}</span>
                    )}
                  </div>
                  <div className="file-col-size">
                    {getFileSize(file)}
                  </div>
                  <div className="file-col-modified">
                    {formatTimestamp(file.lastModified)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {menuFile && (
        <FileMenu
          file={menuFile}
          position={menuPosition}
          onClose={() => setMenuFile(null)}
          onDownload={handleDownload}
          onShow={handleShow}
          onRename={handleRenameStart}
          onContextMenu={handleMenuBackdropContextMenu}
        />
      )}

      {viewingFile && (
        <FileView
          file={viewingFile}
          fileAccessPointId={fileAccessPoint.id}
          onClose={() => setViewingFile(null)}
          onFileUpdate={handleFileUpdate}
        />
      )}
    </div>
  );
};

export default ListFiles;

