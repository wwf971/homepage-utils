import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import groovyApiStore from './groovyApiStore';
import { formatTimestamp } from '../utils/utils';
import './groovyApi.css';

const GroovyApiCard = observer(({ script, index, onDelete }) => {
  const [showJsonView, setShowJsonView] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this script?')) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    const result = await groovyApiStore.deleteScript(script.id);
    
    if (result.success) {
      if (onDelete) {
        onDelete(script.id);
      }
    } else {
      setDeleteError(result.error);
    }
    
    setDeleting(false);
  };

  return (
    <>
      <div className="doc-card">
        <div className="doc-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <span className="doc-card-index">#{index + 1}</span>
            <div>
              <div style={{ fontSize: '12px', marginTop: '2px' }}>
                <span style={{ fontWeight: 'bold' }}>Endpoint:</span> <span style={{ fontSize: '12px' }}>/groovy-api/{script.endpoint}</span>
              </div>
              {script.description && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                  <span style={{ fontWeight: 'bold', color: '#333' }}>Description:</span> {script.description}
                </div>
              )}
              <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                <span style={{ fontWeight: 'bold' }}>ID:</span> {script.id}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="doc-card-edit-button"
              onClick={() => setShowJsonView(true)}
              disabled={deleting}
              title="View raw JSON"
            >
              Show Raw JSON
            </button>
            <button
              className="doc-card-delete-button"
              onClick={handleDelete}
              disabled={deleting}
              title="Delete this script"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
        {deleteError && (
          <div style={{ 
            padding: '8px 12px', 
            background: '#f8d7da', 
            color: '#721c24', 
            fontSize: '12px',
            borderBottom: '1px solid #ddd'
          }}>
            {deleteError}
          </div>
        )}
        <div style={{ padding: '6px 8px', fontSize: '11px', color: '#999' }}>
          <div>createdAt: {formatTimestamp(script.createdAt, script.createdAtTimezone || 0)}</div>
          <div>updatedAt: {formatTimestamp(script.updatedAt, script.updatedAtTimezone || 0)}</div>
        </div>
      </div>

      {showJsonView && (
        <div className="doc-editor-overlay" onClick={() => setShowJsonView(false)}>
          <div className="doc-editor-panel" onClick={(e) => e.stopPropagation()}>
            <div className="doc-editor-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div className="panel-title">Script #{index + 1} - {script.endpoint}</div>
                <button
                  className="doc-editor-close-button"
                  onClick={() => setShowJsonView(false)}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="doc-editor-content">
              <pre style={{
                margin: 0,
                padding: '12px',
                background: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '12px',
                overflow: 'auto',
                fontFamily: 'monospace'
              }}>
                {JSON.stringify(script, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default GroovyApiCard;
