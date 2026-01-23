import { atom } from 'jotai';
import * as mongoDocOps from '../mongo/mongoStore';
import { extractDocId } from '../mongo/mongoUtils';
import { getBackendServerUrl as getBackendUrl } from './backendServerStore';

// ========== Re-export Backend Server Store ==========
export {
  backendServerUrlAtom,
  backendLocalConfigAtom,
  backendConnectionFailedAtom,
  getBackendServerUrl,
  loadBackendServerUrl,
  updateBackendServerUrl,
  testBackendConnection,
  fetchBackendLocalConfig,
  updateBackendLocalConfig
} from './backendServerStore';

// ========== Re-export MongoDB Store ==========
export {
  mongoAppConfigAtom,
  mongoLocalConfigAtom,
  mongoRemoteConfigAtom,
  mongoRemoteSettingsAtom,
  mongoComputedConfigAtom,
  mongoConfigErrorAtom,
  mongoDatabasesAtom,
  mongoSelectedDatabaseAtom,
  mongoCollectionsAtom,
  mongoSelectedCollectionAtom,
  mongoDocsAtom,
  mongoDocsPageAtom,
  mongoDocsTotalAtom,
  mongoDocsPageSizeAtom,
  fetchMongoAppConfig,
  fetchMongoLocalConfig,
  fetchMongoComputedConfig,
  fetchMongoRemoteConfig,
  fetchMongoRemoteSettings,
  updateMongoRemoteSetting,
  updateMongoRemoteConfig,
  updateMongoConfig,
  fetchMongoDatabases,
  fetchMongoCollections,
  createMongoCollection,
  fetchMongoDocuments,
  createMongoDocument,
  deleteMongoDocument
} from '../mongo/mongoStore';

// ========== JDBC Atoms ==========
export const jdbcAppConfigAtom = atom([]);
export const jdbcLocalConfigAtom = atom([]);
export const jdbcComputedConfigAtom = atom([]);
export const jdbcConfigErrorAtom = atom(null);


// ========== Elasticsearch Atoms ==========
export const esAppConfigAtom = atom([]);
export const esLocalConfigAtom = atom([]);
export const esComputedConfigAtom = atom([]);
export const esConfigErrorAtom = atom(null);
export const esIndicesAtom = atom([]);
export const esSelectedIndexAtom = atom(null);

// ========== Redis Atoms ==========
export const redisAppConfigAtom = atom([]);
export const redisLocalConfigAtom = atom([]);
export const redisComputedConfigAtom = atom([]);
export const redisConfigErrorAtom = atom(null);

// ========== RabbitMQ Atoms ==========
export const rabbitMQAppConfigAtom = atom([]);
export const rabbitMQLocalConfigAtom = atom([]);
export const rabbitMQComputedConfigAtom = atom([]);
export const rabbitMQConfigErrorAtom = atom(null);


// ========== Cross-Subsystem Config Reloader ==========

/**
 * Reload all configs from backend (useful after backend URL change)
 * Returns a function that can be called with setter functions
 */
