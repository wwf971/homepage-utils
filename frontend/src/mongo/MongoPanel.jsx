import React, { useState, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { TabsOnTop } from '@wwf971/react-comp-misc';
import { mongoSelectedDatabaseAtom, mongoSelectedCollectionAtom } from '../remote/dataStore';
import MongoTestConnection from './MongoTestConnection';
import ListDatabases from './ListDatabases';
import CollListAll from './CollListAll';
import MongoDocSearch from './MongoDocSearch';
import DocListAll from './DocListAll';

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

/**
 * Main MongoDB Panel component that includes test connection and database operations
 */
const MongoPanel = () => {
  const selectedDatabase = useAtomValue(mongoSelectedDatabaseAtom);
  const selectedCollection = useAtomValue(mongoSelectedCollectionAtom);
  const [testResult, setTestResult] = useState(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const handleTestResult = (result) => {
    setTestResult(result);
  };

  const handleTestConnection = async () => {
    // This will be called from child components
  };

  return (
    <div className="main-panel">
      <MongoTestConnection 
        onTestSuccess={() => {}}
        onTestResult={handleTestResult}
        isTestingConnection={isTestingConnection}
      />
      
      <ListDatabases 
        onTestConnection={handleTestConnection}
        hasSuccessfulTest={testResult?.success || false}
        isTestingConnection={isTestingConnection}
      />
      
      {selectedDatabase && (
        <CollListAll
          hasSuccessfulTest={testResult?.success || false}
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
                hasSuccessfulTest={testResult?.success || false}
              />
            </TabsOnTop.Tab>
          </TabsOnTop>
        </div>
      )}
    </div>
  );
};

export default MongoPanel;
