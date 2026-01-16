import React, { useEffect, useMemo, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  TabsOnTop, KeyValues, KeyValuesComp, EditableValueComp, RefreshIcon
} from '@wwf971/react-comp-misc';
import {
  esAppConfigAtom,
  esLocalConfigAtom,
  esComputedConfigAtom,
  esConfigErrorAtom,
  fetchElasticsearchAppConfig,
  fetchElasticsearchLocalConfig,
  fetchElasticsearchComputedConfig,
  updateElasticsearchConfig
} from '../remote/dataStore';
import '../remote/configPanelStyles.css';

export const ConfigPanel = () => {
  const appConfig = useAtomValue(esAppConfigAtom);
  const localConfig = useAtomValue(esLocalConfigAtom);
  const computedConfig = useAtomValue(esComputedConfigAtom);
  const configError = useAtomValue(esConfigErrorAtom);
  const setAppConfig = useSetAtom(esAppConfigAtom);
  const setLocalConfig = useSetAtom(esLocalConfigAtom);
  const setComputedConfig = useSetAtom(esComputedConfigAtom);
  const setConfigError = useSetAtom(esConfigErrorAtom);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAllConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAllConfigs = async () => {
    setLoading(true);
    setConfigError(null);
    const [appResult, localResult, computedResult] = await Promise.all([
      fetchElasticsearchAppConfig(),
      fetchElasticsearchLocalConfig(),
      fetchElasticsearchComputedConfig()
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
  };

  // Update callback for local config edits
  const handleLocalUpdate = async (configKey, newValue) => {
    const result = await updateElasticsearchConfig(configKey, newValue);
    
    if (result.code === 0) {
      // Reload all configs after successful update
      await loadAllConfigs();
    }
    
    return result;
  };

  // Memoize local config with editable value component
  // Show all keys from computed config, with "NOT SET" for missing values
  const localConfigWithComp = useMemo(() => {
    // Create a map of local config for quick lookup
    const localMap = new Map(localConfig.map(item => [item.key, item.value]));
    
    // Use computed config keys as the base (all possible keys)
    return computedConfig.map((item, index) => {
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
                category="elasticsearch"
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
    <div className="config-panel">
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
              <h3 style={{ margin: 0 }}>Elasticsearch Configuration from application.properties</h3>
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
              <h3 style={{ margin: 0 }}>Elasticsearch Configuration from Local Storage (Editable)</h3>
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
              <h3 style={{ margin: 0 }}>Elasticsearch Computed Configuration (Read-only)</h3>
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

export default ConfigPanel;