export function createConfigReloader() {
  return async (setters) => {
    const {
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
    } = setters;

    const reloadPromises = [];

    // MongoDB configs
    if (setMongoAppConfig) {
      reloadPromises.push(
        fetchMongoAppConfig().then(result => {
          if (result.code === 0) setMongoAppConfig(result.data);
        }).catch(err => console.warn('Failed to reload MongoDB app config:', err))
      );
    }
    if (setMongoLocalConfig) {
      reloadPromises.push(
        fetchMongoLocalConfig().then(result => {
          if (result.code === 0) setMongoLocalConfig(result.data);
        }).catch(err => console.warn('Failed to reload MongoDB local config:', err))
      );
    }
    if (setMongoComputedConfig) {
      reloadPromises.push(
        fetchMongoComputedConfig().then(result => {
          if (result.code === 0) setMongoComputedConfig(result.data);
        }).catch(err => console.warn('Failed to reload MongoDB computed config:', err))
      );
    }

    // JDBC configs
    if (setJdbcAppConfig) {
      reloadPromises.push(
        fetchJdbcAppConfig().then(result => {
          if (result.code === 0) setJdbcAppConfig(result.data);
        }).catch(err => console.warn('Failed to reload JDBC app config:', err))
      );
    }
    if (setJdbcLocalConfig) {
      reloadPromises.push(
        fetchJdbcLocalConfig().then(result => {
          if (result.code === 0) setJdbcLocalConfig(result.data);
        }).catch(err => console.warn('Failed to reload JDBC local config:', err))
      );
    }
    if (setJdbcComputedConfig) {
      reloadPromises.push(
        fetchJdbcComputedConfig().then(result => {
          if (result.code === 0) setJdbcComputedConfig(result.data);
        }).catch(err => console.warn('Failed to reload JDBC computed config:', err))
      );
    }

    // Elasticsearch configs
    if (setEsAppConfig) {
      reloadPromises.push(
        fetchElasticsearchAppConfig().then(result => {
          if (result.code === 0) setEsAppConfig(result.data);
        }).catch(err => console.warn('Failed to reload ES app config:', err))
      );
    }
    if (setEsLocalConfig) {
      reloadPromises.push(
        fetchElasticsearchLocalConfig().then(result => {
          if (result.code === 0) setEsLocalConfig(result.data);
        }).catch(err => console.warn('Failed to reload ES local config:', err))
      );
    }
    if (setEsComputedConfig) {
      reloadPromises.push(
        fetchElasticsearchComputedConfig().then(result => {
          if (result.code === 0) setEsComputedConfig(result.data);
        }).catch(err => console.warn('Failed to reload ES computed config:', err))
      );
    }

    // Redis configs
    if (setRedisAppConfig) {
      reloadPromises.push(
        fetchRedisAppConfig().then(result => {
          if (result.code === 0) setRedisAppConfig(result.data);
        }).catch(err => console.warn('Failed to reload Redis app config:', err))
      );
    }
    if (setRedisLocalConfig) {
      reloadPromises.push(
        fetchRedisLocalConfig().then(result => {
          if (result.code === 0) setRedisLocalConfig(result.data);
        }).catch(err => console.warn('Failed to reload Redis local config:', err))
      );
    }
    if (setRedisComputedConfig) {
      reloadPromises.push(
        fetchRedisComputedConfig().then(result => {
          if (result.code === 0) setRedisComputedConfig(result.data);
        }).catch(err => console.warn('Failed to reload Redis computed config:', err))
      );
    }

    // RabbitMQ configs
    if (setRabbitMQAppConfig) {
      reloadPromises.push(
        fetchRabbitMQAppConfig().then(result => {
          if (result.code === 0) setRabbitMQAppConfig(result.data);
        }).catch(err => console.warn('Failed to reload RabbitMQ app config:', err))
      );
    }
    if (setRabbitMQLocalConfig) {
      reloadPromises.push(
        fetchRabbitMQLocalConfig().then(result => {
          if (result.code === 0) setRabbitMQLocalConfig(result.data);
        }).catch(err => console.warn('Failed to reload RabbitMQ local config:', err))
      );
    }
    if (setRabbitMQComputedConfig) {
      reloadPromises.push(
        fetchRabbitMQComputedConfig().then(result => {
          if (result.code === 0) setRabbitMQComputedConfig(result.data);
        }).catch(err => console.warn('Failed to reload RabbitMQ computed config:', err))
      );
    }

    await Promise.allSettled(reloadPromises);
    console.log('All configs reloaded after backend URL change');
  };
}

// ========== API Functions ==========

/**
 * Fetch JDBC config from application.properties
 */
