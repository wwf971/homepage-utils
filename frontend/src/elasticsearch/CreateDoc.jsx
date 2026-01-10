import React, { useState } from 'react';
import { SpinningCircle } from '@wwf971/react-comp-misc';
import { createElasticsearchDocument } from './EsStore';
import './elasticsearch.css';

/**
 * CreateDoc - Panel component for creating a new Elasticsearch document
 * 
 * @param {string} indexName - Name of the index to create document in
 * @param {function} onClose - Callback when panel is closed
 * @param {function} onSuccess - Callback when document is successfully created
 */
const CreateDoc = ({ indexName, onClose, onSuccess }) => {
  const [docJson, setDocJson] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [jsonError, setJsonError] = useState(null);

  const validateJson = (jsonStr) => {
    if (!jsonStr.trim()) {
      return { valid: true, value: {} }; // Empty is valid, will create empty doc
    }
    
    try {
      const parsed = JSON.parse(jsonStr);
      return { valid: true, value: parsed };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  };

  const handleJsonChange = (e) => {
    const value = e.target.value;
    setDocJson(value);
    
    // Validate JSON on change
    if (value.trim()) {
      const validation = validateJson(value);
      if (!validation.valid) {
        setJsonError(validation.error);
      } else {
        setJsonError(null);
      }
    } else {
      setJsonError(null);
    }
  };

  const handleCreate = async () => {
    // Validate JSON one more time
    const validation = validateJson(docJson);
    if (!validation.valid) {
      setJsonError(validation.error);
      return;
    }

    setCreating(true);
    setError(null);

    const result = await createElasticsearchDocument(indexName, validation.value);
    
    if (result.code === 0) {
      if (onSuccess) {
        onSuccess(result.data);
      }
      onClose();
    } else {
      setError(result.message);
    }
    
    setCreating(false);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !creating) {
      onClose();
    }
  };

  return (
    <div className="es-create-panel-backdrop" onClick={handleBackdropClick}>
      <div className="es-create-panel">
        <div className="es-create-panel-header">
          <h3>Create New Document in "{indexName}"</h3>
          <button 
            onClick={onClose} 
            disabled={creating}
            className="es-close-button"
          >
            ✕
          </button>
        </div>

        <div className="es-create-panel-body">
          <div className="es-form-field">
            <label>Document JSON (optional)</label>
            <textarea
              value={docJson}
              onChange={handleJsonChange}
              disabled={creating}
              placeholder={'{\n  "field_name": "value",\n  "another_field": 123\n}\n\nLeave empty to create an empty document'}
              className="es-textarea"
              rows={12}
            />
            <div className={`es-validation-error ${jsonError ? 'visible' : ''}`}>
              {jsonError || 'No error'}
            </div>
          </div>

          {error && (
            <div className="es-error-message">
              {error}
            </div>
          )}
        </div>

        <div className="es-create-panel-footer">
          <button 
            onClick={onClose}
            disabled={creating}
            className="es-button-secondary"
          >
            Cancel
          </button>
          <button 
            onClick={handleCreate}
            disabled={creating || !!jsonError}
            className="es-button-primary"
          >
            {creating ? (
              <>
                <SpinningCircle width={14} height={14} color="white" />
                <span style={{ marginLeft: '6px' }}>Creating...</span>
              </>
            ) : (
              'Create Document'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateDoc;

