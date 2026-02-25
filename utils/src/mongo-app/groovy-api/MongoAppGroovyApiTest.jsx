import React, { useState, useEffect, useCallback } from 'react';
import { RefreshIcon } from '@wwf971/react-comp-misc';
const MongoAppGroovyApiTest = ({ store }) => {
  const [scripts, setScripts] = useState({});
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [requestBody, setRequestBody] = useState('{}');
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoadingg] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const appId = store?.appId;
  const serverUrl = store?.serverUrl;

  const fetchScripts = useCallback(async () => {
    if (!appId || !serverUrl) return;
    
    setIsLoadingg(true);
    setError(null);
    
    try {
      const response = await fetch(`${serverUrl}/mongo-app/${appId}/api-config/list`);
      const result = await response.json();
      
      if (result.code === 0) {
        const fetchedScripts = result.data || {};
        setScripts(fetchedScripts);
        
        // Auto-select first endpoint if none selected
        if (!selectedEndpoint && Object.keys(fetchedScripts).length > 0) {
          const firstScript = Object.values(fetchedScripts)[0];
          const apiPath = firstScript.apiPath || firstScript.endpoint;
          setSelectedEndpoint(apiPath);
        }
      } else {
        setError(result.message || 'Failed to fetch scripts');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoadingg(false);
    }
  }, [appId, serverUrl, selectedEndpoint]);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  const executeScript = async () => {
    if (!selectedEndpoint) {
      setError('Please select an endpoint');
      return;
    }

    setError(null);
    setResponse(null);
    setIsExecuting(true);

    let params = {};
    try {
      params = JSON.parse(requestBody);
    } catch (e) {
      setError('Invalid JSON in request body');
      setIsExecuting(false);
      return;
    }

    try {
      const res = await fetch(`${serverUrl}/mongo-app/${appId}/api/${selectedEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      
      const result = await res.json();
      setResponse(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsExecuting(false);
    }
  };

  const forceRefresh = async () => {
    await fetchScripts();
  };

  const scriptsArray = Object.values(scripts);

  return (
    <div style={{ padding: '6px 8px' }}>
      <div className="section-title">Test MongoApp Groovy APIs</div>

      <div style={{ marginTop: '0px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '4px', gap: '4px' }}>
          <label style={{ fontWeight: 'bold', fontSize: '12px' }}>
            Available APIs {scriptsArray.length > 0 && `(${scriptsArray.length})`}
          </label>
          <button
            onClick={forceRefresh}
            disabled={isLoading}
            className="mongo-app-refresh-button"
          >
            <RefreshIcon width={16} height={16} />
          </button>
        </div>
        {scriptsArray.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic', fontSize: '12px', padding: '4px 0' }}>
            {isLoading ? 'Loading...' : 'No APIs available'}
          </div>
        ) : (
          <div className="mongo-tags-container">
            {scriptsArray.map(script => {
              const apiPath = script.apiPath || script.endpoint;
              return (
                <span
                  key={script.id}
                  className={`mongo-tag mongo-tag-clickable ${selectedEndpoint === apiPath ? 'mongo-tag-selected' : ''}`}
                  onClick={() => setSelectedEndpoint(apiPath)}
                  title={script.description || apiPath}
                >
                  {apiPath}
                </span>
              );
            })}
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
            fontSize: '12px',
            boxSizing: 'border-box'
          }}
          placeholder='{"key": "value"}'
        />
      </div>

      <div style={{ marginTop: '12px' }}>
        <button
          onClick={executeScript}
          disabled={isExecuting || !selectedEndpoint}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            background: isExecuting || !selectedEndpoint ? '#ccc' : '#4CAF50',
            color: '#fff',
            cursor: isExecuting || !selectedEndpoint ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '12px'
          }}
        >
          {isExecuting ? 'Executing...' : 'Execute API'}
        </button>
      </div>

      {error && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c33',
          fontSize: '12px'
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
            maxHeight: '400px',
            margin: 0,
            fontFamily: 'monospace'
          }}>
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default MongoAppGroovyApiTest;
