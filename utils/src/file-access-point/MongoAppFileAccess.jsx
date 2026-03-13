import React, { useEffect, useState, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { RefreshIcon, DeleteIcon, PlusIcon, EditIcon } from '@wwf971/react-comp-misc';
import { FileAccessPointSelector, DirSelector, fileStore, initFileStore } from './index.js';
import mongoAppFapStore from './mongoAppFapStore.js';

const MongoAppFileAccessCreaetOrUpdate = ({ mode = 'create', backendUrl, initialId = '', initialFapId = '', initialPath = '', onConfirm, onCancel }) => {
  const [id, setId] = useState(initialId);
  const [selectedFapId, setSelectedFapId] = useState(initialFapId);
  const [selectedPath, setSelectedPath] = useState(initialPath);
  const [showFapSelector, setShowFapSelector] = useState(false);
  const [showDirSelector, setShowDirSelector] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setId(initialId);
    setSelectedFapId(initialFapId);
    setSelectedPath(initialPath);
  }, [initialId, initialFapId, initialPath]);

  const handleConfirm = () => {
    if (mode === 'create' && !id.trim()) {
      setError('id is required');
      return;
    }
    if (!selectedFapId) {
      setError('File access point is required');
      return;
    }
    setError(null);
    onConfirm?.({ id: id.trim(), fileAccessPointId: selectedFapId, path: selectedPath || '' });
  };

  return (
    <div style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9', marginBottom: '8px' }}>
      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
        {mode === 'update' ? 'Edit File Access' : 'Add File Access'}
      </div>

      {mode === 'create' && (
        <div style={{ marginBottom: '8px' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '2px' }}>Alias ID (unique within app):</label>
          <input
            type="text"
            value={id}
            onChange={e => setId(e.target.value)}
            placeholder="e.g., my-data"
            style={{ width: '100%', boxSizing: 'border-box', padding: '4px 6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>
      )}

      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'block', fontSize: '12px', marginBottom: '2px' }}>File Access Point:</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="text"
            value={selectedFapId}
            readOnly
            placeholder="Select a file access point"
            style={{ flex: 1, padding: '4px 6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#fff' }}
          />
          <button
            onClick={() => { setShowFapSelector(!showFapSelector); setShowDirSelector(false); }}
            style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: '#2196F3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {selectedFapId ? 'Change' : 'Select'}
          </button>
        </div>
        {showFapSelector && (
          <div style={{ marginTop: '6px' }}>
            <FileAccessPointSelector
              fileAccessPoints={fileStore.getAllFap()}
              isLoading={fileStore.fileAccessPointsIsLoading}
              onSelect={fap => {
                setSelectedFapId(fap.id);
                setShowFapSelector(false);
                setShowDirSelector(false);
              }}
              onRefresh={() => fileStore.refreshFap()}
            />
          </div>
        )}
      </div>

      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'block', fontSize: '12px', marginBottom: '2px' }}>Folder Path (relative, leave empty for FAP root):</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="text"
            value={selectedPath}
            onChange={e => setSelectedPath(e.target.value)}
            placeholder="e.g., data/exports"
            style={{ flex: 1, padding: '4px 6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
          <button
            onClick={() => { setShowDirSelector(!showDirSelector); setShowFapSelector(false); }}
            disabled={!selectedFapId}
            style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: selectedFapId ? '#2196F3' : '#ccc', color: '#fff', border: 'none', borderRadius: '4px', cursor: selectedFapId ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
          >
            Browse
          </button>
        </div>
        {showDirSelector && selectedFapId && (
          <div style={{ marginTop: '6px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#fff' }}>
            <DirSelector
              backendUrl={backendUrl}
              fileAccessPointId={selectedFapId}
              initialPath="/"
              onConfirm={selectedDir => {
                let rel = selectedDir.path || '';
                if (rel.startsWith('/')) rel = rel.substring(1);
                setSelectedPath(rel);
                setShowDirSelector(false);
              }}
              onCancel={() => setShowDirSelector(false)}
              height={360}
              title="Select Folder"
            />
          </div>
        )}
      </div>

      {error && (
        <div style={{ fontSize: '12px', color: '#dc3545', marginBottom: '6px' }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={handleConfirm}
          disabled={!selectedFapId || (mode === 'create' && !id.trim())}
          style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', opacity: (!selectedFapId || (mode === 'create' && !id.trim())) ? 0.6 : 1 }}
        >
          {mode === 'update' ? 'Update' : 'Add'}
        </button>
        <button
          onClick={onCancel}
          style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: '#999', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const FileAccessCard = ({ fileAccess, backendUrl, onEdit, onDelete }) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const addedAtStr = fileAccess.addedAt ? new Date(fileAccess.addedAt).toLocaleString() : '';

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '8px', backgroundColor: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{fileAccess.id}</div>
          <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
            <span style={{ fontWeight: 'bold' }}>FAP:</span> {fileAccess.fileAccessPointId}
            {' • '}
            <span style={{ fontWeight: 'bold' }}>Path:</span> {fileAccess.path || '(root)'}
            {addedAtStr && <> {' • '}<span>Added: {addedAtStr}</span></>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginLeft: '8px' }}>
          <button
            onClick={() => onEdit(fileAccess)}
            style={{ padding: '2px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#2196F3', display: 'flex', alignItems: 'center' }}
          >
            <EditIcon width={14} height={14} />
          </button>
          <button
            onClick={() => setIsConfirmingDelete(true)}
            style={{ padding: '2px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#dc3545', display: 'flex', alignItems: 'center' }}
          >
            <DeleteIcon width={14} height={14} />
          </button>
        </div>
      </div>
      {isConfirmingDelete && (
        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: '#dc3545' }}>Remove this file access?</span>
          <button
            onClick={() => { setIsConfirmingDelete(false); onDelete(fileAccess.id); }}
            style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Remove
          </button>
          <button
            onClick={() => setIsConfirmingDelete(false)}
            style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: '#999', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

const MongoAppFileAccess = observer(({ store }) => {
  const fallbackMongoDocStoreRef = useRef({
    docs: new Map(),
    setDoc(doc) { if (doc?.id) this.docs.set(doc.id, doc); },
    getDoc(id) { return this.docs.get(id); },
    removeDoc(id) { this.docs.delete(id); },
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFileAccess, setEditingFileAccess] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const appId = store?.appId;
  const backendUrl = store?.backendUrl;

  useEffect(() => {
    initFileStore({
      mongoDocStore: fallbackMongoDocStoreRef.current,
      updateDocField: async () => ({ code: -1, message: 'not available' }),
      getBackendServerUrl: () => store?.backendUrl || '',
    });
    // Always (re-)fetch FAPs into the fresh doc store after initialization
    if (store?.backendUrl) {
      fileStore.fetchFap();
    }
  }, [store, backendUrl]);

  const fetchFileAccesses = useCallback(async () => {
    if (!appId || !backendUrl) return;
    await mongoAppFapStore.fetchMongoAppFileAccesses(backendUrl, appId);
  }, [appId, backendUrl]);

  useEffect(() => {
    fetchFileAccesses();
  }, [fetchFileAccesses]);

  const showMsg = (msg) => {
    setActionMessage(msg);
    setActionError(null);
    setTimeout(() => setActionMessage(null), 3000);
  };

  const showErr = (msg) => {
    setActionError(msg);
    setActionMessage(null);
  };

  const handleAdd = async ({ id, fileAccessPointId, path }) => {
    const result = await mongoAppFapStore.addMongoAppFileAccess(backendUrl, appId, id, fileAccessPointId, path);
    if (result.code === 0) {
      setShowAddForm(false);
      showMsg('File access added');
    } else {
      showErr(result.message || 'Failed to add');
    }
  };

  const handleUpdate = async ({ id, fileAccessPointId, path }) => {
    const result = await mongoAppFapStore.updateMongoAppFileAccess(backendUrl, appId, id, fileAccessPointId, path);
    if (result.code === 0) {
      setEditingFileAccess(null);
      showMsg('File access updated');
    } else {
      showErr(result.message || 'Failed to update');
    }
  };

  const handleDelete = async (id) => {
    const result = await mongoAppFapStore.removeMongoAppFileAccess(backendUrl, appId, id);
    if (result.code === 0) {
      showMsg('File access removed');
    } else {
      showErr(result.message || 'Failed to remove');
    }
  };

  return (
    <div style={{ padding: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={fetchFileAccesses}
            style={{ padding: '2px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#4CAF50', display: 'flex', alignItems: 'center' }}
            title="Refresh"
          >
            <RefreshIcon width={14} height={14} />
          </button>
          {mongoAppFapStore.isLoading && <span style={{ fontSize: '12px', color: '#999' }}>Loading...</span>}
        </div>
        <button
          onClick={() => { setShowAddForm(!showAddForm); setEditingFileAccess(null); }}
          style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <PlusIcon width={12} height={12} /> Add
        </button>
      </div>

      {actionError && (
        <div style={{ fontSize: '12px', color: '#dc3545', marginBottom: '6px', padding: '4px 8px', border: '1px solid #f5c6cb', borderRadius: '4px', backgroundColor: '#fff3f5' }}>
          {actionError}
        </div>
      )}
      {actionMessage && (
        <div style={{ fontSize: '12px', color: '#2e7d32', marginBottom: '6px', padding: '4px 8px', border: '1px solid #c8e6c9', borderRadius: '4px', backgroundColor: '#f1f8f1' }}>
          {actionMessage}
        </div>
      )}

      {showAddForm && (
        <MongoAppFileAccessCreaetOrUpdate
          mode="create"
          backendUrl={backendUrl}
          onConfirm={handleAdd}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {mongoAppFapStore.error && (
        <div style={{ fontSize: '12px', color: '#dc3545', padding: '6px', backgroundColor: '#fff3f5', borderRadius: '4px', marginBottom: '6px' }}>
          {mongoAppFapStore.error}
        </div>
      )}

      {mongoAppFapStore.mongoAppsFileAccess.length === 0 && !mongoAppFapStore.isLoading ? (
        <div style={{ fontSize: '12px', color: '#999', textAlign: 'center', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          No file accesses configured yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {mongoAppFapStore.mongoAppsFileAccess.map(fileAccess => (
            editingFileAccess?.id === fileAccess.id ? (
              <MongoAppFileAccessCreaetOrUpdate
                key={fileAccess.id}
                mode="update"
                backendUrl={backendUrl}
                initialId={fileAccess.id}
                initialFapId={fileAccess.fileAccessPointId}
                initialPath={fileAccess.path || ''}
                onConfirm={handleUpdate}
                onCancel={() => setEditingFileAccess(null)}
              />
            ) : (
              <FileAccessCard
                key={fileAccess.id}
                fileAccess={fileAccess}
                backendUrl={backendUrl}
                onEdit={fa => { setEditingFileAccess(fa); setShowAddForm(false); }}
                onDelete={handleDelete}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
});

export default MongoAppFileAccess;
