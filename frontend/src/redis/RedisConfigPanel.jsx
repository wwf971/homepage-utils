import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  TabsOnTop, KeyValues, KeyValuesComp, EditableValueComp, RefreshIcon
} from '@wwf971/react-comp-misc';
import {
  redisAppConfigAtom,
  redisLocalConfigAtom,
  redisComputedConfigAtom,
  redisConfigErrorAtom,
  fetchRedisAppConfig,
  fetchRedisLocalConfig,
  fetchRedisComputedConfig,
  updateRedisConfig
} from '../remote/dataStore';
import '../styles/configPanel.css';

export const RedisConfigPanel = () => {
  const appConfig = useAtomValue(redisAppConfigAtom);
  const localConfig = useAtomValue(redisLocalConfigAtom);
  const computedConfig = useAtomValue(redisComputedConfigAtom);
  const configError = useAtomValue(redisConfigErrorAtom);
  const setAppConfig = useSetAtom(redisAppConfigAtom);
  const setLocalConfig = useSetAtom(redisLocalConfigAtom);
  const setComputedConfig = useSetAtom(redisComputedConfigAtom);
  const setConfigError = useSetAtom(redisConfigErrorAtom);
  const [loading, setLoading] = useState(false);

  const loadAllConfigs = useCallback(async () => {
    setLoading(true);
    setConfigError(null);
    const [appResult, localResult, computedResult] = await Promise.all([
      fetchRedisAppConfig(),
      fetchRedisLocalConfig(),
      fetchRedisComputedConfig()
    ]);
    
    if (appResult.code === 0) {
      setAppConfig(appResult.data);
    } else {
      setConfigError({ layer: 'application.properties', message: appResult.message });
    }
    
    if (localResult.code === 0) {
      setLocalConfig(localResult.data);
    } else if (localResult.code !== -1) {
      setConfigError({ layer: 'local', message: localResult.message });
    }
    
    if (computedResult.code === 0) {
      setComputedConfig(computedResult.data);
    } else {
      setConfigError({ layer: 'computed', message: computedResult.message });
    }
    
    setLoading(false);
  }, [setAppConfig, setLocalConfig, setComputedConfig, setConfigError]);

  useEffect(() => {
    loadAllConfigs();
  }, [loadAllConfigs]);

  // Update callback for local config edits
  const handleLocalUpdate = useCallback(async (configKey, newValue) => {
    const result = await updateRedisConfig(configKey, newValue);
    
    if (result.code === 0) {
      // Update local state immediately for responsiveness
      setLocalConfig(prevConfig => {
        const updated = prevConfig.map(item => 
          item.key === configKey ? { ...item, value: newValue } : item
        );
        // If key doesn't exist, add it
        if (!updated.some(item => item.key === configKey)) {
          updated.push({ key: configKey, value: newValue });
        }
        return updated;
      });

      // Reload all configs
      await loadAllConfigs();
    }
    
    return result;
  }, [loadAllConfigs, setLocalConfig]);

  // Memoize local config with editable value component
  const localConfigWithComp = useMemo(() => {
    const localMap = new Map(localConfig.map(item => [item.key, item.value]));
    
    return computedConfig.map((item) => {
      const localValue = localMap.get(item.key);
      const isNotSet = localValue === undefined;
      const isEmpty = localValue === '';
      
      return {
        key: item.key,
        value: isNotSet ? 'NOT SET' : (isEmpty ? '(empty)' : localValue),
        valueComp: (props) => (
          <div className="editable-value-wrapper">
            <div className="editable-value-inner">
              <EditableValueComp 
                {...props} 
                category="redis"
                isNotSet={isNotSet}
                configKey={item.key}
                onUpdate={handleLocalUpdate}
              />
              <button
                onClick={async () => {
                  await handleLocalUpdate(item.key, '');
                }}
                className="clear-button"
                title="Set to empty string"
              >
                Clear
              </button>
            </div>
          </div>
        )
      };
    });
  }, [localConfig, computedConfig, handleLocalUpdate]);

  return (
    <div className="main-panel">
      {configError && (
        <div style={{ 
          padding: '12px', 
          margin: '12px 0', 
          backgroundColor: '#fee', 
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c33'
        }}>
          <strong>Error loading {configError.layer} config:</strong> {configError.message}
        </div>
      )}
      <TabsOnTop defaultTab="application.properties">
        <TabsOnTop.Tab label="application.properties">
          <div className="config-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0 }}>Redis Configuration from application.properties</h3>
              <button
                onClick={loadAllConfigs}
                disabled={loading}
                style={{
                  padding: '4px 8px',
                  border: 'none',
                  background: 'transparent',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: loading ? 0.5 : 1
                }}
                title="Refresh configuration"
              >
                <RefreshIcon width={18} height={18} />
              </button>
            </div>
            {appConfig.length === 0 && !configError ? (
              <div style={{ padding: '12px', color: '#666' }}>Loading configuration...</div>
            ) : (
              <KeyValues data={appConfig} isEditable={false} />
            )}
          </div>
        </TabsOnTop.Tab>
        
        <TabsOnTop.Tab label="Local Override">
          <div className="config-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0 }}>Redis Configuration from Local Storage (Editable)</h3>
              <button
                onClick={loadAllConfigs}
                disabled={loading}
                style={{
                  padding: '4px 8px',
                  border: 'none',
                  background: 'transparent',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: loading ? 0.5 : 1
                }}
                title="Refresh configuration"
              >
                <RefreshIcon width={18} height={18} />
              </button>
            </div>
            <p className="config-hint">
              Click the edit icon to modify values. Changes are saved locally.
            </p>
            <KeyValuesComp 
              data={localConfigWithComp} 
              isEditable={false}
              alignColumn={true}
              keyColWidth="min"
            />
          </div>
        </TabsOnTop.Tab>
        
        <TabsOnTop.Tab label="Computed Config">
          <div className="config-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0 }}>Redis Computed Configuration (Read-only)</h3>
              <button
                onClick={loadAllConfigs}
                disabled={loading}
                style={{
                  padding: '4px 8px',
                  border: 'none',
                  background: 'transparent',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: loading ? 0.5 : 1
                }}
                title="Refresh configuration"
              >
                <RefreshIcon width={18} height={18} />
              </button>
            </div>
            <p className="config-hint">
              This shows the final configuration after merging all layers.
            </p>
            <KeyValues data={computedConfig} isEditable={false} />
          </div>
        </TabsOnTop.Tab>
      </TabsOnTop>
    </div>
  );
};

export default RedisConfigPanel;
