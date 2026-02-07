import React from 'react';
import BackendServerConfig from './BackendServerConfig';
import BackendServerTestConnection from './BackendServerTestConnection';
import {PanelToggle} from '@wwf971/react-comp-misc';
import './backendServer.css';

const BackendServerPanel = () => {
  return (
    <div className="main-panel">
      <PanelToggle title="Config" defaultExpanded={true}>
        <BackendServerConfig />
      </PanelToggle>
      <PanelToggle title="Test Connection" defaultExpanded={true} style={{ marginTop: '12px' }}>
        <BackendServerTestConnection />
      </PanelToggle>
    </div>
  );
};

export default BackendServerPanel;
