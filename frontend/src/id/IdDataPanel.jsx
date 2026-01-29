import React from 'react';
import Subpanel from '../components/Subpanel';
import IdIssue from './IdIssue';
import IdSearch from './IdSearch';

const IdDataPanel = () => {
  return (
    <div style={{ padding: '0px 12px' }}>
      <Subpanel title="Issue New ID" defaultExpanded={true}>
        <IdIssue />
      </Subpanel>

      <Subpanel title="Search IDs" defaultExpanded={false}>
        <IdSearch />
      </Subpanel>
    </div>
  );
};

export default IdDataPanel;
