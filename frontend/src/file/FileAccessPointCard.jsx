import React, { useMemo, useState, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { KeyValuesComp, JsonComp, TabsOnTop, RefreshIcon, EditableValueComp, SelectableValueComp } from '@wwf971/react-comp-misc';
import ListFiles from './ListFiles';
import FetchFile from './FetchFile';
import { fetchFileAccessPoints, fetchComputedBaseDir } from './fileStore';
import { useMongoDocEditor, extractDocId, mongoDocsAtom, backendLocalConfigAtom } from '../remote/dataStore';
import { formatTimestamp } from './fileUtils';
import './file.css';

const FileAccessPointCard = ({ fileAccessPoint, database, collection, onUpdate, onOpenMongoDoc }) => {
  const [showJsonView, setShowJsonView] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [computedBaseDir, setComputedBaseDir] = useState(null);
  const [computedBaseDirLoading, setComputedBaseDirLoading] = useState(false);
  const [computedBaseDirError, setComputedBaseDirError] = useState(null);

  // Subscribe to mongoDocsAtom to ensure document is available for JsonComp
  const setDocs = useSetAtom(mongoDocsAtom);
  
  // Get backend local config for serverName
  const localConfig = useAtomValue(backendLocalConfigAtom);
  
  // Ensure the document is in the atom for JsonComp to work
  const docId = fileAccessPoint ? extractDocId(fileAccessPoint) : null;
  useEffect(() => {
    if (!docId || !fileAccessPoint) return;
    
    // Add document to atom if not already present (needed for JsonComp)
    setDocs(prev => {
      const existsInAtom = prev.some(d => extractDocId(d) === docId);
      if (!existsInAtom) {
        return [...prev, fileAccessPoint];
      }
      return prev;
    });
  }, [fileAccessPoint, docId, setDocs]);

  // Use the custom hook for document editing (pass null-safe document)
  const { handleChange, isUpdating } = useMongoDocEditor(
    database,
    collection,
    fileAccessPoint || {}
  );

  // Early return after all hooks are called
  if (!fileAccessPoint) {
    return <div className="file-access-point-card">Loading...</div>;
  }

  // Handle field updates - use handleChange from useMongoDocEditor to ensure atom is updated
  const handleFieldUpdate = async (fieldPath, newValue) => {
    // Get the old value from the nested path
    const pathParts = fieldPath.split('.');
    let oldValue = fileAccessPoint;
    for (const part of pathParts) {
      oldValue = oldValue?.[part];
    }
    
    // Use handleChange from the hook which properly updates mongoDocsAtom
    // The 'new' value must be wrapped in an object with a 'value' property
    const result = await handleChange(fieldPath, {
      old: oldValue,
      new: { value: newValue },
      _action: null // Regular field update, not a special action
    });
    
    return result;
  };
  // File access point type options
  const fileAccessPointTypeOptions = [
    {
      value: 'local/internal',
      label: 'local/internal',
      description: 'Internal storage - files stored directly in the specified directory'
    },
    {
      value: 'local/external',
      label: 'local/external',
      description: 'External storage - files organized in subdirectories within the specified path'
    },
    {
      value: 'local/external/time',
      label: 'local/external/time',
      description: 'External storage organized by timestamp - files grouped by date/time within subdirectories'
    },
    {
      value: 'local/external/id',
      label: 'local/external/id',
      description: 'External storage organized by ID - files grouped by unique identifiers within subdirectories'
    }
  ];

  // Format setting type description
  const getTypeDescription = (type) => {
    const option = fileAccessPointTypeOptions.find(opt => opt.value === type);
    return option ? option.description : (type || 'Unknown');
  };


  // Flatten nested object into dot-notation keys
  const flattenObject = (obj, prefix = '') => {
    const flattened = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          Object.assign(flattened, flattenObject(value, newKey));
        } else {
          flattened[newKey] = value;
        }
      }
    }
    return flattened;
  };

  // Extract settingType for use in component
  const settingType = useMemo(() => {
    const flattened = flattenObject(fileAccessPoint);
    return flattened['content.setting.type'] || 'NOT SET';
  }, [fileAccessPoint]);

  // Prepare data for KeyValuesComp with editable fields
  const cardData = useMemo(() => {
    const flattened = flattenObject(fileAccessPoint);
    
    // Define recognized editable fields (key stays as-is, just add edit component)
    const editableFields = {
      'content.name': (props, value) => (
        <EditableValueComp
          {...props}
          configKey="content.name"
          valueType="text"
          isNotSet={!value || value === 'NOT SET'}
          onUpdate={(key, val) => handleFieldUpdate('content.name', val)}
        />
      ),
      'content.setting.type': (props, value) => (
        <SelectableValueComp
          {...props}
          configKey="content.setting.type"
          isNotSet={!value || value === 'NOT SET'}
          options={fileAccessPointTypeOptions}
          onUpdate={(key, val) => handleFieldUpdate('content.setting.type', val)}
        />
      ),
      'content.setting.dir_path_base': (props, value) => (
        <EditableValueComp
          {...props}
          configKey="content.setting.dir_path_base"
          valueType="text"
          isNotSet={!value || value === 'NOT SET'}
          onUpdate={(key, val) => handleFieldUpdate('content.setting.dir_path_base', val)}
        />
      ),
      'content.setting.dir_path_base_index': (props, value) => (
        <EditableValueComp
          {...props}
          configKey="content.setting.dir_path_base_index"
          valueType="text"
          isNotSet={value === undefined || value === null || value === 'NOT SET'}
          onUpdate={(key, val) => {
            // Try to parse as integer first (for array index)
            const parsed = parseInt(val, 10);
            if (!isNaN(parsed)) {
              // Valid integer - use as numeric index for array
              return handleFieldUpdate('content.setting.dir_path_base_index', parsed);
            }
            // Not a valid integer - use as string key for object/map
            return handleFieldUpdate('content.setting.dir_path_base_index', val);
          }}
        />
      )
    };

    // Recognized time fields that need formatting
    const timeFields = ['time_create', 'timeCreate', 'create_time', 'mtime'];

    // Compute resolved base directory path
    // Logic:
    // 1. Try: dirs_path_base_server[serverName] (if serverName exists in local config)
    // 2. Try: dirs_path_base as array with numeric dir_path_base_index
    // 3. If fails, try: dirs_path_base as object/map with string/numeric key dir_path_base_index
    // 4. Fall back to dir_path_base
    const resolveBaseDirPath = () => {
      // Attempt 0: Try dirs_path_base_server[serverName] if serverName is available
      const serverName = localConfig?.serverName;
      const dirsPathBaseServer = flattened['content.setting.dirs_path_base_server'];
      
      if (serverName && dirsPathBaseServer && typeof dirsPathBaseServer === 'object') {
        const resolvedPath = dirsPathBaseServer[serverName];
        if (resolvedPath != null) {
          const pathStr = String(resolvedPath).trim();
          if (pathStr) {
            return pathStr;
          }
        }
      }
      
      const index = flattened['content.setting.dir_path_base_index'];
      const dirs = flattened['content.setting.dirs_path_base'];
      
      if (index != null && dirs != null) {
        // Attempt 1: Try dirs_path_base as array with numeric index
        if (Array.isArray(dirs)) {
          const numericIndex = typeof index === 'number' ? index : parseInt(index, 10);
          if (!isNaN(numericIndex) && numericIndex >= 0 && numericIndex < dirs.length) {
            const resolvedPath = dirs[numericIndex];
            if (resolvedPath != null) {
              const pathStr = String(resolvedPath).trim();
              if (pathStr) {
                return pathStr;
              }
            }
          }
        }
        
        // Attempt 2: Try dirs_path_base as object/map with string key
        if (typeof dirs === 'object' && !Array.isArray(dirs)) {
          const key = String(index);
          const resolvedPath = dirs[key];
          if (resolvedPath != null) {
            const pathStr = String(resolvedPath).trim();
            if (pathStr) {
              return pathStr;
            }
          }
        }
      }
      
      // Fall back to dir_path_base
      return flattened['content.setting.dir_path_base'] || 'NOT SET';
    };

    // Build the data array - iterate through all flattened keys
    const dataArray = [];
    const processedKeys = new Set(['_id', 'type']); // Skip these internal fields

    // Define preferred order for known keys
    const orderedKeys = [
      'id', 
      'content.name', 
      'content.setting.type', 
      'content.setting.dirs_path_base',
      'content.setting.dir_path_base_index',
      'content.setting.dir_path_base',
      'content.server_id', 
      'content.serverId', 
      'content.time_create', 
      'content.timeCreate', 
      'content.create_time', 
      'content.mtime'
    ];
    
    // Process ordered keys first
    orderedKeys.forEach(key => {
      if (processedKeys.has(key) || !(key in flattened)) return;
      
      const value = flattened[key];
      let displayValue = value;
      
      // Format time fields
      if (timeFields.includes(key) && value) {
        displayValue = formatTimestamp(value);
      } else if (value === undefined || value === null || value === '') {
        displayValue = 'NOT SET';
      } else if (typeof value === 'object') {
        displayValue = JSON.stringify(value);
      }

      const item = {
        key: key, // Keep original key as-is
        value: displayValue
      };

      // Add edit component if this is an editable field
      if (editableFields[key]) {
        item.valueComp = (props) => editableFields[key](props, displayValue);
      }

      dataArray.push(item);
      processedKeys.add(key);
    });

    // Add type description after content.setting.type
    if (settingType && settingType !== 'NOT SET') {
      const typeIndex = dataArray.findIndex(item => item.key === 'content.setting.type');
      if (typeIndex >= 0) {
        dataArray.splice(typeIndex + 1, 0, {
          key: 'content.setting.type_description',
          value: getTypeDescription(settingType)
        });
      }
    }

    // Add resolved base directory path after dir_path_base (computed read-only field)
    const dirPathBaseIndex = dataArray.findIndex(item => item.key === 'content.setting.dir_path_base');
    if (dirPathBaseIndex >= 0) {
      const resolvedPath = resolveBaseDirPath();
      // Only show resolved path if it's different from dir_path_base or if using indexed path
      const dirPathBase = flattened['content.setting.dir_path_base'];
      const usingIndexedPath = flattened['content.setting.dir_path_base_index'] != null && 
                                flattened['content.setting.dirs_path_base'] != null;
      
      if (usingIndexedPath || resolvedPath !== dirPathBase) {
        dataArray.splice(dirPathBaseIndex + 1, 0, {
          key: 'content.setting.dir_path_base_resolved',
          value: resolvedPath
        });
      }
    }

    // Then add any remaining unknown fields
    Object.keys(flattened).forEach(key => {
      if (processedKeys.has(key)) return;
      
      const value = flattened[key];
      let displayValue;
      
      if (value === undefined || value === null || value === '') {
        displayValue = 'NOT SET';
      } else if (typeof value === 'object') {
        displayValue = JSON.stringify(value);
      } else {
        displayValue = String(value);
      }
      
      dataArray.push({
        key: key, // Keep original key as-is
        value: displayValue
      });
      processedKeys.add(key);
    });

    return dataArray;
  }, [fileAccessPoint, fileAccessPointTypeOptions, handleFieldUpdate, settingType, localConfig]);


  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Fetch fresh data from server
      const result = await fetchFileAccessPoints();
      if (result.code === 0 && result.data) {
        // Find the updated access point
        const updated = result.data.find(ap => {
          const apId = extractDocId(ap);
          const currentId = extractDocId(fileAccessPoint);
          return apId === currentId;
        });
        
        if (updated) {
          // Update in the atom directly (don't call onUpdate to avoid full panel reload)
          setDocs(prev => prev.map(d => 
            extractDocId(d) === docId ? updated : d
          ));
        }
      }
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshComputedBaseDir = async () => {
    setComputedBaseDirLoading(true);
    setComputedBaseDirError(null);
    
    try {
      // Use the custom id field, not MongoDB _id
      const apId = fileAccessPoint.id;
      if (!apId) {
        setComputedBaseDirError('File access point ID not found');
        return;
      }
      
      const result = await fetchComputedBaseDir(apId);
      
      if (result.code === 0) {
        setComputedBaseDir(result.data);
      } else {
        setComputedBaseDirError(result.message || 'Failed to fetch computed base directory');
      }
    } catch (error) {
      console.error('Failed to fetch computed base directory:', error);
      setComputedBaseDirError(error.message || 'Network error');
    } finally {
      setComputedBaseDirLoading(false);
    }
  };

  return (
    <>
      <div className="file-access-point-card">
        <div className="card-title">
          <span className="card-title-text">
            {fileAccessPoint.content?.name || 'Unnamed Access Point'}
          </span>
        </div>

        <TabsOnTop defaultTab="Config" autoSwitchToNewTab={false}>
          <TabsOnTop.Tab label="Config">
            <div className="tab-content-padding">
              <div className="config-tab-header">
                <button
                  className="refresh-button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  title="Refresh data from server"
                >
                  <RefreshIcon width={16} height={16} />
                </button>
                <button
                  className="mongo-doc-button"
                  onClick={() => setShowRawJson(true)}
                  title="View raw JSON"
                >
                  Show Raw Json
                </button>
                <button
                  className="mongo-doc-button"
                  onClick={() => setShowJsonView(true)}
                  title="Edit document as JSON"
                >
                  Edit in Json
                </button>
              </div>
              <KeyValuesComp
                data={cardData}
                isEditable={false}
                alignColumn={true}
                keyColWidth="min"
              />
              
              <div style={{ 
                marginTop: '8px', 
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  marginBottom: '4px'
                }}>
                  <span style={{ 
                    fontSize: '14px', 
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Backend Computed Base Directory:
                  </span>
                  <button
                    className="refresh-button"
                    onClick={handleRefreshComputedBaseDir}
                    disabled={computedBaseDirLoading}
                    title="Fetch computed base directory from backend"
                    style={{ 
                      padding: '4px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <RefreshIcon width={14} height={14} />
                    <span style={{ fontSize: '12px' }}>Refresh</span>
                  </button>
                </div>
                
                {computedBaseDirLoading && (
                  <div style={{ 
                    padding: '4px 8px',
                    background: '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: '#666'
                  }}>
                    Loading...
                  </div>
                )}
                
                {computedBaseDirError && !computedBaseDirLoading && (
                  <div style={{ 
                    padding: '4px 8px',
                    background: '#f8d7da',
                    border: '1px solid #f5c6cb',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: '#721c24'
                  }}>
                    Error: {computedBaseDirError}
                  </div>
                )}
                
                {computedBaseDir && !computedBaseDirLoading && !computedBaseDirError && (
                  <div style={{ 
                    padding: '4px 8px',
                    background: '#d4edda',
                    border: '1px solid #c3e6cb',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: '#155724',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all'
                  }}>
                    {computedBaseDir}
                  </div>
                )}
                
                {!computedBaseDir && !computedBaseDirLoading && !computedBaseDirError && (
                  <div style={{ 
                    padding: '8px 12px',
                    background: '#fff3cd',
                    border: '1px solid #ffeaa7',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: '#856404'
                  }}>
                    Click "Refresh" to fetch the computed base directory from backend
                  </div>
                )}
              </div>
            </div>
          </TabsOnTop.Tab>
          <TabsOnTop.Tab label="Files">
            <ListFiles fileAccessPoint={fileAccessPoint} />
          </TabsOnTop.Tab>
          {settingType === 'local/external' && (
            <TabsOnTop.Tab label="Fetch">
              <FetchFile fileAccessPointId={fileAccessPoint.id} />
            </TabsOnTop.Tab>
          )}
        </TabsOnTop>
      </div>

      {showJsonView && (
        <div className="doc-editor-overlay" onClick={() => setShowJsonView(false)}>
          <div className="doc-editor-panel" onClick={(e) => e.stopPropagation()}>
            <div className="doc-editor-header">
              <div>
                <h3>{fileAccessPoint.content?.name || 'File Access Point'}</h3>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#666', 
                  marginTop: '4px',
                  fontFamily: 'monospace'
                }}>
                  mongo doc path: {database}/{collection}/id={fileAccessPoint.id}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isUpdating && (
                  <span style={{ 
                    fontSize: '13px',
                    color: '#856404',
                    fontWeight: '500'
                  }}>
                    Updating...
                  </span>
                )}
                <button
                  className="doc-editor-close-button"
                  onClick={() => setShowJsonView(false)}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="doc-editor-content">
              <JsonComp 
                data={fileAccessPoint} 
                isEditable={true}
                isKeyEditable={true}
                isValueEditable={true}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>
      )}

      {showRawJson && (
        <div className="doc-editor-overlay" onClick={() => setShowRawJson(false)}>
          <div className="doc-editor-panel" onClick={(e) => e.stopPropagation()}>
            <div className="doc-editor-header">
              <div>
                <h3>Raw JSON - {fileAccessPoint.content?.name || 'File Access Point'}</h3>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#666', 
                  marginTop: '4px',
                  fontFamily: 'monospace'
                }}>
                  mongo doc path: {database}/{collection}/id={fileAccessPoint.id}
                </div>
              </div>
              <button
                className="doc-editor-close-button"
                onClick={() => setShowRawJson(false)}
              >
                ✕
              </button>
            </div>
            <div className="doc-editor-content">
              <pre style={{
                margin: 0,
                padding: '12px',
                background: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '13px',
                lineHeight: '1.5',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {JSON.stringify(fileAccessPoint, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FileAccessPointCard;

