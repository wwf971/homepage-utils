import React, { useState, useRef, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { KeyValues, SpinningCircle, TabsOnTop } from '@wwf971/react-comp-misc';
import { mongoComputedConfigAtom, mongoSelectedDatabaseAtom, mongoSelectedCollectionAtom, getBackendServerUrl } from '../remote/dataStore';
import '../styles/testSection.css';
import ListDatabases from './ListDatabases';
import CollListAll from './CollListAll';
import MongoDocSearch from './MongoDocSearch';
import DocListAll from './DocListAll';
import MongoIndexPanel from '../mongo-index/MongoIndexPanel';

/**
 * Wrapper component for DocListAll that handles tab focus logic and connection test requirements
 */
const DocListAllTabWrapper = ({ hasSuccessfulTest, tabsState, tabKey }) => {
  const [hasBeenFocused, setHasBeenFocused] = useState(false);
  
  const isTabFocused = tabKey && tabsState ? tabsState[tabKey]?.isFocused : false;
  
  useEffect(() => {
    if (isTabFocused && !hasBeenFocused) {
      setHasBeenFocused(true);
    }
  }, [isTabFocused, hasBeenFocused]);
  
  // Only allow loading if both conditions are met: connection test passed AND tab has been focused
  const shouldLoad = hasSuccessfulTest && hasBeenFocused;
  
  return <DocListAll shouldLoad={shouldLoad} />;
};

const ConnectionTest = ({ showDatabaseList = false }) => {
  const selectedDatabase = useAtomValue(mongoSelectedDatabaseAtom);
  const selectedCollection = useAtomValue(mongoSelectedCollectionAtom);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const config = useAtomValue(mongoComputedConfigAtom);
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
      const response = await fetch(`${backendUrl}/mongo/test/`, { 
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
      
      // Auto-fetch databases after successful test
      if (testResult.success && showDatabaseList) {
        // Trigger database fetch by dispatching a custom event
        window.dispatchEvent(new CustomEvent('mongo-test-success'));
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
    <div className="main-panel">
      <div className="main-panel">
        <h3>MongoDB Connection</h3>
        
        <div className="test-config-section">
          <div className="test-section-title">Current Config(Computed)</div>
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
              <div className="result-message">{result.message}</div>
            </div>
          )}
        </div>
        
        {showDatabaseList ? (
          <>
            <ListDatabases 
              onTestConnection={handleTest}
              hasSuccessfulTest={result?.success || false}
              isTestingConnection={testing}
            />
            
            {selectedDatabase && (
              <CollListAll
                hasSuccessfulTest={result?.success || false}
              />
            )}
            
            {selectedCollection && (
              <div style={{ marginTop: '8px' }}>
                <TabsOnTop defaultTab="Search Docs" autoSwitchToNewTab={false}>
                  <TabsOnTop.Tab label="Search Docs">
                    <MongoDocSearch
                      dbName={selectedDatabase}
                      collName={selectedCollection}
                    />
                  </TabsOnTop.Tab>
                  
                  <TabsOnTop.Tab label="All Docs">
                    <DocListAllTabWrapper
                hasSuccessfulTest={result?.success || false}
              />
                  </TabsOnTop.Tab>
                </TabsOnTop>
              </div>
            )}
          </>
        ) : (
          <MongoIndexPanel />
        )}
      </div>
    </div>
  );
};

export default ConnectionTest;

