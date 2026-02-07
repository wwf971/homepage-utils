import React, { useState, useEffect, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { KeyValuesComp, KeyValues, SpinningCircle, RefreshIcon, EditableValueComp } from '@wwf971/react-comp-misc';
import { formatTimestamp, getTimezoneInt } from '@wwf971/homepage-utils-utils/utils';
import {
  mongoRemoteConfigAtom,
  mongoLocalConfigAtom,
  mongoComputedConfigAtom,
  fetchMongoRemoteConfig,
  fetchMongoLocalConfig,
  fetchMongoComputedConfig,
  updateMongoRemoteConfig,
  getBackendServerUrl
} from '../remote/dataStore';

/**
 * Remote Config Panel - displays and manages remote MongoDB configuration
 * Only used for MongoDB (stores MongoDB connection config in MongoDB)
 */
const RemoteConfig = () => {
  const [settings, setSettings] = useState({
    enabled: false,
    useSameAsData: false,
    uri: '',
    database: '',
    collection: '',
    documentName: ''
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [status, setStatus] = useState({
    checking: false,
    connection: null, // 'success', 'error', null
    connectionMessage: '',
    database: null, // true, false, 'N/A', null
    collection: null, // true, false, 'N/A', null
    document: null, // true, false, 'N/A', null
    lastChecked: null
  });
  
  // Get remote config from jotai
  const remoteConfig = useAtomValue(mongoRemoteConfigAtom);
  const setRemoteConfig = useSetAtom(mongoRemoteConfigAtom);
  
  // Watch local config for changes to remote settings
  const localConfig = useAtomValue(mongoLocalConfigAtom);
  
  // Get setters for all config layers
  const setLocalConfig = useSetAtom(mongoLocalConfigAtom);
  const setComputedConfig = useSetAtom(mongoComputedConfigAtom);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update settings from local config when it changes (remote settings are stored there)
  useEffect(() => {
    const remoteSettings = {};
    const prefix = 'mongo.remote.';
    
    localConfig.forEach(item => {
      // Check if the full key (e.g., "mongo.remote.enabled") starts with our prefix
      const fullKey = `mongo.${item.key}`;
      if (fullKey.startsWith(prefix)) {
        const key = fullKey.replace(prefix, '');
        remoteSettings[key] = item.value;
      }
    });
    
    // Always update settings, even if remoteSettings is empty (to reset to defaults)
    setSettings(prev => ({
      ...prev,
      enabled: remoteSettings.enabled === 'true',
      useSameAsData: remoteSettings.useSameAsData === 'true',
      uri: remoteSettings.uri || '',
      database: remoteSettings.database || '',
      collection: remoteSettings.collection || '',
      documentName: remoteSettings.documentName || ''
    }));
  }, [localConfig]);

  const loadSettings = async () => {
    try {
      const backendUrl = getBackendServerUrl();
      const response = await fetch(`${backendUrl}/mongo/remote_config/settings/`);
      const result = await response.json();
      if (result.code === 0 && result.data) {
        setSettings({
          enabled: result.data.enabled === 'true',
          useSameAsData: result.data.useSameAsData === 'true',
          uri: result.data.uri || '',
          database: result.data.database || '',
          collection: result.data.collection || '',
          documentName: result.data.documentName || ''
        });
      }
    } catch (error) {
      console.error('Failed to load remote config settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (refreshing || !settings.enabled) return;
    
    setRefreshing(true);
    try {
      const result = await fetchMongoRemoteConfig();
      if (result.code === 0) {
        setRemoteConfig(result.data);
        setHasFetched(true);
      }
    } catch (error) {
      console.error('Failed to refresh remote config:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const checkStatus = async () => {
    if (!settings.enabled) return;
    
    setStatus(prev => ({ ...prev, checking: true }));
    
    try {
      const backendUrl = getBackendServerUrl();
      const response = await fetch(`${backendUrl}/mongo/remote_config/status/`);
      const result = await response.json();
      
      if (result.code === 0 && result.data) {
        setStatus({
          checking: false,
          connection: result.data.connection ? 'success' : 'error',
          connectionMessage: result.data.connectionMessage || '',
          database: result.data.database,
          collection: result.data.collection,
          document: result.data.document,
          lastChecked: formatTimestamp(new Date(), getTimezoneInt())
        });
      } else {
        setStatus(prev => ({
          ...prev,
          checking: false,
          connection: 'error',
          connectionMessage: result.message || 'Failed to check status'
        }));
      }
    } catch (error) {
      console.error('Failed to check remote config status:', error);
      setStatus(prev => ({
        ...prev,
        checking: false,
        connection: 'error',
        connectionMessage: error.message || 'Network error'
      }));
    }
  };

  const createDatabaseResource = async (resourceType) => {
    try {
      const backendUrl = getBackendServerUrl();
      const response = await fetch(`${backendUrl}/mongo/remote_config/create/${resourceType}/`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.code === 0) {
        // Re-check status after creation
        await checkStatus();
      } else {
        alert(`Failed to create ${resourceType}: ${result.message}`);
      }
    } catch (error) {
      console.error(`Failed to create ${resourceType}:`, error);
      alert(`Failed to create ${resourceType}: ${error.message}`);
    }
  };

  // Update callback for remote settings (saves to local config via remote settings API)
  const handleRemoteSettingUpdate = async (configKey, newValue) => {
    try {
      const backendUrl = getBackendServerUrl();
      const response = await fetch(`${backendUrl}/mongo/remote_config/settings/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: configKey, value: String(newValue) })
      });
      const result = await response.json();
      
      if (result.code === 0) {
        // Reload local config and computed config after successful update
        const [localResult, computedResult] = await Promise.all([
          fetchMongoLocalConfig(),
          fetchMongoComputedConfig()
        ]);
        
        if (localResult.code === 0) setLocalConfig(localResult.data);
        if (computedResult.code === 0) setComputedConfig(computedResult.data);
      }
      
      return result;
    } catch (error) {
      console.error('Failed to update remote setting:', error);
      return { code: -1, message: error.message || 'Network error' };
    }
  };

  // Update callback for remote config values (saves to remote MongoDB)
  const handleRemoteValueUpdate = async (configKey, newValue) => {
    const result = await updateMongoRemoteConfig(configKey, newValue);
    
    if (result.code === 0) {
      // Reload remote and computed config after successful update
      const [remoteResult, computedResult] = await Promise.all([
        fetchMongoRemoteConfig(),
        fetchMongoComputedConfig()
      ]);
      
      if (remoteResult.code === 0) setRemoteConfig(remoteResult.data);
      if (computedResult.code === 0) setComputedConfig(computedResult.data);
    }
    
    return result;
  };

  // Settings configuration data
  const settingsData = useMemo(() => {
    const data = [
      {
        key: 'enabled',
        value: String(settings.enabled),
        valueComp: (props) => (
          <EditableValueComp
            {...props}
            configKey="enabled"
            category="mongo"
            valueType="boolean"
            isNotSet={false}
            onUpdate={handleRemoteSettingUpdate}
          />
        )
      },
      {
        key: 'useSameAsData',
        value: String(settings.useSameAsData),
        valueComp: (props) => (
          <EditableValueComp
            {...props}
            configKey="useSameAsData"
            category="mongo"
            valueType="boolean"
            isNotSet={false}
            onUpdate={handleRemoteSettingUpdate}
          />
        )
      },
      {
        key: 'uri',
        value: settings.uri || 'NOT SET',
        valueComp: (props) => (
          <EditableValueComp
            {...props}
            configKey="uri"
            category="mongo"
            valueType="text"
            isNotSet={!settings.uri}
            onUpdate={handleRemoteSettingUpdate}
          />
        )
      },
      {
        key: 'database',
        value: settings.database || 'NOT SET',
        valueComp: (props) => (
          <EditableValueComp
            {...props}
            configKey="database"
            category="mongo"
            valueType="text"
            isNotSet={!settings.database}
            onUpdate={handleRemoteSettingUpdate}
          />
        )
      },
      {
        key: 'collection',
        value: settings.collection || 'NOT SET',
        valueComp: (props) => (
          <EditableValueComp
            {...props}
            configKey="collection"
            category="mongo"
            valueType="text"
            isNotSet={!settings.collection}
            onUpdate={handleRemoteSettingUpdate}
          />
        )
      },
      {
        key: 'documentName',
        value: settings.documentName || 'NOT SET',
        valueComp: (props) => (
          <EditableValueComp
            {...props}
            configKey="documentName"
            category="mongo"
            valueType="text"
            isNotSet={!settings.documentName}
            onUpdate={handleRemoteSettingUpdate}
          />
        )
      }
    ];
    return data;
  }, [settings]);

  // Remote config data with NOT FETCHED or NOT SET states  
  const remoteConfigData = useMemo(() => {
    // MongoDB config keys
    const expectedKeys = ['uri', 'database'];
    
    // Create a map of fetched config
    const configMap = new Map(remoteConfig.map(item => [item.key, item.value]));
    
    return expectedKeys.map(key => {
      const value = configMap.get(key);
      const displayValue = !hasFetched ? 'NOT FETCHED' : (value || 'NOT SET');
      const isNotSet = !hasFetched || !value;
      const isNotFetched = !hasFetched;
      
      return {
        key,
        value: displayValue,
        valueComp: (props) => {
          // If not fetched, show non-editable text
          if (isNotFetched) {
            return <span className="editable-value-text not-set disabled">{displayValue}</span>;
          }
          // Otherwise show editable component
          return (
            <EditableValueComp
              {...props}
              configKey={key}
              category="mongo"
              valueType="text"
              isNotSet={isNotSet}
              onUpdate={handleRemoteValueUpdate}
            />
          );
        }
      };
    });
  }, [remoteConfig, hasFetched]);

  if (loading) {
    return <div className="config-section">Loading...</div>;
  }

  return (
    <div className="config-section">
      <div className="section-title">Remote Configuration (MongoDB)</div>
      <p className="config-hint">
        Store configuration remotely in MongoDB. This layer overrides local config.
      </p>

      <div className="remote-config-settings">
        <h4>Remote Config Settings:</h4>
        <KeyValuesComp
          data={settingsData}
          isEditable={false}
          alignColumn={true}
          keyColWidth="min"
        />

        {settings.enabled && (
          <div className="remote-config-status">
            <div className="remote-config-status-header">
              <h4>Remote MongoDB Status</h4>
              <button
                onClick={checkStatus}
                disabled={status.checking}
                className="refresh-button"
                title="Check MongoDB status"
              >
                {status.checking ? (
                  <SpinningCircle width={16} height={16} color="#666" />
                ) : (
                  <RefreshIcon width={16} height={16} />
                )}
              </button>
              {status.lastChecked && (
                <span className="status-timestamp">Last checked: {status.lastChecked}</span>
              )}
            </div>

            <table className="status-table">
              <tbody>
                <tr>
                  <td className="status-label">Connection</td>
                  <td className="status-value">
                    {status.connection === null ? (
                      <span className="status-unknown">Not checked</span>
                    ) : status.connection === 'success' ? (
                      <span className="status-success">Connected ✓</span>
                    ) : (
                      <span className="status-error">Failed: {status.connectionMessage}</span>
                    )}
                  </td>
                </tr>
                
                <tr>
                  <td className="status-label">Database</td>
                  <td className="status-value">
                    {status.database === 'N/A' ? (
                      <span className="status-na">N/A</span>
                    ) : status.database === null ? (
                      <span className="status-unknown">Not checked</span>
                    ) : status.database === true ? (
                      <span className="status-success">Exists ✓</span>
                    ) : (
                      <>
                        <span className="status-error">Not found</span>
                        <button 
                          onClick={() => createDatabaseResource('database')}
                          className="create-button"
                        >
                          Create
                        </button>
                      </>
                    )}
                  </td>
                </tr>
                
                <tr>
                  <td className="status-label">Collection</td>
                  <td className="status-value">
                    {status.collection === 'N/A' ? (
                      <span className="status-na">N/A</span>
                    ) : status.collection === null ? (
                      <span className="status-unknown">Not checked</span>
                    ) : status.collection === true ? (
                      <span className="status-success">Exists ✓</span>
                    ) : (
                      <>
                        <span className="status-error">Not found</span>
                        <button 
                          onClick={() => createDatabaseResource('collection')}
                          className="create-button"
                        >
                          Create
                        </button>
                      </>
                    )}
                  </td>
                </tr>
                
                <tr>
                  <td className="status-label">Document</td>
                  <td className="status-value">
                    {status.document === 'N/A' ? (
                      <span className="status-na">N/A</span>
                    ) : status.document === null ? (
                      <span className="status-unknown">Not checked</span>
                    ) : status.document === true ? (
                      <span className="status-success">Exists ✓</span>
                    ) : (
                      <>
                        <span className="status-error">Not found</span>
                        <button 
                          onClick={() => createDatabaseResource('document')}
                          className="create-button"
                        >
                          Create
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="remote-config-data">
          <div className="remote-config-header">
            <h4>
              Remote Config Values:
              <button
                className="refresh-button"
                onClick={handleRefresh}
                disabled={refreshing || !settings.enabled}
                title="Refresh from server"
              >
                <RefreshIcon width={16} height={16} />
              </button>
              {refreshing && <SpinningCircle width={16} height={16} color="#666" />}
            </h4>
          </div>
          
          <KeyValuesComp
            data={remoteConfigData}
            isEditable={false}
            alignColumn={true}
            keyColWidth="min"
          />
        </div>
      </div>
    </div>
  );
};

export default RemoteConfig;

