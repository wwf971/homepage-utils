import React from 'react';
import { Provider } from 'jotai';
import { 
  MasterDetail, 
  MasterDetailTab as Tab,
  MasterDetailSubTab as SubTab,
  MasterDetailPanel as Panel
} from '@wwf971/react-comp-misc';
import JdbcConfigPanel from './jdbc/JdbcConfigPanel';
import JdbcConnectionTest from './jdbc/JdbcConnectionTest';
import MongoConfigPanel from './mongo/MongoConfigPanel';
import MongoTestConnection from './mongo/TestConnection';
import {ConfigPanel as EsConfigPanel} from './elasticsearch/ConfigPanel';
import {TestConnection as EsTestConnection} from './elasticsearch/TestConnection';
import BackendServerConfig from './remote/BackendServerConfig';
import FilePanel from './file/FilePanel';
import './App.css';

function App() {
  return (
    <Provider>
      <div className="app">
        <MasterDetail title="Database Management" sidebarWidth="220px">
          <Tab label="Backend Server">
            <SubTab label="Backend Server" isDefault={true}>
              <Panel>
                <BackendServerConfig />
              </Panel>
            </SubTab>
          </Tab>
          
          <Tab label="Database">
            <SubTab label="JDBC">
              <SubTab label="Configuration" isDefault={true}>
                <Panel>
                  <JdbcConfigPanel />
                </Panel>
              </SubTab>
              
              <SubTab label="Test Connection">
                <Panel>
                  <JdbcConnectionTest />
                </Panel>
              </SubTab>
            </SubTab>
            
            <SubTab label="MongoDB">
              <SubTab label="Configuration">
                <Panel>
                  <MongoConfigPanel />
                </Panel>
              </SubTab>
              
              <SubTab label="Test Connection">
                <Panel>
                  <MongoTestConnection showDatabaseList={true} />
                </Panel>
              </SubTab>
              
              <SubTab label="ES Index">
                <Panel>
                  <MongoTestConnection showDatabaseList={false} />
                </Panel>
              </SubTab>
            </SubTab>
          </Tab>
          
          <Tab label="Index">
            <SubTab label="ElasticSearch">
              <SubTab label="Configuration" isDefault={true}>
                <Panel>
                  <EsConfigPanel />
                </Panel>
              </SubTab>
              
              <SubTab label="Test Connection">
                <Panel>
                  <EsTestConnection showIndexList={true} />
                </Panel>
              </SubTab>
            </SubTab>
          </Tab>
          
          <Tab label="File">
            <SubTab label="Access Points">
              <Panel>
                <FilePanel />
              </Panel>
            </SubTab>
          </Tab>
        </MasterDetail>
      </div>
    </Provider>
  );
}

export default App;

