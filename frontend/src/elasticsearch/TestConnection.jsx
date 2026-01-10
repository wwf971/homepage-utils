import React, { useState, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { KeyValues, SpinningCircle } from '@wwf971/react-comp-misc';
import { esComputedConfigAtom, esSelectedIndexAtom, getBackendServerUrl } from '../remote/dataStore';
import ListIndices from './ListIndices';
import IndexInfo from './IndexInfo';
import ListDocs from './ListDocs';
import SearchDoc from './SearchDoc';

export const TestConnection = ({ showIndexList = false }) => {
  const selectedIndex = useAtomValue(esSelectedIndexAtom);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const config = useAtomValue(esComputedConfigAtom);
  const abortControllerRef = useRef(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    
    abortControllerRef.current = new AbortController();
    
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }, 130000);
    
    try {
      const backendUrl = getBackendServerUrl();
      const response = await fetch(`${backendUrl}/elasticsearch/test/`, { 
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
      
      // Auto-fetch indices after successful test
      if (testResult.success && showIndexList) {
        // Trigger index fetch by dispatching a custom event
        window.dispatchEvent(new CustomEvent('elasticsearch-test-success'));
      }
      
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
    <div className="connection-test">
      <h3>Test Elasticsearch Connection</h3>
      
      <div className="test-config-section">
        <h4>Current Config(Computed)</h4>
        {config.length === 0 ? (
          <div style={{ padding: '12px', color: '#666' }}>Loading configuration...</div>
        ) : (
          <KeyValues data={config} isEditable={false} />
        )}
      </div>
      
      <div className="test-action-section">
        <p>Click the button below to test the connection with the above configuration.</p>
        
        <div className="test-buttons">
          <button 
            onClick={handleTest} 
            disabled={testing}
            className="test-button"
          >
            {testing ? (
              <>
                <SpinningCircle width={16} height={16} color="white" />
                <span style={{ marginLeft: '8px' }}>Testing...</span>
              </>
            ) : (
              'Test Connection'
            )}
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
        
        {result && (
          <div className={`test-result ${result.success ? 'success' : 'error'}`}>
            <strong>{result.success ? '✓ Success' : '✗ Failed'}</strong>
            <div className="result-message" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{result.message}</div>
          </div>
        )}
      </div>

      {showIndexList && (
        <>
          <ListIndices 
            onTestConnection={handleTest}
            hasSuccessfulTest={result?.success}
            isTestingConnection={testing}
          />
          
          {selectedIndex && (
            <>
              <IndexInfo />
              <SearchDoc />
              <ListDocs />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default TestConnection;

