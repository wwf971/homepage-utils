import React from 'react';
import BackendServerConfig from './BackendServerConfig';
import BackendServerTestConnection from './BackendServerTestConnection';
import './backendServer.css';

const BackendServerPanel = () => {
  return (
    <div className="main-panel">
      <BackendServerConfig />
      <BackendServerTestConnection />
    </div>
  );
};

export default BackendServerPanel;
