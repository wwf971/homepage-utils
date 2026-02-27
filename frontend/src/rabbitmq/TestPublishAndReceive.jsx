import React, { useState, useCallback } from 'react';
import { PanelPopup } from '@wwf971/react-comp-misc';
import StompConnectionStatus from './test-connection/StompConnectionStatus';
import PublishLog from './test-connection/PublishLog';
import ReceiveLog from './test-connection/ReceiveLog';
import { getBackendServerUrl } from '../remote/dataStore';
import './rabbitmq.css';

const TestPublishAndReceive = () => {
  const [publishedTasks, setPublishedTasks] = useState([]);
  const [receivedMessages, setReceivedMessages] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [errorDialog, setErrorDialog] = useState(null);

  const handleMessageReceived = useCallback((topic, message) => {
    console.log('Message received on topic:', topic, message);
    if (topic === 'rabbitmq/task-message/receive') {
      setReceivedMessages(prev => [...prev, message]);
    }
  }, []);

  const publishTestTask = async () => {
    setPublishing(true);
    try {
      const backendUrl = getBackendServerUrl();
      const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const requestBody = {
        type: 'example-task',
        id: taskId,
        data: {
          message: 'Example task from frontend',
          timestamp: Date.now()
        }
      };

      const response = await fetch(`${backendUrl}/rabbitmq/task/publish/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      
      if (result.code === 0) {
        setPublishedTasks(prev => [...prev, result.data]);
        console.log('Task published successfully:', result.data);
      } else {
        console.error('Failed to publish task:', result.message);
        setErrorDialog({
          message: 'Failed to publish task: ' + result.message
        });
      }
    } catch (error) {
      console.error('Error publishing task:', error);
      setErrorDialog({
        message: 'Error publishing task: ' + error.message
      });
    } finally {
      setPublishing(false);
    }
  };

  const clearLogs = () => {
    setPublishedTasks([]);
    setReceivedMessages([]);
  };

  return (
    <div className="rabbitmq-test-container">
      <div className="section-title">RabbitMQ Test: Publish and Receive</div>
      
      <StompConnectionStatus
        onMessageReceived={handleMessageReceived}
        subscribedTopics={['rabbitmq/task-message/receive']}
      />

      <div className="rabbitmq-controls">
        <button
          onClick={publishTestTask}
          disabled={publishing}
          className="rabbitmq-publish-button"
        >
          {publishing ? 'Publishing...' : 'Publish Test Task'}
        </button>
        
        <button
          onClick={clearLogs}
          className="rabbitmq-clear-button"
        >
          Clear Logs
        </button>

        <div className="rabbitmq-stats">
          <div>
            Published: <span className="rabbitmq-stat-value rabbitmq-stat-published">{publishedTasks.length}</span>
          </div>
          <div>
            Received: <span className="rabbitmq-stat-value rabbitmq-stat-received">{receivedMessages.length}</span>
          </div>
          <div>
            Match: <span className={`rabbitmq-stat-match ${publishedTasks.length === receivedMessages.length ? 'rabbitmq-stat-match-success' : 'rabbitmq-stat-match-fail'}`}>
              {publishedTasks.length === receivedMessages.length ? '✓' : '✗'}
            </span>
          </div>
        </div>
      </div>

      <div className="rabbitmq-logs-layout">
        <PublishLog tasks={publishedTasks} />
        <ReceiveLog messages={receivedMessages} />
      </div>

      <div className="rabbitmq-info-box">
        <div className="rabbitmq-info-title">How it works:</div>
        <ol className="rabbitmq-info-list">
          <li>Click "Publish Test Task" to send a task to RabbitMQ queue</li>
          <li>Backend RabbitMQTaskExecuteService consumes the task from the queue</li>
          <li>Backend publishes a notification via STOMP to topic "rabbitmq/task-message/receive"</li>
          <li>Frontend receives the notification through WebSocket connection</li>
          <li>If working correctly, Published count should equal Received count</li>
        </ol>
      </div>

      {errorDialog && (
        <PanelPopup
          type="alert"
          title="Error"
          message={errorDialog.message}
          confirmText="OK"
          onConfirm={() => setErrorDialog(null)}
        />
      )}
    </div>
  );
};

export default TestPublishAndReceive;
