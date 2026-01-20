import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { KeyValuesComp, EditableValueComp, InfoIconWithTooltip } from '@wwf971/react-comp-misc';
import { 
  backendServerUrlAtom,
  getBackendServerUrl,
  updateBackendServerUrl,
  createConfigReloader,
  backendLocalConfigAtom,
  fetchBackendLocalConfig,
  updateBackendLocalConfig,
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
import { clearFileCache, fileCacheAtom } from '../file/fileStore';
import '../styles/configPanel.css';
import './backendServer.css';

const BackendServerConfig = () => {
  const [backendUrl, setBackendUrl] = useAtom(backendServerUrlAtom);
  const [localConfig, setLocalConfig] = useAtom(backendLocalConfigAtom);
  const [loading, setLoading] = useState(false);
  const setFileCache = useSetAtom(fileCacheAtom);

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

  const loadConfigs = useCallback(async () => {
    setLoading(true);

    // Load backend URL
    const currentUrl = getBackendServerUrl();
    setBackendUrl(currentUrl);

    // Load backend local config
    const result = await fetchBackendLocalConfig();
    if (result.code === 0) {
      setLocalConfig({
        serverName: result.data.serverName || '',
        serverId: result.data.serverId || ''
      });
    }

    setLoading(false);
  }, [setBackendUrl, setLocalConfig]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const handleUpdateUrl = useCallback(async (key, newValue) => {
    updateBackendServerUrl(newValue);
    setBackendUrl(newValue);
    
    clearFileCache(setFileCache);

    // Reload backend local config (serverName, serverId) from new server
    const backendConfigResult = await fetchBackendLocalConfig();
    if (backendConfigResult.code === 0) {
      setLocalConfig({
        serverName: backendConfigResult.data.serverName || '',
        serverId: backendConfigResult.data.serverId || ''
      });
    }

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
    
    return { code: 0, message: 'Backend URL updated' };
  }, [setBackendUrl, setFileCache, setLocalConfig, setMongoAppConfig, setMongoLocalConfig, setMongoComputedConfig, setJdbcAppConfig, setJdbcLocalConfig, setJdbcComputedConfig, setEsAppConfig, setEsLocalConfig, setEsComputedConfig, setRedisAppConfig, setRedisLocalConfig, setRedisComputedConfig, setRabbitMQAppConfig, setRabbitMQLocalConfig, setRabbitMQComputedConfig]);

  const handleUpdateLocalConfig = useCallback(async (key, newValue) => {
    // Validate serverId format
    if (key === 'serverId' && newValue && !/^[a-z0-9]*$/.test(newValue)) {
      return { 
        code: -1, 
        message: 'Server ID can only contain lowercase letters (a-z) and numbers (0-9)' 
      };
    }

    const result = await updateBackendLocalConfig(key, newValue);
    if (result.code === 0) {
      setLocalConfig(prev => ({
        ...prev,
        [key]: newValue
      }));
    }
    return result;
  }, [setLocalConfig]);

  const configData = useMemo(() => {
    return [
      {
        key: 'Backend URL',
        value: backendUrl || 'http://localhost:900',
        valueComp: (props) => (
          <EditableValueComp 
            {...props} 
            category="backend"
            configKey="url"
            onUpdate={handleUpdateUrl}
          />
        )
      },
      {
        key: 'Server Name',
        value: localConfig.serverName || '(not set)',
        valueComp: (props) => (
          <EditableValueComp 
            {...props} 
            category="backend"
            isNotSet={!localConfig.serverName}
            configKey="serverName"
            onUpdate={handleUpdateLocalConfig}
          />
        )
      },
      {
        key: (
          <span className="key-with-info">
            Server ID
            <InfoIconWithTooltip 
              tooltipText="Only lowercase letters (a-z) and numbers (0-9) are allowed"
              width={14}
              height={14}
            />
          </span>
        ),
        value: localConfig.serverId || '(not set)',
        valueComp: (props) => (
          <EditableValueComp 
            {...props} 
            category="backend"
            isNotSet={!localConfig.serverId}
            configKey="serverId"
            onUpdate={handleUpdateLocalConfig}
          />
        )
      }
    ];
  }, [backendUrl, localConfig, handleUpdateUrl, handleUpdateLocalConfig]);

  return (
    <>
      <div className="section-title">Backend Server Configuration</div>
      <div className="config-section">
        <KeyValuesComp 
          data={configData} 
          isEditable={false}
          alignColumn={true}
          keyColWidth="min"
        />
        
        <div className="config-note">
          <p>Backend URL priority: localStorage &gt; config.0.js &gt; config.js &gt; default</p>
        </div>
      </div>
    </>
  );
};

export default BackendServerConfig;
