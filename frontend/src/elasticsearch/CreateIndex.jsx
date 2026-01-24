import React, { useState } from 'react';
import { useStore } from 'jotai';
import { SpinningCircle } from '@wwf971/react-comp-misc';
import { createEsIndex } from './EsStore';
import './elasticsearch.css';

/**
 * CreateIndex - Panel component for creating a new Elasticsearch index
 * 
 * @param {function} onClose - Callback when panel is closed
 * @param {function} onSuccess - Callback when index is successfully created
 */
const CreateIndex = ({ onClose, onSuccess }) => {
  const [indexName, setIndexName] = useState('');
  const [indexMapping, setIndexMapping] = useState('');
  const [creating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);
  const [jsonError, setJsonError] = useState(null);
  const [isCharLevelIndex, setIsCharLevelIndex] = useState(false);
  
  const store = useStore();
  const getAtomValue = (atom) => store.get(atom);
  const setAtomValue = (atom, value) => store.set(atom, value);

  const validateJson = (jsonStr) => {
    if (!jsonStr.trim()) {
      return { valid: true, value: {} }; // Empty is valid, will use default
    }
    
    try {
      const parsed = JSON.parse(jsonStr);
      return { valid: true, value: parsed };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  };

  const getCharLevelIndexTemplate = () => {
    return JSON.stringify({
      "settings": {
        "number_of_shards": 1,
        "analysis": {
          "analyzer": {
            "char_analyzer": {
              "type": "custom",
              "tokenizer": "char_tokenizer",
              "filter": []
            }
          },
          "tokenizer": {
            "char_tokenizer": {
              "type": "pattern",
              "pattern": ""
            }
          }
        }
      },
      "mappings": {
        "properties": {
          "flat": {
            "type": "nested",
            "properties": {
              "path": {
                "type": "text",
                "analyzer": "char_analyzer",
                "term_vector": "with_positions_offsets"
              },
              "value": {
                "type": "text",
                "analyzer": "char_analyzer",
                "term_vector": "with_positions_offsets"
              }
            }
          }
        }
      }
    }, null, 2);
  };

  const handleCharLevelCheckboxChange = (e) => {
    const checked = e.target.checked;
    setIsCharLevelIndex(checked);
    
    if (checked) {
      setIndexMapping(getCharLevelIndexTemplate());
      setJsonError(null);
    } else {
      setIndexMapping('');
    }
  };

  const handleJsonChange = (e) => {
    const value = e.target.value;
    setIndexMapping(value);
    
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
    if (!indexName.trim()) {
      setError('Index name is required');
      return;
    }

    // Validate JSON one more time
    const validation = validateJson(indexMapping);
    if (!validation.valid) {
      setJsonError(validation.error);
      return;
    }

    setIsCreating(true);
    setError(null);

    const result = await createEsIndex(indexName.trim(), validation.value, getAtomValue, setAtomValue);
    
    if (result.code === 0) {
      // Cache invalidation is already handled inside createEsIndex
      // Trigger refresh event
      window.dispatchEvent(new CustomEvent('elasticsearch-indices-changed'));
      if (onSuccess) {
        onSuccess(indexName.trim());
      }
      onClose();
    } else {
      setError(result.message);
    }
    
    setIsCreating(false);
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
          <div className="panel-title">Create New Index</div>
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
            <label>Index Name *</label>
            <input
              type="text"
              value={indexName}
              onChange={(e) => setIndexName(e.target.value)}
              disabled={creating}
              placeholder="e.g., my-index"
              className="es-input"
              autoFocus
            />
          </div>

          <div className="es-form-field">
            <label className="es-checkbox-label">
              <input
                type="checkbox"
                checked={isCharLevelIndex}
                onChange={handleCharLevelCheckboxChange}
                disabled={creating}
              />
              Create character-level index (for precise text search)
            </label>
          </div>

          <div className="es-form-field">
            <label>Index Mapping (JSON, optional)</label>
            <textarea
              value={indexMapping}
              onChange={handleJsonChange}
              disabled={creating || isCharLevelIndex}
              placeholder={'{\n  "settings": {\n    "number_of_shards": 1\n  },\n  "mappings": {\n    "properties": {\n      "field_name": { "type": "text" }\n    }\n  }\n}'}
              className="es-textarea"
              rows={12}
              style={{ backgroundColor: isCharLevelIndex ? '#f5f5f5' : 'white' }}
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
            disabled={creating || !indexName.trim() || !!jsonError}
            className="es-button-primary"
          >
            {creating ? (
              <>
                <SpinningCircle width={14} height={14} color="white" />
                <span style={{ marginLeft: '6px' }}>Creating...</span>
              </>
            ) : (
              'Create Index'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateIndex;

