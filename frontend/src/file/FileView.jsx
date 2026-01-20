import React, { useState, useEffect, useMemo } from 'react';
import { useAtom } from 'jotai';
import { SpinningCircle, EditableValueComp, KeyValuesComp, JsonComp } from '@wwf971/react-comp-misc';
import { formatTimestamp, formatFileSize } from './fileUtils';
import { fileCacheAtom, fetchFileData, renameFile } from './fileStore';
import { useMongoDocEditor, getBackendServerUrl } from '../remote/dataStore';
import './file.css';

/**
 * FileView - Popup component for viewing file content and metadata
 * 
 * @param {Object} file - The file object to display
 * @param {string} fileAccessPointId - The file access point ID
 * @param {Function} onClose - Callback to close the popup
 * @param {Function} onFileUpdate - Callback when file is updated (renamed, etc.)
 */
const FileView = ({ file, fileAccessPointId, onClose, onFileUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [contentType, setContentType] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [, setFileCache] = useAtom(fileCacheAtom);
  const [copied, setCopied] = useState(false);
  const [showMongoDoc, setShowMongoDoc] = useState(false);
  const [mongoDoc, setMongoDoc] = useState(null);
  const [loadingMongoDoc, setLoadingMongoDoc] = useState(false);
  const [mongoDocError, setMongoDocError] = useState(null);
  
  // MongoDB document editor (only used for local/internal files)
  const { handleChange: handleMongoDocChange, isUpdating } = useMongoDocEditor(
    'main',
    'note',
    mongoDoc || {}
  );

  useEffect(() => {
    const loadFile = async () => {
      setLoading(true);
      setError(null);

      try {
        // For local/internal, use the custom id field; for local/external, use the path
        const fileId = file.id || file.path;
        
        // Use the unified caching function from fileStore
        const result = await fetchFileData(fileAccessPointId, fileId, setFileCache);
        
        if (result.code !== 0) {
          throw new Error(result.message || 'Failed to load file');
        }

        const { metadata: metaData, fileBytes } = result.data;
        setMetadata(metaData);
        setContentType(metaData.contentType);
        
        // Create object URL from base64 if file bytes are available
        if (fileBytes) {
          // Decode base64 to binary
          const binaryString = atob(fileBytes);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: metaData.contentType || 'application/octet-stream' });
          const objectUrl = URL.createObjectURL(blob);
          setFileUrl(objectUrl);
        }
      } catch (err) {
        console.error('Error loading file:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadFile();

    // Cleanup object URL on unmount
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [file, fileAccessPointId, setFileCache]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleNameUpdate = async (configKey, newValue) => {
    const fileId = file.id || file.path;
    
    // Use the unified rename function from fileStore
    const result = await renameFile(fileAccessPointId, fileId, newValue, setFileCache);
    
    if (result.code === 0 && result.data) {
      // Update local metadata state with the new data from the server
      // This is crucial for local/external files where the path changes
      const updatedMetadata = {
        ...metadata,
        name: newValue,
        path: result.data.path || metadata.path, // Update path if it changed
        id: result.data.id || metadata.id
      };
      setMetadata(updatedMetadata);
      
      // Notify parent component (ListFiles) about the update
      if (onFileUpdate) {
        onFileUpdate({
          ...file,
          ...result.data,
          name: newValue
        });
      }
    }
    
    return result;
  };

  // Construct the full URL used to fetch the file
  const fetchUrl = useMemo(() => {
    const fileId = file.id || file.path;
    const origin = window.location.origin;
    // Don't encode slashes in fileId for local/external types
    const encodedFileId = fileId.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const path = `/file_access_point/${encodeURIComponent(fileAccessPointId)}/${encodedFileId}`;
    return `${origin}${path}`;
  }, [file, fileAccessPointId]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(fetchUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };
  
  const handleEditMongoDoc = async () => {
    if (!file.id) {
      setMongoDocError('Cannot edit MongoDB document: file has no ID (may be local/external type)');
      return;
    }
    
    setLoadingMongoDoc(true);
    setMongoDocError(null);
    try {
      const backendUrl = getBackendServerUrl();
      const response = await fetch(`${backendUrl}/mongo/db/main/coll/note/doc/?id=${file.id}`);
      const result = await response.json();
      
      if (result.code === 0 && result.data) {
        setMongoDoc(result.data);
        setShowMongoDoc(true);
        setMongoDocError(null);
      } else {
        setMongoDocError('Failed to load MongoDB document: ' + (result.message || 'Unknown error'));
      }
    } catch (error) {
      setMongoDocError('Failed to load MongoDB document: ' + error.message);
    } finally {
      setLoadingMongoDoc(false);
    }
  };

  // Prepare metadata for KeyValuesComp
  const metadataItems = useMemo(() => {
    if (!metadata) return [];
    
    const items = [];
    
    // ID
    if (metadata.id) {
      items.push({
        key: 'ID',
        value: metadata.id
      });
    }
    
    // Name (editable)
    items.push({
      key: 'Name',
      valueComp: ({ data }) => (
        <EditableValueComp
          data={data}
          configKey="name"
          onUpdate={handleNameUpdate}
        />
      ),
      value: metadata.name || file.name
    });
    
    // Size
    items.push({
      key: 'Size',
      value: formatFileSize(metadata.size || file.size)
    });
    
    // Type
    items.push({
      key: 'Type',
      value: metadata.contentType || contentType || file.contentType || 'Unknown'
    });
    
    // Modified
    items.push({
      key: 'Modified',
      value: formatTimestamp(metadata.lastModified || file.lastModified)
    });
    
    // Path
    if (metadata.path || file.path) {
      items.push({
        key: 'Path',
        value: metadata.path || file.path
      });
    }
    
    // Error
    if (metadata.error) {
      items.push({
        key: 'Error',
        valueComp: ({ data }) => (
          <span style={{ color: '#d32f2f' }}>{data}</span>
        ),
        value: metadata.error
      });
    }
    
    return items;
  }, [metadata, file, contentType]);

  const isImage = contentType && contentType.startsWith('image/');

  return (
    <div className="file-view-backdrop" onClick={handleBackdropClick}>
      <div className="file-view-container">
        <div className="file-view-header">
          <div className="file-view-header-content">
            <div className="file-view-title-row">
              <h3 className="file-view-title">{file.name}</h3>
              {contentType && (
                <span className="file-view-mime-type">{contentType}</span>
              )}
            </div>
            <div className="file-view-url-row">
              <span className="file-view-url" title={fetchUrl}>{fetchUrl}</span>
              <button 
                className="file-view-copy-button" 
                onClick={handleCopyUrl}
                title="Copy URL"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <button className="file-view-close" onClick={onClose}>×</button>
        </div>
        
        {mongoDocError && (
          <div className="file-view-mongo-error">
            {mongoDocError}
            <button 
              className="file-view-mongo-error-close"
              onClick={() => setMongoDocError(null)}
            >
              ×
            </button>
          </div>
        )}

        <div className="file-view-content">
          {loading && (
            <div className="file-view-loading">
              <SpinningCircle width={32} height={32} color="#666" />
              <p>Loading file...</p>
            </div>
          )}

          {error && (
            <div className="file-view-error">
              <p>Failed to load file</p>
              <p className="error-detail">{error}</p>
            </div>
          )}

          {!loading && !error && metadata && (
            <>
              {fileUrl && isImage ? (
                <div className="file-view-image-container">
                  <img src={fileUrl} alt={metadata.name || file.name} className="file-view-image" draggable="false" />
                </div>
              ) : !fileUrl ? (
                <div className="file-view-error">
                  <p>File not found on filesystem</p>
                  {metadata.error && (
                    <p className="error-detail">{metadata.error}</p>
                  )}
                  <p style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
                    Metadata is available below for debugging
                  </p>
                </div>
              ) : (
                <div className="file-view-unsupported">
                  <p>Preview not available for this file type</p>
                  <p className="file-view-type">{contentType || 'Unknown type'}</p>
                </div>
              )}
            </>
          )}
        </div>

        {!loading && !error && metadata && (
          <div className="file-view-metadata">
            <div className="file-view-metadata-header">
              <span className="file-view-metadata-title">Metadata</span>
              {file.id && (
                <button 
                  className="file-view-edit-mongo-button" 
                  onClick={handleEditMongoDoc}
                  disabled={loadingMongoDoc}
                  title="Edit MongoDB document"
                >
                  {loadingMongoDoc ? '...' : 'Edit Mongo Doc'}
                </button>
              )}
            </div>
            <KeyValuesComp
              data={metadataItems}
              isEditable={false}
              isValueEditable={false}
              alignColumn={true}
              keyColWidth="min"
            />
          </div>
        )}
      </div>
      
      {showMongoDoc && mongoDoc && (
        <div 
          className="file-view-mongo-overlay"
          onClick={() => setShowMongoDoc(false)}
        >
          <div 
            className="file-view-mongo-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="file-view-mongo-header">
              <h3>Edit MongoDB Document</h3>
              <button 
                className="file-view-mongo-close"
                onClick={() => setShowMongoDoc(false)}
              >
                ×
              </button>
            </div>
            <div className="file-view-mongo-content">
              <JsonComp
                data={mongoDoc}
                onChange={handleMongoDocChange}
                isLoading={isUpdating}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileView;

