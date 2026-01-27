import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  TabsOnTop, KeyValues, KeyValuesComp, EditableValueComp, RefreshIcon
} from '@wwf971/react-comp-misc';
import {
  idAppConfigAtom,
  idLocalConfigAtom,
  idComputedConfigAtom,
  idConfigErrorAtom,
  fetchIdAppConfig,
  fetchIdLocalConfig,
  fetchIdComputedConfig,
  updateIdConfig
} from '../remote/dataStore';
import '../styles/common.css';

const IdConfig = () => {
  const appConfig = useAtomValue(idAppConfigAtom);
  const localConfig = useAtomValue(idLocalConfigAtom);
  const computedConfig = useAtomValue(idComputedConfigAtom);
  const configError = useAtomValue(idConfigErrorAtom);
  const setAppConfig = useSetAtom(idAppConfigAtom);
  const setLocalConfig = useSetAtom(idLocalConfigAtom);
  const setComputedConfig = useSetAtom(idComputedConfigAtom);
  const setConfigError = useSetAtom(idConfigErrorAtom);
  const [loading, setLoading] = useState(false);

  const loadAllConfigs = useCallback(async () => {
    setLoading(true);
    setConfigError(null);
    const [appResult, localResult, computedResult] = await Promise.all([
      fetchIdAppConfig(),
      fetchIdLocalConfig(),
      fetchIdComputedConfig()
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

  const handleLocalUpdate = useCallback(async (configKey, newValue) => {
    const result = await updateIdConfig(configKey, newValue);
    
    if (result.code === 0) {
      await loadAllConfigs();
    }
    
    return result;
  }, [loadAllConfigs]);

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
                category="id"
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
  }, [localConfig, computedConfig]);

  return (
    <>
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
              <div className="section-title">ID Service Configuration from application.properties</div>
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
              <div className="section-title">ID Service Configuration from Local Storage (Editable)</div>
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
              <div className="section-title">ID Service Computed Configuration (Read-only)</div>
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
    </>
  );
};

export default IdConfig;
