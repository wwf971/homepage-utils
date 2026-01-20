import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getBackendServerUrl } from '../../remote/dataStore';
import '../rabbitmq.css';

const StompConnectionStatus = ({ onMessageReceived, subscribedTopics = [] }) => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  const [topics, setTopics] = useState([]);
  const clientRef = useRef(null);
  const subscriptionsRef = useRef({});

  const connect = useCallback(() => {
    if (clientRef.current && clientRef.current.connected) {
      console.log('Already connected');
      return;
    }

    setConnectionStatus('connecting');
    setError(null);

    const backendUrl = getBackendServerUrl();
    const wsUrl = `${backendUrl}/ws`;

    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      debug: (str) => {
        console.log('[STOMP]', str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.log('[STOMP]connected');
        setConnectionStatus('connected');
        setError(null);
        
        // Subscribe to topics
        subscribedTopics.forEach(topic => {
          subscribeToTopic(topic);
        });
      },
      onStompError: (frame) => {
        console.error('[STOMP] error:', frame);
        setConnectionStatus('error');
        setError(frame.headers?.message || 'STOMP error');
      },
      onWebSocketClose: () => {
        console.log('WebSocket closed');
        setConnectionStatus('disconnected');
      },
      onWebSocketError: (event) => {
        console.error('WebSocket error:', event);
        setConnectionStatus('error');
        setError('WebSocket connection failed');
      }
    });

    clientRef.current = client;
    client.activate();
  }, [subscribedTopics]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      // Unsubscribe from all topics
      Object.values(subscriptionsRef.current).forEach(subscription => {
        subscription.unsubscribe();
      });
      subscriptionsRef.current = {};
      setTopics([]);

      clientRef.current.deactivate();
      clientRef.current = null;
      setConnectionStatus('disconnected');
      setError(null);
    }
  }, []);

  const subscribeToTopic = useCallback((topic) => {
    if (!clientRef.current || !clientRef.current.connected) {
      console.warn('Cannot subscribe: not connected');
      return;
    }

    const fullTopic = `/topic/${topic}`;
    
    if (subscriptionsRef.current[topic]) {
      console.log('Already subscribed to:', topic);
      return;
    }

    const subscription = clientRef.current.subscribe(fullTopic, (message) => {
      console.log('Received message on topic:', topic, message.body);
      try {
        const data = JSON.parse(message.body);
        if (onMessageReceived) {
          onMessageReceived(topic, data);
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    });

    subscriptionsRef.current[topic] = subscription;
    setTopics(prev => [...prev, topic]);
    console.log('Subscribed to topic:', topic);
  }, [onMessageReceived]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, []);

  // Update subscriptions when subscribedTopics changes
  useEffect(() => {
    if (connectionStatus === 'connected') {
      // Subscribe to new topics
      subscribedTopics.forEach(topic => {
        if (!subscriptionsRef.current[topic]) {
          subscribeToTopic(topic);
        }
      });
    }
  }, [subscribedTopics, connectionStatus, subscribeToTopic]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#4caf50';
      case 'connecting': return '#ff9800';
      case 'disconnected': return '#9e9e9e';
      case 'error': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  return (
    <div className="stomp-connection-container">
      <div className="stomp-connection-header">
        <div className="stomp-connection-status">
          <div 
            className="stomp-status-indicator"
            style={{ background: getStatusColor() }}
          />
          <span className="stomp-status-text">
            STOMP Connection: {connectionStatus}
          </span>
        </div>
        <div className="stomp-connection-buttons">
          <button
            onClick={connect}
            disabled={connectionStatus === 'connected' || connectionStatus === 'connecting'}
            className="stomp-connection-button"
          >
            Connect
          </button>
          <button
            onClick={disconnect}
            disabled={connectionStatus === 'disconnected'}
            className="stomp-connection-button"
          >
            Disconnect
          </button>
        </div>
      </div>

      {error && (
        <div className="stomp-error-box">
          Error: {error}
        </div>
      )}

      {topics.length > 0 && (
        <div className="stomp-topics-container">
          <div className="stomp-topics-title">Subscribed Topics:</div>
          <ul className="stomp-topics-list">
            {topics.map(topic => (
              <li key={topic} className="stomp-topic-item">{topic}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default StompConnectionStatus;
