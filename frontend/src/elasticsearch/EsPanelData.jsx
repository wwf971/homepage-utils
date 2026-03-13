import React from 'react';
import { useAtomValue } from 'jotai';
import { TabsOnTop } from '@wwf971/react-comp-misc';
import { EsDocListAll } from '@wwf971/homepage-utils-utils';
import { esSelectedIndexAtom } from '../remote/dataStore';
import { getBackendServerUrl } from '../remote/dataStore';
import EsIndexListAll from './EsIndexListAll';
import EsIndexCard from './EsIndexCard';
import EsDocSearch from './EsDocSearch';

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
              <EsIndexCard />
            </TabsOnTop.Tab>
            
            <TabsOnTop.Tab label="Search">
              <EsDocSearch indexName={selectedIndexName} />
            </TabsOnTop.Tab>
            
            <TabsOnTop.Tab label="All Docs">
              <EsDocListAll
                indexName={selectedIndexName}
                backendUrl={getBackendServerUrl()}
              />
            </TabsOnTop.Tab>
          </TabsOnTop>
        </div>
      )}
    </div>
  );
};

export default EsPanelData;
