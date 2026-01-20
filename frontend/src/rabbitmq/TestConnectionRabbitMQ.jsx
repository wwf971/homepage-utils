import React, { useState, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { KeyValues, SpinningCircle } from '@wwf971/react-comp-misc';
import { rabbitMQComputedConfigAtom, getBackendServerUrl } from '../remote/dataStore';
import '../styles/testSection.css';

export const TestConnectionRabbitMQ = () => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const configRaw = useAtomValue(rabbitMQComputedConfigAtom);
  const config = Array.isArray(configRaw) ? configRaw : [];
  const abortControllerRef = useRef(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    
    abortControllerRef.current = new AbortController();
    
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }, 10000);
    
    try {
      const backendUrl = getBackendServerUrl();
      const response = await fetch(`${backendUrl}/rabbitmq/test/`, { 
        method: 'POST',
        signal: abortControllerRef.current.signal
      });
      const data = await response.json();
      
      clearTimeout(timeoutId);
      
      const testResult = {
        success: data.code === 0,
        message: data.code === 0 ? data.data : data.message
      };
      
      setResult(testResult);
      return testResult;
    } catch (error) {
      clearTimeout(timeoutId);
      
      let testResult;
      if (error.name === 'AbortError') {
        testResult = {
          success: false,
          message: 'Connection test was aborted (timeout or manual abort)'
        };
      } else {
        testResult = {
          success: false,
          message: `Failed to test connection: ${error.message}`
        };
      }
      
      setResult(testResult);
      return testResult;
    } finally {
      setTesting(false);
      abortControllerRef.current = null;
    }
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div className="main-panel">
      <h3>Test RabbitMQ Connection</h3>
      
      <div className="test-config-section">
        <div className="test-section-title">Current Config (Computed)</div>
        {config.length === 0 ? (
          <div style={{ padding: '12px', color: '#666' }}>Loading configuration...</div>
        ) : (
          <KeyValues data={config} isEditable={false} />
        )}
      </div>
      
      <div className="test-action-section">
        <div className="test-description">Click the button below to test the RabbitMQ connection using the above configuration.</div>
        
        <div className="test-buttons">
          <button 
            onClick={handleTest}
            disabled={testing}
            style={{
              padding: '8px 16px',
              cursor: testing ? 'not-allowed' : 'pointer',
              backgroundColor: testing ? '#ccc' : '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              marginRight: '8px'
            }}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          
          {testing && (
            <button 
              onClick={handleAbort}
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                backgroundColor: '#dc3545',
                color: '#fff',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              Abort
            </button>
          )}
        </div>
        
        {testing && (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SpinningCircle size={20} />
            <span>Testing connection...</span>
          </div>
        )}
        
        {result && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            borderRadius: '4px',
            backgroundColor: result.success ? '#d4edda' : '#f8d7da',
            border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`,
            color: result.success ? '#155724' : '#721c24'
          }}>
            <strong>{result.success ? '✓ Success' : '✗ Failed'}</strong>
            <div style={{ marginTop: '8px' }}>{result.message}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestConnectionRabbitMQ;
