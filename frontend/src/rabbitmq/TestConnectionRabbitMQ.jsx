import React, { useState, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { KeyValues, SpinningCircle } from '@wwf971/react-comp-misc';
import { rabbitMQComputedConfigAtom, getBackendServerUrl } from '../remote/dataStore';
import '../styles/testSection.css';
import './rabbitmq.css';

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
          <div className="test-loading">Loading configuration...</div>
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
            className="test-button"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          
          {testing && (
            <button 
              onClick={handleAbort}
              className="abort-button"
            >
              Abort
            </button>
          )}
        </div>
        
        {testing && (
          <div className="test-progress">
            <SpinningCircle size={20} />
            <span>Testing connection...</span>
          </div>
        )}
        
        {result && (
          <div className={`test-result ${result.success ? 'success' : 'error'}`}>
            <strong>{result.success ? '✓ Success' : '✗ Failed'}</strong>
            <div className="result-message">{result.message}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestConnectionRabbitMQ;
