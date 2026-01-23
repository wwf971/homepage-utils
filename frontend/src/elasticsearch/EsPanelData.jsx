import React from 'react';
import { useAtomValue } from 'jotai';
import { TabsOnTop } from '@wwf971/react-comp-misc';
import { esSelectedIndexAtom } from '../remote/dataStore';
import EsIndexListAll from './EsIndexListAll';
import IndexInfo from './IndexInfo';
import EsDocSearch from './EsDocSearch';
import EsDocListAll from './EsDocListAll';

/**
 * Main ElasticSearch Data Panel component for index operations
 */
export const EsPanelData = () => {
  const selectedIndexName = useAtomValue(esSelectedIndexAtom);

  return (
    <div className="main-panel">
      <EsIndexListAll />
      
      {selectedIndexName && (
        <div style={{ marginTop: '8px' }}>
          <TabsOnTop defaultTab="Info" autoSwitchToNewTab={false}>
            <TabsOnTop.Tab label="Info">
              <IndexInfo />
            </TabsOnTop.Tab>
            
            <TabsOnTop.Tab label="Search">
              <EsDocSearch />
            </TabsOnTop.Tab>
            
            <TabsOnTop.Tab label="All Docs">
              <EsDocListAll />
            </TabsOnTop.Tab>
          </TabsOnTop>
        </div>
      )}
    </div>
  );
};

export default EsPanelData;
