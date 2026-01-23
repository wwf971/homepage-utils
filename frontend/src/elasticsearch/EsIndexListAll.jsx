import React, { useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { SpinningCircle, RefreshIcon, PlusIcon } from '@wwf971/react-comp-misc';
import { 
  esIndicesAtom, 
  esSelectedIndexAtom
} from '../remote/dataStore';
import { fetchEsIndices } from './EsStore';
import CreateIndex from './CreateIndex';
import './elasticsearch.css';

/**
 * EsIndexListAll - Component for listing all indices in Elasticsearch
 * 
 * @param {Function} onTestConnection - Callback to trigger connection test
 * @param {boolean} hasSuccessfulTest - Whether a successful test result exists
 * @param {boolean} isTestingConnection - Whether a connection test is in progress
 */
const EsIndexListAll = ({ onTestConnection, hasSuccessfulTest, isTestingConnection }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  
  const indices = useAtomValue(esIndicesAtom);
  const selectedIndexName = useAtomValue(esSelectedIndexAtom);
  const setIndices = useSetAtom(esIndicesAtom);
  const setSelectedIndexName = useSetAtom(esSelectedIndexAtom);

  // Auto-fetch indices when test succeeds
  React.useEffect(() => {
    const handleTestSuccess = () => {
      loadIndices(true); // Skip test check since we know test just succeeded
    };
    
    const handleIndicesChanged = () => {
      loadIndices(true); // Reload indices when they change (e.g., after delete/rename)
    };
    
    window.addEventListener('elasticsearch-test-success', handleTestSuccess);
    window.addEventListener('elasticsearch-indices-changed', handleIndicesChanged);
    return () => {
      window.removeEventListener('elasticsearch-test-success', handleTestSuccess);
      window.removeEventListener('elasticsearch-indices-changed', handleIndicesChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadIndices = async (skipTestCheck = false, forceRefresh = false) => {
    // If no successful test yet, trigger test first (unless skipTestCheck is true)
    if (!skipTestCheck && !hasSuccessfulTest && onTestConnection) {
      const testResult = await onTestConnection();
      if (!testResult || !testResult.success) {
        // Test failed, don't proceed
        return;
      }
    }

    // Clear previous indices and show spinner
    setIndices([]);
    setLoading(true);
    setError(null);

    const result = await fetchEsIndices(forceRefresh);
    
    if (result.code === 0) {
      setIndices(result.data);
    } else {
      setError(result.message);
    }
    
    setLoading(false);
  };

  const handleIndexClick = (indexName) => {
    setSelectedIndexName(indexName);
  };

  const handleCreateSuccess = (newIndexName) => {
    // Select the newly created index
    setSelectedIndexName(newIndexName);
  };

  return (
    <div className="es-indices-section">
      <div className="es-section-header">
        <div className="section-title">Elasticsearch Indices</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button 
            onClick={() => setShowCreatePanel(true)}
            disabled={loading || isTestingConnection}
            className="es-refresh-button"
            title="Create Index"
          >
            <PlusIcon width={16} height={16} />
          </button>
        <button 
            onClick={() => loadIndices(false, true)}
          disabled={loading || isTestingConnection}
          className="es-refresh-button"
            title="Refresh"
        >
          <RefreshIcon width={16} height={16} />
        </button>
        </div>
      </div>
      
      <div style={{ marginBottom: '4px' }}>
        <p>List all indices available in the connected Elasticsearch cluster.</p>
        
        {!hasSuccessfulTest && !isTestingConnection && (
          <p style={{ 
            fontSize: '12px', 
            color: '#666', 
            marginTop: '8px',
            fontStyle: 'italic'
          }}>
            Note: This will test the connection first if not already tested.
          </p>
        )}
      </div>

      {error && (
        <div className="test-result error" style={{ marginTop: '12px' }}>
          <strong>✗ Error</strong>
          <div className="result-message">{error}</div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
          <SpinningCircle width={16} height={16} color="#666" />
          <span>Loading indices...</span>
        </div>
      )}

      {!loading && Array.isArray(indices) && indices.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <h4 style={{ marginBottom: '8px' }}>
            Found {indices.length} {indices.length !== 1 ? 'indices' : 'index'}:
          </h4>
          <div className="es-tags-container">
            {indices.map((index, idx) => (
              <span 
                key={idx} 
                className={`es-tag es-tag-clickable ${selectedIndexName === index ? 'es-tag-selected' : ''}`}
                onClick={() => handleIndexClick(index)}
              >
                {index}
              </span>
            ))}
          </div>
        </div>
      )}

      {!loading && Array.isArray(indices) && indices.length === 0 && !error && (
        <div style={{ marginTop: '12px' }}>
          <p style={{ color: '#666', fontStyle: 'italic' }}>
            No indices found. Click the + button to create a new index.
          </p>
        </div>
      )}

      {showCreatePanel && (
        <CreateIndex 
          onClose={() => setShowCreatePanel(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
};

export default EsIndexListAll;

