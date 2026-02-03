import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import groovyApiStore from './groovyApiStore';

const GroovyApiTest = observer(({ refreshTrigger }) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [requestBody, setRequestBody] = useState('{}');
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadScripts();
  }, [refreshTrigger]);

  const loadScripts = async () => {
    await groovyApiStore.fetchScripts(false);
    
    if (groovyApiStore.scriptsArray.length > 0 && !selectedEndpoint) {
      setSelectedEndpoint(groovyApiStore.scriptsArray[0].endpoint);
    }
  };

  const executeScript = async () => {
    if (!selectedEndpoint) {
      setError('Please select an endpoint');
      return;
    }

    setError(null);
    setResponse(null);

    let params = {};
    try {
      params = JSON.parse(requestBody);
    } catch (e) {
      setError('Invalid JSON in request body');
      return;
    }

    const result = await groovyApiStore.executeScript(selectedEndpoint, params);
    
    if (result.success) {
      setResponse(result.data);
    } else {
      setError(result.error);
    }
  };

  const forceRefresh = async () => {
    await groovyApiStore.reload();
  };

  return (
    <div style={{ padding: '6px 8px' }}>
      <div className="section-title">Test Groovy API Endpoints</div>

      <div style={{ marginTop: '0px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <label style={{ fontWeight: 'bold', fontSize: '12px' }}>
            Available Endpoints {groovyApiStore.scriptsArray.length > 0 && `(${groovyApiStore.scriptsArray.length})`}:
          </label>
          <button
            onClick={forceRefresh}
            style={{
              padding: '4px 10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            Refresh
          </button>
        </div>
        {groovyApiStore.scriptsArray.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic', fontSize: '12px', padding: '4px 0' }}>
            {groovyApiStore.loading ? 'Loading...' : 'No endpoints available'}
          </div>
        ) : (
          <div className="mongo-tags-container">
            {groovyApiStore.scriptsArray.map(script => (
              <span
                key={script.id}
                className={`mongo-tag mongo-tag-clickable ${selectedEndpoint === script.endpoint ? 'mongo-tag-selected' : ''}`}
                onClick={() => setSelectedEndpoint(script.endpoint)}
                title={script.description || script.endpoint}
              >
                {script.endpoint}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: '12px' }}>
        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
          Request Body (JSON):
        </label>
        <textarea
          value={requestBody}
          onChange={(e) => setRequestBody(e.target.value)}
          style={{
            width: '100%',
            minHeight: '100px',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}
          placeholder='{"key": "value"}'
        />
      </div>

      <div style={{ marginTop: '12px' }}>
        <button
          onClick={executeScript}
          disabled={groovyApiStore.loading || !selectedEndpoint}
          className="rabbitmq-publish-button"
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            background: groovyApiStore.loading || !selectedEndpoint ? '#ccc' : '#4CAF50',
            color: '#fff',
            cursor: groovyApiStore.loading || !selectedEndpoint ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {groovyApiStore.loading ? 'Executing...' : 'Execute Script'}
        </button>
      </div>

      {error && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c33'
        }}>
          {error}
        </div>
      )}

      {response && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '4px' }}>
            Response:
          </div>
          <pre style={{
            padding: '12px',
            background: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '12px',
            overflow: 'auto',
            maxHeight: '400px'
          }}>
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
});

export default GroovyApiTest;
