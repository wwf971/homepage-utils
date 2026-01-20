import React, { useState } from 'react';
import { useAtom } from 'jotai';
import { SpinningCircle, EditableValueComp, KeyValuesComp } from '@wwf971/react-comp-misc';
import { formatTimestamp, formatFileSize } from './fileUtils';
import { fileCacheAtom, fetchFileData, renameFile } from './fileStore';
import './file.css';

/**
 * FetchFile - Component for fetching and displaying a file by URL
 * 
 * @param {string} fileAccessPointId - The file access point ID
 */
const FetchFile = ({ fileAccessPointId }) => {
  const [urlPath, setUrlPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [contentType, setContentType] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [actualFetchUrl, setActualFetchUrl] = useState(null); // The actual URL used to fetch
  const [copied, setCopied] = useState(false);
  const [, setFileCache] = useAtom(fileCacheAtom);

  const handleFetch = async () => {
    if (!urlPath.trim()) {
      setError('Please enter a URL path');
      return;
    }

    setLoading(true);
    setError(null);
    setMetadata(null);
    setFileUrl(null);
    setContentType(null);
    setActualFetchUrl(null);

    try {
      // Extract file ID from URL path (remove leading slash and query params)
      let cleanPath = urlPath.replace(/^\/+/, '').split('?')[0];
      
      // If the path starts with "file_access_point/{id}/", strip that prefix
      const fileAccessPointPrefix1 = `file_access_point/${fileAccessPointId}/`;
      if (cleanPath.startsWith(fileAccessPointPrefix1)) {
        cleanPath = cleanPath.substring(fileAccessPointPrefix1.length);
      }
      
      // If the path starts with just the access point ID, strip that too
      const fileAccessPointPrefix2 = `${fileAccessPointId}/`;
      if (cleanPath.startsWith(fileAccessPointPrefix2)) {
        cleanPath = cleanPath.substring(fileAccessPointPrefix2.length);
      }
      
      // Construct the actual fetch URL that will be used
      const actualUrl = `${window.location.origin}/file_access_point/${fileAccessPointId}/${cleanPath}`;
      setActualFetchUrl(actualUrl);
      
      // Use the unified caching function from fileStore
      const result = await fetchFileData(fileAccessPointId, cleanPath, setFileCache);
      
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
      console.error('Error fetching file:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleFetch();
    }
  };

  const handleCopyUrl = () => {
    if (actualFetchUrl) {
      navigator.clipboard.writeText(actualFetchUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNameUpdate = async (configKey, newValue) => {
    if (!metadata) return { code: -1, message: 'No file loaded' };
    
    const fileId = metadata.id || metadata.path || urlPath.replace(/^\/+/, '').split('?')[0];
    
    // Use the unified rename function from fileStore
    const result = await renameFile(fileAccessPointId, fileId, newValue, setFileCache);
    
    if (result.code === 0 && result.data) {
      // Update local metadata state with the new data from the server
      // This is crucial for local/external files where the path changes
      setMetadata(prev => ({
        ...prev,
        name: newValue,
        path: result.data.path || prev.path, // Update path if it changed
        id: result.data.id || prev.id
      }));
    }
    
    return result;
  };

  // Prepare metadata for KeyValuesComp
  const metadataItems = React.useMemo(() => {
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
      value: metadata.name || 'Unknown'
    });
    
    // Size
    items.push({
      key: 'Size',
      value: formatFileSize(metadata.size)
    });
    
    // Type
    items.push({
      key: 'Type',
      value: metadata.contentType || contentType || 'Unknown'
    });
    
    // Modified
    if (metadata.lastModified) {
      items.push({
        key: 'Modified',
        value: formatTimestamp(metadata.lastModified)
      });
    }
    
    // Path
    if (metadata.path) {
      items.push({
        key: 'Path',
        value: metadata.path
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
  }, [metadata, contentType]);

  const isImage = contentType && contentType.startsWith('image/');

  return (
    <div className="fetch-file-container">
      <div className="fetch-file-input-row">
        <input
          type="text"
          className="fetch-file-input"
          placeholder="Enter file path (e.g., folder/file.jpg or /kp0i4g/folder/file.jpg)"
          value={urlPath}
          onChange={(e) => setUrlPath(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className="fetch-file-button"
          onClick={handleFetch}
          disabled={loading || !urlPath.trim()}
        >
          {loading ? <SpinningCircle width={14} height={14} color="#666" /> : 'Fetch'}
        </button>
      </div>

      {error && (
        <div className="fetch-file-error">
          <p>Failed to fetch file</p>
          <p className="error-detail">{error}</p>
        </div>
      )}

      {metadata && (
        <div className="fetch-file-content">
          <div className="fetch-file-header">
            <div className="fetch-file-title-row">
              <h4 className="fetch-file-title">{metadata.name || 'File'}</h4>
              {contentType && (
                <span className="fetch-file-mime-type">{contentType}</span>
              )}
            </div>
            {actualFetchUrl && (
              <div className="fetch-file-url-row">
                <span className="fetch-file-url" title={actualFetchUrl}>{actualFetchUrl}</span>
                <button 
                  className="fetch-file-copy-button" 
                  onClick={handleCopyUrl}
                  title="Copy URL"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>

          <div className="fetch-file-preview">
            {fileUrl && isImage ? (
              <div className="fetch-file-image-container">
                <img src={fileUrl} alt={metadata.name} className="fetch-file-image" draggable="false" />
              </div>
            ) : !fileUrl ? (
              <div className="fetch-file-not-found">
                <p>File not found on filesystem</p>
                {metadata.error && (
                  <p className="error-detail">{metadata.error}</p>
                )}
                <p style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                  Metadata is available below for debugging
                </p>
              </div>
            ) : (
              <div className="fetch-file-unsupported">
                <p>Preview not available for this file type</p>
                <p className="fetch-file-type">{contentType || 'Unknown type'}</p>
              </div>
            )}
          </div>

          <div className="fetch-file-metadata">
            <h5>Metadata</h5>
            <KeyValuesComp
              data={metadataItems}
              isEditable={false}
              isValueEditable={false}
              alignColumn={true}
              keyColWidth="min"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FetchFile;

