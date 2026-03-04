import React, { useState } from 'react';

/**
 * MongoAppGroovyApiCard - Display a single groovy API script
 * 
 * Props:
 * - script: The script object
 * - index: Display index number
 * - appId: The app ID
 * - onEdit: (script) => void - Callback to edit script
 * - onDelete: (scriptId) => void - Callback to delete script
 * - onRefresh: (scriptId) => void - Callback to refresh file-based script
 * - isEditing: boolean - Whether this script is being edited
 * - editState: { endpoint, description, scriptSource } - Edit form state
 * - onEditChange: (field, value) => void - Callback for edit changes
 * - onSaveEdit: (scriptId) => void - Callback to save edits
 * - onCancelEdit: () => void - Callback to cancel editing
 * - readOnly: boolean - If true, hide save/edit buttons (for view-only scripts)
 */
const MongoAppGroovyApiCard = ({
  script,
  index,
  appId,
  onEdit,
  onDelete,
  onRefresh,
  isEditing,
  editState,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  sourceLabel,
  readOnly = false
}) => {
  const isFileBasedScript = (scriptSource) => {
    return scriptSource && typeof scriptSource === 'object' && scriptSource.storageType === 'fileAccessPoint';
  };

  if (isEditing) {
    return (
      <div style={{ 
        border: '1px solid #ddd',
        borderRadius: '4px',
        backgroundColor: '#fff',
        padding: '12px'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
          {readOnly ? 'View Script' : 'Edit Script'} {index !== undefined && `#${index}`}
        </div>
        
        {!readOnly && (
          <>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Endpoint Name:
              </label>
              <input
                type="text"
                value={editState.endpoint}
                onChange={(e) => onEditChange('endpoint', e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px',
                  fontSize: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Description:
              </label>
              <input
                type="text"
                value={editState.description}
                onChange={(e) => onEditChange('description', e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px',
                  fontSize: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>
          </>
        )}

        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
            Script Source:
          </label>
          <textarea
            value={editState.scriptSource}
            onChange={(e) => onEditChange('scriptSource', e.target.value)}
            rows={10}
            readOnly={readOnly || isFileBasedScript(script.scriptSource)}
            style={{
              width: '100%',
              padding: '6px',
              fontSize: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontFamily: 'monospace',
              backgroundColor: (readOnly || isFileBasedScript(script.scriptSource)) ? '#f5f5f5' : '#fff'
            }}
          />
          {(readOnly || isFileBasedScript(script.scriptSource)) && (
            <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
              {readOnly ? 'This script is read-only. Use Refresh to update from file.' : 'File-based scripts are read-only. Use Refresh to update from file.'}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {!readOnly && (
            <button
              onClick={() => onSaveEdit(script.id)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Save
            </button>
          )}
          <button
            onClick={onCancelEdit}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: '#999',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {readOnly ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '4px',
      backgroundColor: '#fff'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 8px',
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #ddd'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          {index !== undefined && (
            <span style={{ fontSize: '12px', fontWeight: '500', color: '#666' }}>
              #{index}
            </span>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px' }}>
              <span style={{ fontWeight: 'bold' }}>Endpoint:</span>{' '}
              <span style={{ fontFamily: 'monospace' }}>/mongo-app/{appId}/api/{script.apiPath || script.endpoint}</span>
              {sourceLabel && (
                <span style={{ 
                  marginLeft: '8px', 
                  padding: '2px 6px', 
                  backgroundColor: sourceLabel.bgColor || '#e3f2fd', 
                  color: sourceLabel.color || '#1976d2',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  {sourceLabel.text}
                </span>
              )}
            </div>
            {script.description && (
              <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                <span style={{ fontWeight: 'bold' }}>Description:</span> {script.description}
              </div>
            )}
            {isFileBasedScript(script.scriptSource) && (
              <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                <span style={{ fontWeight: 'bold' }}>File:</span> {script.scriptSource.fileAccessPointId}:{script.scriptSource.path}
                {script.scriptSource.lastSyncAt && (
                  <span style={{ marginLeft: '8px', color: '#999' }}>
                    (synced: {new Date(script.scriptSource.lastSyncAt).toLocaleString()})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isFileBasedScript(script.scriptSource) && onRefresh && (
            <button
              onClick={() => onRefresh(script.id)}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                backgroundColor: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Refresh
            </button>
          )}
          {!readOnly && onEdit && (
            <button
              onClick={() => onEdit(script)}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Edit
            </button>
          )}
          {readOnly && onEdit && (
            <button
              onClick={() => onEdit(script)}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              View
            </button>
          )}
          {!readOnly && onDelete && (
            <button
              onClick={() => onDelete(script.id)}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
      <div style={{ padding: '8px 12px', fontSize: '11px', color: '#999' }}>
        <div>ID: {script.id}</div>
      </div>
    </div>
  );
};

export default MongoAppGroovyApiCard;