export async function fetchJdbcAppConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/jdbc/config/app/`);
    const result = await response.json();
    if (result.code === 0 && result.data) {
      const configArray = Object.entries(result.data).map(([key, value]) => ({
        key: key,
        value: String(value)
      }));
      return { code: 0, data: configArray };
    }
    return { code: -1, message: 'Invalid response' };
  } catch (error) {
    console.log('[ERROR]Failed to fetch JDBC app config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch JDBC local config from SQLite
 */
export async function fetchJdbcLocalConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/local_config/category/jdbc/`);
    const result = await response.json();
    if (result.code === 0 && result.data) {
      const configArray = Object.entries(result.data).map(([key, value]) => ({
        key: key.replace('jdbc.', ''),
        value: String(value)
      }));
      return { code: 0, data: configArray };
    }
    return { code: -1, message: 'Invalid response' };
  } catch (error) {
    console.log('[ERROR]Failed to fetch JDBC local config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch JDBC computed config (merged)
 */
export async function fetchJdbcComputedConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/jdbc/config/`);
    const result = await response.json();
    if (result.code === 0 && result.data) {
      const configArray = Object.entries(result.data).map(([key, value]) => ({
        key: key,
        value: String(value)
      }));
      
      // Store keys globally for EditableValueComp
      if (!window.__computedConfigKeys) {
        window.__computedConfigKeys = {};
      }
      window.__computedConfigKeys.jdbc = configArray.map(item => item.key);
      
      return { code: 0, data: configArray };
    }
    return { code: -1, message: 'Invalid response' };
  } catch (error) {
    console.error('Failed to fetch JDBC computed config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Update JDBC config (saves to local override)
 */
export async function updateJdbcConfig(key, value) {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/jdbc/config/set/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: key,
        value: value
      })
    });

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Success' };
    }
    return { code: -1, message: result.message || 'Update failed' };
  } catch (error) {
    console.error('Failed to update JDBC config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

// ========== MongoDB Document Operations (Re-exported from mongoStore) ==========
// Re-export from mongoStore for convenience
export const {
  updateDocField,
  deleteDocField,
  createDocField,
  addArrayItem,
  removeArrayItem
} = mongoDocOps;

// Export the hook and utility functions separately
export { useMongoDocEditor } from '../mongo/mongoStore';
export { extractDocId };

// ========== Elasticsearch API Functions ==========

/**
 * Fetch Elasticsearch config from application.properties
 */
export async function fetchElasticsearchAppConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/elasticsearch/config/app/`);
    const result = await response.json();
    if (result.code === 0 && result.data) {
      const configArray = Object.entries(result.data).map(([key, value]) => ({
        key: key,
        value: String(value)
      }));
      return { code: 0, data: configArray };
    }
    return { code: -1, message: 'Invalid response' };
  } catch (error) {
    console.error('Failed to fetch Elasticsearch app config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch Elasticsearch local config from SQLite
 */
export async function fetchElasticsearchLocalConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/local_config/category/elasticsearch/`);
    const result = await response.json();
    if (result.code === 0 && result.data) {
      const configArray = Object.entries(result.data).map(([key, value]) => ({
        key: key.replace('elasticsearch.', ''),
        value: String(value)
      }));
      return { code: 0, data: configArray };
    }
    return { code: -1, message: 'Invalid response' };
  } catch (error) {
    console.error('Failed to fetch Elasticsearch local config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch Elasticsearch computed config (merged)
 */
export async function fetchElasticsearchComputedConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/elasticsearch/config/`);
    const result = await response.json();
    if (result.code === 0 && result.data) {
      const configArray = Object.entries(result.data).map(([key, value]) => ({
        key: key,
        value: String(value)
      }));
      
      // Store keys globally for EditableValueComp
      if (!window.__computedConfigKeys) {
        window.__computedConfigKeys = {};
      }
      window.__computedConfigKeys.elasticsearch = configArray.map(item => item.key);
      
      return { code: 0, data: configArray };
    }
    return { code: -1, message: 'Invalid response' };
  } catch (error) {
    console.error('Failed to fetch Elasticsearch computed config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Update Elasticsearch config (saves to local override)
 */
export async function updateElasticsearchConfig(key, value) {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/elasticsearch/config/set/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: key,
        value: value
      })
    });

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Success' };
    }
    return { code: -1, message: result.message || 'Update failed' };
  } catch (error) {
    console.error('Failed to update Elasticsearch config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch all Elasticsearch indices
 */
export async function fetchEsIndices() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/elasticsearch/indices/`);
    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to fetch indices' };
  } catch (error) {
    console.error('Failed to fetch Elasticsearch indices:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch information about a specific Elasticsearch index
 */
export async function fetchEsIndexInfo(indexName) {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/elasticsearch/indices/${encodeURIComponent(indexName)}`);
    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to fetch index info' };
  } catch (error) {
    console.error('Failed to fetch Elasticsearch index info:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

// ========== Redis Config API ==========

/**
 * Fetch Redis config from application.properties
 */
export async function fetchRedisAppConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/redis/config/`);
    const result = await response.json();
    
    if (result.code === 0) {
      const configArray = Object.entries(result.data).map(([key, value]) => ({
        key,
        value: value === null ? '' : String(value)
      }));
      return { code: 0, data: configArray };
    }
    return { code: -1, message: result.message || 'Failed to fetch config' };
  } catch (error) {
    console.error('Failed to fetch Redis application.properties config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch Redis local config from SQLite
 */
export async function fetchRedisLocalConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/redis/config/local/`);
    const result = await response.json();
    
    if (result.code === 0) {
      const configArray = Object.entries(result.data).map(([key, value]) => ({
        key,
        value: value === null ? '' : String(value)
      }));
      return { code: 0, data: configArray };
    }
    return { code: -1, message: result.message || 'Failed to fetch local config' };
  } catch (error) {
    console.error('Failed to fetch Redis local config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch Redis computed config (merged)
 */
export async function fetchRedisComputedConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/redis/config/computed/`);
    const result = await response.json();
    
    if (result.code === 0) {
      const configArray = Object.entries(result.data).map(([key, value]) => ({
        key,
        value: value === null ? '' : String(value)
      }));
      
      // Store config keys globally for EditableValueComp
      if (!window.__computedConfigKeys) {
        window.__computedConfigKeys = {};
      }
      window.__computedConfigKeys.redis = configArray.map(item => item.key);
      
      return { code: 0, data: configArray };
    }
    return { code: -1, message: 'Invalid response' };
  } catch (error) {
    console.error('Failed to fetch Redis computed config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Update Redis config (saves to local override)
 */
export async function updateRedisConfig(key, value) {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/redis/config/set/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: key,
        value: value
      })
    });

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Success' };
    }
    return { code: -1, message: result.message || 'Update failed' };
  } catch (error) {
    console.error('Failed to update Redis config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

// RabbitMQ Configuration APIs
export async function fetchRabbitMQAppConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/rabbitmq/config/`);
    const result = await response.json();
    
    if (result.code === 0) {
      const configArray = Object.entries(result.data).map(([key, value]) => ({
        key,
        value: value === null ? '' : String(value)
      }));
      return { code: 0, data: configArray };
    }
    return { code: -1, message: result.message || 'Failed to fetch RabbitMQ application config' };
  } catch (error) {
    console.error('Failed to fetch RabbitMQ application.properties config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

export async function fetchRabbitMQLocalConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/rabbitmq/config/local/`);
    const result = await response.json();
    
    if (result.code === 0) {
      // Backend already returns List<Map<String, String>>
      return { code: 0, data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to fetch RabbitMQ local config' };
  } catch (error) {
    console.error('Failed to fetch RabbitMQ local config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

export async function fetchRabbitMQComputedConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/rabbitmq/config/computed/`);
    const result = await response.json();
    
    if (result.code === 0) {
      // Backend already returns List<Map<String, String>>
      return { code: 0, data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to fetch RabbitMQ computed config' };
  } catch (error) {
    console.error('Failed to fetch RabbitMQ computed config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

export async function updateRabbitMQConfig(path, value) {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/rabbitmq/config/set/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path, value }),
    });

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Success' };
    }
    return { code: -1, message: result.message || 'Update failed' };
  } catch (error) {
    console.error('Failed to update RabbitMQ config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}
