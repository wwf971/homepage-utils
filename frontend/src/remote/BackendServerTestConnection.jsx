import React, { useState, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { SpinningCircle } from '@wwf971/react-comp-misc';
import {
  backendServerUrlAtom,
  backendConnectionFailedAtom,
  backendLocalConfigAtom,
  testBackendConnection,
  fetchBackendLocalConfig
} from './backendServerStore';
import { 
  createConfigReloader,
  mongoAppConfigAtom,
  mongoLocalConfigAtom,
  mongoComputedConfigAtom,
  jdbcAppConfigAtom,
  jdbcLocalConfigAtom,
  jdbcComputedConfigAtom,
  esAppConfigAtom,
  esLocalConfigAtom,
  esComputedConfigAtom,
  redisAppConfigAtom,
  redisLocalConfigAtom,
  redisComputedConfigAtom,
  rabbitMQAppConfigAtom,
  rabbitMQLocalConfigAtom,
  rabbitMQComputedConfigAtom
} from './dataStore';
import '../styles/common.css';
import './backendServer.css';

const BackendServerTestConnection = () => {
  const backendUrl = useAtomValue(backendServerUrlAtom);
  const [isPrevConnectFailed, setConnectionFailed] = useAtom(backendConnectionFailedAtom);
  const setLocalConfig = useSetAtom(backendLocalConfigAtom);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [refetchingConfigs, setRefetchingConfigs] = useState(false);
  const abortControllerRef = useRef(null);

  // Config setters for reloading
  const setMongoAppConfig = useSetAtom(mongoAppConfigAtom);
  const setMongoLocalConfig = useSetAtom(mongoLocalConfigAtom);
  const setMongoComputedConfig = useSetAtom(mongoComputedConfigAtom);
  const setJdbcAppConfig = useSetAtom(jdbcAppConfigAtom);
  const setJdbcLocalConfig = useSetAtom(jdbcLocalConfigAtom);
  const setJdbcComputedConfig = useSetAtom(jdbcComputedConfigAtom);
  const setEsAppConfig = useSetAtom(esAppConfigAtom);
  const setEsLocalConfig = useSetAtom(esLocalConfigAtom);
  const setEsComputedConfig = useSetAtom(esComputedConfigAtom);
  const setRedisAppConfig = useSetAtom(redisAppConfigAtom);
  const setRedisLocalConfig = useSetAtom(redisLocalConfigAtom);
  const setRedisComputedConfig = useSetAtom(redisComputedConfigAtom);
  const setRabbitMQAppConfig = useSetAtom(rabbitMQAppConfigAtom);
  const setRabbitMQLocalConfig = useSetAtom(rabbitMQLocalConfigAtom);
  const setRabbitMQComputedConfig = useSetAtom(rabbitMQComputedConfigAtom);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    abortControllerRef.current = new AbortController();
    
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }, 130000);
    
    try {
      const response = await fetch(`${backendUrl}/actuator/health`, {
        method: 'GET',
        signal: abortControllerRef.current.signal
      });
      const result = await response.json();
      
      clearTimeout(timeoutId);
      
      const testResult = {
        success: result.status === 'UP',
        message: result.status === 'UP' ? 'Connection successful' : 'Server is not healthy'
      };
      
      setTestResult(testResult);

      // If test succeeded and previous connection had failed, re-fetch all configs
      if (testResult.success && isPrevConnectFailed) {
        console.log('[BackendServerTestConnection] Connection restored, re-fetching configs...');
        setRefetchingConfigs(true);
        
        try {
          // Re-fetch backend local config
          const backendConfigResult = await fetchBackendLocalConfig();
          if (backendConfigResult.code === 0) {
            setLocalConfig({
              serverName: backendConfigResult.data.serverName || '',
              serverId: backendConfigResult.data.serverId || ''
            });
            setConnectionFailed(false);
          }

          // Re-fetch all other configs
          const reloader = createConfigReloader();
          await reloader({
            setMongoAppConfig,
            setMongoLocalConfig,
            setMongoComputedConfig,
            setJdbcAppConfig,
            setJdbcLocalConfig,
            setJdbcComputedConfig,
            setEsAppConfig,
            setEsLocalConfig,
            setEsComputedConfig,
            setRedisAppConfig,
            setRedisLocalConfig,
            setRedisComputedConfig,
            setRabbitMQAppConfig,
            setRabbitMQLocalConfig,
            setRabbitMQComputedConfig
          });
          
          console.log('[BackendServerTestConnection] All configs re-fetched successfully');
        } catch (error) {
          console.error('[BackendServerTestConnection] Error re-fetching configs:', error);
        } finally {
          setRefetchingConfigs(false);
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      let testResult;
      if (error.name === 'AbortError') {
        testResult = {
          success: false,
          message: 'Connection test aborted'
        };
      } else {
        testResult = {
          success: false,
          message: error.message || 'Connection failed'
        };
      }
      
      setTestResult(testResult);
    } finally {
      setTesting(false);
      abortControllerRef.current = null;
    }
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <>
      <div className="section-title">Test Backend Connection</div>
    

      <div className="test-description">
        Click the button below to test the connection to the backend server.
      </div>

      <div className="test-buttons">
        {testing ? (
          <button 
            onClick={handleAbort}
            className="test-button-container testing"
          >
            <SpinningCircle width={14} height={14} color="white" />
            <span>Testing... (Click to abort)</span>
          </button>
        ) : (
          <button 
            onClick={handleTest}
            className="test-button-container ready"
            style={{ marginBottom: '4px' }}
          >
            Test Connection
          </button>
        )}
      </div>
      
      {testResult && (
        <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
          <strong>{testResult.success ? '✓ Success' : '✗ Failed'}</strong>
          <div className="result-message">{testResult.message}</div>
          {refetchingConfigs && (
            <div className="test-progress" style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
              <SpinningCircle width={12} height={12} color="#666" />
              <span>Re-fetching all configs...</span>
            </div>
          )}
        </div>
      )}

    </>
  );
};

export default BackendServerTestConnection;
