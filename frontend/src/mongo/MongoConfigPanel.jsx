import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { TabsOnTop, KeyValues, KeyValuesComp, EditableValueComp, RefreshIcon } from '@wwf971/react-comp-misc';
import RemoteConfig from './RemoteConfig';
import {
  mongoAppConfigAtom,
  mongoLocalConfigAtom,
  mongoComputedConfigAtom,
  mongoConfigErrorAtom,
  fetchMongoAppConfig,
  fetchMongoLocalConfig,
  fetchMongoComputedConfig,
  updateMongoConfig
} from '../remote/dataStore';
import '../styles/common.css';

const MongoConfigPanel = () => {
  const appConfig = useAtomValue(mongoAppConfigAtom);
  const localConfig = useAtomValue(mongoLocalConfigAtom);
  const computedConfig = useAtomValue(mongoComputedConfigAtom);
  const configError = useAtomValue(mongoConfigErrorAtom);
  const setAppConfig = useSetAtom(mongoAppConfigAtom);
  const setLocalConfig = useSetAtom(mongoLocalConfigAtom);
  const setComputedConfig = useSetAtom(mongoComputedConfigAtom);
  const setConfigError = useSetAtom(mongoConfigErrorAtom);
  const [loading, setLoading] = useState(false);

  const loadAllConfigs = useCallback(async () => {
    setLoading(true);
    setConfigError(null);
    const timeout = (ms) => new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), ms)
    );

    // Load all configs with timeout
    try {
      const allPromises = Promise.all([
        fetchMongoAppConfig(),
        fetchMongoLocalConfig(),
        fetchMongoComputedConfig()
      ]);

      const [appResult, localResult, computedResult] = await Promise.race([
        allPromises,
        timeout(5000) // 5 second timeout for all requests
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
      
      console.log('✓ Configs loaded successfully');
    } catch (error) {
      console.warn('⚠ Failed to load configs (timeout after 5s):', error.message);
      console.warn('Backend may be hanging while connecting to MongoDB');
      setConfigError({ layer: 'all', message: `Timeout: ${error.message}. Backend may be down or hanging.` });
    } finally {
      setLoading(false);
    }
  }, [setAppConfig, setLocalConfig, setComputedConfig, setConfigError]);

  useEffect(() => {
    loadAllConfigs();
  }, [loadAllConfigs]);

  // Update callback for local config edits
  const handleLocalUpdate = useCallback(async (configKey, newValue) => {
    const timeout = (ms) => new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Update timeout - backend not responding')), ms)
    );

    try {
      // Call update with 5 second timeout
      const result = await Promise.race([
        updateMongoConfig(configKey, newValue),
        timeout(5000)
      ]);
      
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

        console.log(`✓ Config updated: ${configKey} = ${newValue}`);

        // Try to reload all configs in background (non-blocking, with its own timeout)
        loadAllConfigs().catch(err => {
          console.warn('⚠ Config reload skipped:', err.message);
        });
      }
      
      return result;
    } catch (error) {
      console.error('❌ Update failed or timed out:', error.message);
      return { 
        code: -1, 
        message: error.message === 'Update timeout - backend not responding' 
          ? 'Backend not responding (MongoDB may be down)' 
          : (error.message || 'Update failed') 
      };
    }
  }, [loadAllConfigs, setLocalConfig]);

  // Memoize local config with editable value component
  // Show all keys from computed config, with "NOT SET" for missing values
  const localConfigWithComp = useMemo(() => {
    // Create a map of local config for quick lookup
    const localMap = new Map(localConfig.map(item => [item.key, item.value]));
    
    // Use computed config keys as the base (all possible keys)
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
                category="mongo"
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
              <div className="section-title">MongoDB Configuration from application.properties</div>
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
              <div className="section-title">MongoDB Configuration from Local Storage (Editable)</div>
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
        
        <TabsOnTop.Tab label="Remote Config">
          <RemoteConfig />
        </TabsOnTop.Tab>
        
        <TabsOnTop.Tab label="Computed Config">
          <div className="config-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="section-title">MongoDB Computed Configuration (Read-only)</div>
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

export default MongoConfigPanel;

