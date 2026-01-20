import React, { useState, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { SpinningCircle } from '@wwf971/react-comp-misc';
import { backendServerUrlAtom, testBackendConnection } from './dataStore';
import '../styles/testSection.css';
import './backendServer.css';

const BackendServerTestConnection = () => {
  const backendUrl = useAtomValue(backendServerUrlAtom);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const abortControllerRef = useRef(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    abortControllerRef.current = new AbortController();
    
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }, 130000);
    
    try {
      const response = await fetch(`${backendUrl}/actuator/health`, {
        method: 'GET',
        signal: abortControllerRef.current.signal
      });
      const result = await response.json();
      
      clearTimeout(timeoutId);
      
      const testResult = {
        success: result.status === 'UP',
        message: result.status === 'UP' ? 'Connection successful' : 'Server is not healthy'
      };
      
      setTestResult(testResult);
    } catch (error) {
      clearTimeout(timeoutId);
      
      let testResult;
      if (error.name === 'AbortError') {
        testResult = {
          success: false,
          message: 'Connection test aborted'
        };
      } else {
        testResult = {
          success: false,
          message: error.message || 'Connection failed'
        };
      }
      
      setTestResult(testResult);
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
    <>
      <div className="section-title">Test Backend Connection</div>
      
      <div className="test-action-section">
        <div className="test-description">
          Click the button below to test the connection to the backend server.
        </div>
        
        <div className="test-buttons">
          {testing ? (
            <button 
              onClick={handleAbort}
              className="test-button-container testing"
            >
              <SpinningCircle width={14} height={14} color="white" />
              <span>Testing... (Click to abort)</span>
            </button>
          ) : (
            <button 
              onClick={handleTest}
              className="test-button-container ready"
            >
              Test Connection
            </button>
          )}
        </div>
        
        {testResult && (
          <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
            <strong>{testResult.success ? 'Success' : 'Failed'}</strong>
            <div className="result-message">{testResult.message}</div>
          </div>
        )}
      </div>
    </>
  );
};

export default BackendServerTestConnection;
