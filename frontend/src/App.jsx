import React, { useEffect } from 'react';
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
import MongoPanel from './mongo/MongoPanel';
import MongoIndexPanel from './mongo-index/MongoIndexPanel';
import EsPanelConfig from './elasticsearch/EsPanelConfig';
import EsPanelData from './elasticsearch/EsPanelData';
import {RedisConfigPanel} from './redis/RedisConfigPanel';
import {TestConnectionRedis} from './redis/TestConnectionRedis';
import {TestConnectionRedisson} from './redis/TestConnectionRedisson';
import RabbitMQPanel from './rabbitmq/RabbitMQPanel';
import IdConfigPanel from './id/IdConfigPanel';
import IdDataPanel from './id/IdDataPanel';
import BackendServerPanel from './remote/BackendServerPanel';
import FilePanel from './file/FilePanel';
import PanelMongoApp from './mongo-app/PanelMongApp';
import PanelGroovyApi from './groovy-api/PanelGroovyApi';
import './App.css';

function App() {
  useEffect(() => {
    if (window.location.pathname.startsWith('/file_access_point/')) {
      window.history.replaceState(null, '', '/');
    }
  }, []);

  return (
    <Provider>
      <div className="app">
        <MasterDetail title="Backend Management" sidebarWidth="220px">
          <Tab label="Backend Server">
            <SubTab label="Configuration" isDefault={true}>
              <Panel>
                <BackendServerPanel />
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
              
              <SubTab label="Data">
                <Panel>
                  <MongoPanel />
                </Panel>
              </SubTab>
              
              <SubTab label="Index">
                <Panel>
                  <MongoIndexPanel />
                </Panel>
              </SubTab>
            </SubTab>
          </Tab>
          
          <Tab label="Index">
            <SubTab label="ElasticSearch">
              <SubTab label="Config" isDefault={true}>
                <Panel>
                  <EsPanelConfig />
                </Panel>
              </SubTab>
              
              <SubTab label="Data">
                <Panel>
                  <EsPanelData />
                </Panel>
              </SubTab>
            </SubTab>
          </Tab>
          
          <Tab label="Cache">
            <SubTab label="Redis">
              <SubTab label="Config" isDefault={true}>
                <Panel>
                  <RedisConfigPanel />
                </Panel>
              </SubTab>
              
              <SubTab label="Test Connection (Redis)">
                <Panel>
                  <TestConnectionRedis />
                </Panel>
              </SubTab>
              
              <SubTab label="Test Connection (Redisson)">
                <Panel>
                  <TestConnectionRedisson />
                </Panel>
              </SubTab>
            </SubTab>
          </Tab>
          
          <Tab label="MessageQueue">
            <SubTab label="RabbitMQ" isDefault={true}>
              <SubTab label="Config/Test">
                <Panel>
                  <RabbitMQPanel />
                </Panel>
              </SubTab>

            </SubTab>
          </Tab>
          
          <Tab label="ID Service">
            <SubTab label="Configuration" isDefault={true}>
              <Panel>
                <IdConfigPanel />
              </Panel>
            </SubTab>
            
            <SubTab label="Data">
              <Panel>
                <IdDataPanel />
              </Panel>
            </SubTab>
          </Tab>
          
          <Tab label="Mongo App">
            <SubTab label="Apps">
              <Panel>
                <PanelMongoApp />
              </Panel>
            </SubTab>
          </Tab>

          <Tab label="File">
            <SubTab label="Access Points">
              <Panel>
                <FilePanel />
              </Panel>
            </SubTab>
          </Tab>

          <Tab label="Groovy API">
            <SubTab label="Scripts">
              <Panel>
                <PanelGroovyApi />
              </Panel>
            </SubTab>
          </Tab>
        </MasterDetail>
      </div>
    </Provider>
  );
}

export default App;

