import React, { useState, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { TabsOnTop, PanelToggle } from '@wwf971/react-comp-misc';
import { mongoSelectedDatabaseAtom, mongoSelectedCollectionAtom } from '../remote/dataStore';
import MongoTestConnection from './MongoTestConnection';
import DbListAll from './DbListAll';
import CollListAll from './CollListAll';
import MongoDocSearch from './MongoDocSearch';
import DocListAll from './DocListAll';

/**
 * Wrapper component for DocListAll that handles tab focus logic
 */
const DocListAllTabWrapper = ({ tabsState, tabKey }) => {
  const [hasBeenFocused, setHasBeenFocused] = useState(false);
  
  const isTabFocused = tabKey && tabsState ? tabsState[tabKey]?.isFocused : false;
  
  useEffect(() => {
    if (isTabFocused && !hasBeenFocused) {
      setHasBeenFocused(true);
    }
  }, [isTabFocused, hasBeenFocused]);
  
  // Only load when tab has been focused (lazy loading)
  const shouldLoad = hasBeenFocused;
  
  return <DocListAll shouldLoad={shouldLoad} />;
};

/**
 * Main MongoDB Panel component that includes test connection and database operations
 */
const MongoPanel = () => {
  const hasSelectedDb = useAtomValue(mongoSelectedDatabaseAtom);
  const hasSelectedColl = useAtomValue(mongoSelectedCollectionAtom);

  return (
    <div style={{ padding: '12px 8px' }}>
      <PanelToggle
        title="Test Connection"
        defaultExpanded={true}
      >
        <MongoTestConnection />
      </PanelToggle>
      
      <PanelToggle
        title="Databases / Collections / Docs"
        defaultExpanded={true}
        style={{ marginTop: '12px' }}
      >
      <DbListAll />
      
        {hasSelectedDb && (
          <CollListAll />
        )}
        
        {hasSelectedColl && (
          <div style={{ marginTop: '8px' }}>
            <TabsOnTop defaultTab="Search Docs" autoSwitchToNewTab={false}>
              <TabsOnTop.Tab label="Search Docs">
                <MongoDocSearch
                  dbName={hasSelectedDb}
                  collName={hasSelectedColl}
                />
              </TabsOnTop.Tab>
              
              <TabsOnTop.Tab label="All Docs">
                <DocListAllTabWrapper />
              </TabsOnTop.Tab>
            </TabsOnTop>
          </div>
        )}
      </PanelToggle>
    </div>
  );
};

export default MongoPanel;
