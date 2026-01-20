import React from 'react';
import { TabsOnTop } from '@wwf971/react-comp-misc';
import RabbitMQConfigPanel from './RabbitMQConfigPanel';
import TestConnectionRabbitMQ from './TestConnectionRabbitMQ';
import TestPublishAndReceive from './TestPublishAndReceive';

const RabbitMQPanel = () => {
  return (
    <TabsOnTop defaultTab="Config">
      <TabsOnTop.Tab label="Config">
        <RabbitMQConfigPanel />
      </TabsOnTop.Tab>
      
      <TabsOnTop.Tab label="Test Connection">
        <TestConnectionRabbitMQ />
      </TabsOnTop.Tab>
      
      <TabsOnTop.Tab label="Test Publish & Receive">
        <TestPublishAndReceive />
      </TabsOnTop.Tab>
    </TabsOnTop>
  );
};

export default RabbitMQPanel;
