import React from 'react';
import IdConfig from './IdConfig';
import IdTableCheck from './IdTableCheck';
import IdTableStructureCheck from './IdTableStructureCheck';
import IdTableCreate from './IdTableCreate';
import IdTableDeleteRecreate from './IdTableDeleteRecreate';
import Subpanel from '../components/Subpanel';
import '../styles/common.css';

const IdConfigPanel = () => {
  return (
    <div className="main-panel">
      <Subpanel title="ID Service Configuration" defaultExpanded={true}>
        <IdConfig />
      </Subpanel>
      <IdTableCheck />
      <IdTableStructureCheck />
      <IdTableCreate />
      <IdTableDeleteRecreate />
    </div>
  );
};

export default IdConfigPanel;
