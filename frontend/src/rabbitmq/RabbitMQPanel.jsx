import React from 'react';
import { PanelToggle } from '@wwf971/react-comp-misc';
import RabbitMQConfig from './RabbitMQConfig';
import TestConnectionRabbitMQ from './TestConnectionRabbitMQ';
import TestPublishAndReceive from './TestPublishAndReceive';

const RabbitMQPanel = () => {
  return (
    <div style={{ padding: '0px 12px' }}>
      <PanelToggle title="Config" defaultExpanded={false}>
        <RabbitMQConfig />
      </PanelToggle>
      
      <PanelToggle title="Test Connection" defaultExpanded={false}>
        <TestConnectionRabbitMQ />
      </PanelToggle>
      
      <PanelToggle title="Test Publish & Receive" defaultExpanded={true}>
        <TestPublishAndReceive />
      </PanelToggle>
    </div>
  );
};

export default RabbitMQPanel;
