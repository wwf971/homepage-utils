import React, { useState } from 'react';
import { PanelToggle } from '@wwf971/react-comp-misc';
import GroovyApiUpload from './GroovyApiUpload';
import GroovyApiListAll from './GroovyApiListAll';
import GroovyApiTest from './GroovyApiTest';

const PanelGroovyApi = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadSuccess = () => {
    // Trigger refresh in the list component
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div style={{ padding: '0px 12px' }}>
      <PanelToggle title="Upload Groovy Script" defaultExpanded={true}>
        <GroovyApiUpload onUploadSuccess={handleUploadSuccess} />
      </PanelToggle>

      <PanelToggle title="All Existing Groovy Apis" defaultExpanded={true}>
        <GroovyApiListAll refreshTrigger={refreshTrigger} />
      </PanelToggle>

      <PanelToggle title="Test Endpoint" defaultExpanded={true}>
        <GroovyApiTest refreshTrigger={refreshTrigger} />
      </PanelToggle>
    </div>
  );
};

export default PanelGroovyApi;
