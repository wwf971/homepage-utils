import React, { useState, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { PanelWithToggle, KeyValues, SpinningCircle } from '@wwf971/react-comp-misc';
import { esComputedConfigAtom, getBackendServerUrl } from '../remote/dataStore';
import '../styles/common.css';

/**
 * ElasticSearch connection test area component
 */
export const EsTestConnection = ({ onTestSuccess, onTestResult, isTestingConnection }) => {
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
    }, 100000);
    
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
      
      // Notify parent about test result
      if (onTestResult) {
        onTestResult(testResult);
      }
      
      // Auto-fetch indices after successful test
      if (testResult.success && onTestSuccess) {
        onTestSuccess();
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
      if (onTestResult) {
        onTestResult(testResult);
      }
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
    <PanelWithToggle title="Test Elasticsearch Connection" defaultExpanded={true}>

      <div className="test-config-section">
        <div className="section-title">Current Config(Computed)</div>
        {config.length === 0 ? (
          <div style={{ padding: '12px', color: '#666' }}>Loading configuration...</div>
        ) : (
          <KeyValues data={config} isEditable={false} />
        )}
      </div>
      
      <div className="test-action-section">
        <div className="test-description">Click the button below to test the connection with the above configuration.</div>
        
        <div className="test-buttons">
          <button 
            onClick={handleTest} 
            disabled={testing || isTestingConnection}
            className="test-button"
          >
            {(testing || isTestingConnection) ? (
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
    </PanelWithToggle>
  );
};

export default EsTestConnection;
