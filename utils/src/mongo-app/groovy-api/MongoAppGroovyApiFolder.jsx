import React, { useState } from 'react';
import MongoAppGroovyApiCard from './MongoAppGroovyApiCard.jsx';
import { DownIcon, RefreshIcon, DeleteIcon, EditIcon } from '@wwf971/react-comp-misc';
import MongoAppGroovyApiFolderCreateOrUpdate from './MongoAppGroovyApiFolderCreateOrUpdate.jsx';

/**
 * MongoAppGroovyApiFolder - Display a folder with its grouped scripts
 * 
 * Props:
 * - folder: { fileAccessPointId, path, addedAt }
 * - scripts: Array of scripts from this folder
 * - appId: The app ID
 * - onEdit: (script) => void
 * - onDelete: (scriptId) => void
 * - onRefresh: (scriptId) => void
 * - onRemoveFolder: (fileAccessPointId, path) => void
 * - onScanFolder: () => void
 * - editingScriptId: string - ID of script being edited
 * - editState: Edit form state
 * - onEditChange: Callback for edit changes
 * - onSaveEdit: Callback to save edits
 * - onCancelEdit: Callback to cancel editing
 */
const MongoAppGroovyApiFolder = ({
  folder,
  scripts,
  appId,
  onEdit,
  onDelete,
  onRefresh,
  onRemoveFolder,
  onScanFolder,
  onUpdateFolder,
  backendUrl,
  editingScriptId,
  editState,
  onEditChange,
  onSaveEdit,
  onCancelEdit
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditingFolder, setIsEditingFolder] = useState(false);

  const folderDisplayPath = folder.path || '(root)';
  const folderKey = `${folder.fileAccessPointId}:${folder.path}`;

  const handleToggleExpand = () => {
    // If collapsing and a script from this folder is being edited, exit edit mode
    if (isExpanded && editingScriptId) {
      const isEditingScriptInThisFolder = scripts.some(script => script.id === editingScriptId);
      if (isEditingScriptInThisFolder && onCancelEdit) {
        onCancelEdit();
      }
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '4px',
      backgroundColor: '#fff',
      marginBottom: '8px'
    }}>
      {/* Folder Header */}
      <div style={{
        padding: '8px',
        backgroundColor: '#e8f5e9',
        borderBottom: '1px solid #c8e6c9',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <button
            onClick={handleToggleExpand}
            style={{
              padding: '2px 0px',
              fontSize: '12px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#333',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <div style={{ 
              transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.2s',
              display: 'flex',
              alignItems: 'center'
            }}>
              <DownIcon width={16} height={16} />
            </div>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <span>Folder: {folderDisplayPath}</span>
              <button
                onClick={onScanFolder}
                style={{
                  padding: '2px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#4CAF50',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Scan and reload scripts from this folder"
              >
                <RefreshIcon width={14} height={14} />
              </button>
              <button
                onClick={() => onRemoveFolder(folder.fileAccessPointId, folder.path)}
                style={{
                  padding: '2px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#dc3545',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Remove this folder from auto-load list"
              >
                <DeleteIcon width={14} height={14} />
              </button>
              <button
                onClick={() => setIsEditingFolder(!isEditingFolder)}
                style={{
                  padding: '2px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#2196F3',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Edit this folder"
              >
                <EditIcon width={14} height={14} />
              </button>
            </div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
              <span style={{ fontWeight: 'bold' }}>FAP:</span> {folder.fileAccessPointId}
              {' • '}
              <span style={{ fontWeight: 'bold' }}>Scripts:</span> {scripts.length}
              {folder.addedAt && (
                <>
                  {' • '}
                  <span>Added: {new Date(folder.addedAt).toLocaleString()}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scripts List (with indent) */}
      {isExpanded && (
        <div style={{ padding: '8px', paddingLeft: '24px' }}>
          {isEditingFolder ? (
            <MongoAppGroovyApiFolderCreateOrUpdate
              mode="update"
              backendUrl={backendUrl}
              fileAccessPointId={folder.fileAccessPointId}
              path={folder.path || ''}
              onConfirm={(nextFolder) => {
                onUpdateFolder?.(
                  {
                    fileAccessPointId: folder.fileAccessPointId,
                    path: folder.path || '',
                  },
                  nextFolder,
                  () => setIsEditingFolder(false)
                );
              }}
              onCancel={() => setIsEditingFolder(false)}
            />
          ) : scripts.length === 0 ? (
            <div style={{ 
              padding: '12px', 
              fontSize: '12px', 
              color: '#999',
              textAlign: 'center',
              backgroundColor: '#f9f9f9',
              borderRadius: '4px'
            }}>
              No scripts loaded from this folder yet. Click the refresh icon to scan and load scripts.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {scripts.map((script, idx) => (
                <MongoAppGroovyApiCard
                  key={script.id}
                  script={script}
                  index={idx + 1}
                  appId={appId}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onRefresh={onRefresh}
                  isEditing={editingScriptId === script.id}
                  editState={editState}
                  onEditChange={onEditChange}
                  onSaveEdit={onSaveEdit}
                  onCancelEdit={onCancelEdit}
                  readOnly={true}
                  sourceLabel={{
                    text: 'FROM FOLDER',
                    bgColor: '#e8f5e9',
                    color: '#2e7d32'
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MongoAppGroovyApiFolder;
