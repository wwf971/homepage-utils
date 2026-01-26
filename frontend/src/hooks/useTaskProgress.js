import { useState, useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getBackendServerUrl } from '../remote/dataStore';

/**
 * Hook for subscribing to task progress updates via STOMP
 * @param {string} taskId - The task ID to subscribe to
 * @returns {object} - { progress, isComplete, error }
 */
export const useTaskProgress = (taskId) => {
  const [progress, setProgress] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState(null);
  const clientRef = useRef(null);
  const subscriptionRef = useRef(null);

  useEffect(() => {
    if (!taskId) {
      console.log('[useTaskProgress] No taskId provided, skipping subscription');
      // Reset state when no task
      setProgress(null);
      setIsComplete(false);
      setError(null);
      return;
    }

    // Reset state for new task
    console.log('[useTaskProgress] Starting subscription for taskId:', taskId);
    setProgress(null);
    setIsComplete(false);
    setError(null);
    
    const backendUrl = getBackendServerUrl();
    const wsUrl = `${backendUrl}/ws`;
    console.log('[useTaskProgress] WebSocket URL:', wsUrl);

    // Create STOMP client
    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      debug: (str) => {
        console.log('[STOMP Debug]', str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    client.onConnect = () => {
      console.log('[useTaskProgress] Connected to STOMP for task:', taskId);
      const topicPath = `/topic/task/${taskId}`;
      console.log('[useTaskProgress] Subscribing to:', topicPath);

      // Subscribe to task updates
      subscriptionRef.current = client.subscribe(topicPath, (message) => {
        try {
          const update = JSON.parse(message.body);
          // console.log('[useTaskProgress] Task update received:', update);

          setProgress(update);

          // Check if task is complete
          if (update.status === 'completed' || update.status === 'failed') {
            console.log('[useTaskProgress] Task completed with status:', update.status);
            setIsComplete(true);
            if (update.status === 'failed') {
              setError(update.errors && update.errors.length > 0 
                ? update.errors.join('; ') 
                : 'Task failed');
            }
          }
        } catch (err) {
          console.error('[useTaskProgress] Failed to parse task update:', err);
        }
      });
      console.log('[useTaskProgress] Subscription created');
    };

    client.onStompError = (frame) => {
      console.error('[useTaskProgress] STOMP error:', frame);
      setError('Connection error');
    };

    console.log('[useTaskProgress] Activating STOMP client');
    client.activate();
    clientRef.current = client;

    // Cleanup on unmount or taskId change
    return () => {
      console.log('[useTaskProgress] Cleaning up subscription for taskId:', taskId);
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (clientRef.current) {
        clientRef.current.deactivate();
      }
    };
  }, [taskId]);

  return { progress, isComplete, error };
};
