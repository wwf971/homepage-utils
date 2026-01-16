import { atom } from 'jotai';
import * as mongoDocOps from '../mongo/mongoStore';
import { extractDocId } from '../mongo/mongoUtils';

// ========== Backend Server Config ==========
export const backendServerUrlAtom = atom('http://localhost:900');

// Helper to get current backend URL (synchronous)
function getBackendUrl() {
  // Priority: localStorage > default
  const stored = localStorage.getItem('backendServerUrl');
  return stored || 'http://localhost:900';
}

// Load backend server URL from config files (async, for UI display)
async function loadBackendUrlFromFiles() {
  // Try config.0.js first (higher priority)
  try {
    const response = await fetch('/config.0.js');
    const text = await response.text();
    const match = text.match(/SERVER_URL\s*=\s*['"]([^'"]+)['"]/);
    if (match) {
      console.log('Loaded backend URL from config.0.js:', match[1]);
      return match[1];
    }
  } catch (e) {
    // File not found, continue
  }

  // Try config.js
  try {
    const response = await fetch('/config.js');
    const text = await response.text();
    const match = text.match(/SERVER_URL\s*=\s*['"]([^'"]+)['"]/);
    if (match) {
      console.log('Loaded backend URL from config.js:', match[1]);
      return match[1];
    }
  } catch (e) {
    // File not found
  }

  // No config file found
  return null;
}

// ========== JDBC Atoms ==========
export const jdbcAppConfigAtom = atom([]);
export const jdbcLocalConfigAtom = atom([]);
export const jdbcComputedConfigAtom = atom([]);
export const jdbcConfigErrorAtom = atom(null);

// ========== MongoDB Atoms ==========
export const mongoAppConfigAtom = atom([]);
export const mongoLocalConfigAtom = atom([]);
export const mongoRemoteConfigAtom = atom([]);
export const mongoRemoteSettingsAtom = atom({});
export const mongoComputedConfigAtom = atom([]);
export const mongoConfigErrorAtom = atom(null);

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

// MongoDB Databases & Collections
export const mongoDatabasesAtom = atom([]);
export const mongoSelectedDatabaseAtom = atom(null);
export const mongoCollectionsAtom = atom([]);
export const mongoSelectedCollectionAtom = atom(null);

// MongoDB Documents
export const mongoDocsAtom = atom([]);
export const mongoDocsPageAtom = atom(1);
export const mongoDocsTotalAtom = atom(0);
export const mongoDocsPageSizeAtom = atom(20);

// ========== Backend Server Config API ==========

/**
 * Get current backend server URL
 */
export function getBackendServerUrl() {
  return getBackendUrl();
}

/**
 * Update backend server URL
 */
export function updateBackendServerUrl(url) {
  localStorage.setItem('backendServerUrl', url);
  return { code: 0, message: 'Backend URL updated' };
}

/**
 * Test backend server connection
 */
export async function testBackendConnection(url) {
  try {
    const response = await fetch(`${url}/actuator/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    const result = await response.json();
    if (result.status === 'UP') {
      return { code: 0, message: 'Connection successful', data: result };
    }
    return { code: -1, message: 'Server is not healthy' };
  } catch (error) {
    return { code: -2, message: error.message || 'Connection failed' };
  }
}

// ========== API Functions ==========

/**
 * Fetch JDBC config from application.properties
 */
export async function fetchJdbcAppConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/jdbc/config/`);
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
    console.log('[ERROR]Failed to fetch JDBC config:', error);
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

// ========== MongoDB API Functions ==========

/**
 * Fetch MongoDB config from application.properties
 */
export async function fetchMongoAppConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/mongo/config/`);
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
    console.log('[ERROR]Failed to fetch MongoDB config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch MongoDB local config from SQLite
 */
export async function fetchMongoLocalConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/local_config/category/mongo/`);
    const result = await response.json();
    if (result.code === 0 && result.data) {
      const configArray = Object.entries(result.data).map(([key, value]) => ({
        key: key.replace('mongo.', ''),
        value: String(value)
      }));
      return { code: 0, data: configArray };
    }
    return { code: -1, message: 'Invalid response' };
  } catch (error) {
    console.log('[ERROR]Failed to fetch MongoDB local config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch MongoDB computed config (merged)
 */
export async function fetchMongoComputedConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/mongo/config/`);
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
      window.__computedConfigKeys.mongo = configArray.map(item => item.key);
      
      return { code: 0, data: configArray };
    }
    return { code: -1, message: 'Invalid response' };
  } catch (error) {
    console.log('[ERROR]Failed to fetch MongoDB computed config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch MongoDB remote config
 */
export async function fetchMongoRemoteConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/mongo/remote_config/`);
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
    console.log('[ERROR]Failed to fetch MongoDB remote config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch MongoDB remote config settings
 */
export async function fetchMongoRemoteSettings() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/mongo/remote_config/settings/`);
    const result = await response.json();
    if (result.code === 0 && result.data) {
      return { code: 0, data: result.data };
    }
    return { code: -1, message: 'Invalid response' };
  } catch (error) {
    console.log('[ERROR]Failed to fetch MongoDB remote settings:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Update MongoDB remote config setting
 */
export async function updateMongoRemoteSetting(key, value) {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/mongo/remote_config/settings/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: key,
        value: value
      })
    });

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Success' };
    }
    return { code: -1, message: result.message || 'Update failed' };
  } catch (error) {
    console.log('[ERROR]Failed to update MongoDB remote setting:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Update MongoDB remote config (saves to MongoDB)
 */
export async function updateMongoRemoteConfig(key, value) {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/mongo/remote_config/set/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: key,
        value: value
      })
    });

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Success' };
    }
    return { code: -1, message: result.message || 'Update failed' };
  } catch (error) {
    console.log('[ERROR]Failed to update MongoDB remote config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Update MongoDB config (saves to local override)
 */
export async function updateMongoConfig(key, value) {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/mongo/config/set/`, {
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
    console.log('[ERROR]Failed to update MongoDB config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch all MongoDB databases
 */
export async function fetchMongoDatabases() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/mongo/db/`);
    const result = await response.json();
    
    if (result.code === 0 && result.data) {
      return { code: 0, data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to fetch databases' };
  } catch (error) {
    console.log('[ERROR]Failed to fetch MongoDB databases:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch collections in a specific MongoDB database
 */
export async function fetchMongoCollections(databaseName) {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/mongo/db/${encodeURIComponent(databaseName)}/coll/`);
    const result = await response.json();
    
    if (result.code === 0 && result.data) {
      return { code: 0, data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to fetch collections' };
  } catch (error) {
    console.log('[ERROR]Failed to fetch MongoDB collections:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Create a new collection in a MongoDB database
 */
export async function createMongoCollection(databaseName, collectionName) {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/mongo/db/${encodeURIComponent(databaseName)}/coll/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: collectionName
      })
    });

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: result.message || 'Collection created successfully' };
    }
    return { code: -1, message: result.message || 'Failed to create collection' };
  } catch (error) {
    console.log('[ERROR]Failed to create MongoDB collection:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Fetch documents in a specific MongoDB collection with pagination
 */
export async function fetchMongoDocuments(databaseName, collectionName, page = 1, pageSize = 20) {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(
      `${backendUrl}/mongo/db/${encodeURIComponent(databaseName)}/coll/${encodeURIComponent(collectionName)}/docs/?page=${page}&pageSize=${pageSize}`
    );
    const result = await response.json();
    
    if (result.code === 0 && result.data) {
      return { 
        code: 0, 
        data: result.data.documents || [], 
        total: result.data.total || 0,
        page: result.data.page || page,
        pageSize: result.data.pageSize || pageSize
      };
    }
    return { code: -1, message: result.message || 'Failed to fetch documents' };
  } catch (error) {
    console.error('Failed to fetch MongoDB documents:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Create an empty document in a MongoDB collection
 */
export async function createMongoDocument(databaseName, collectionName) {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(
      `${backendUrl}/mongo/db/${encodeURIComponent(databaseName)}/coll/${encodeURIComponent(collectionName)}/docs/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, data: result.data, message: result.message || 'Document created successfully' };
    }
    return { code: -1, message: result.message || 'Failed to create document' };
  } catch (error) {
    console.error('Failed to create MongoDB document:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Delete a document from a MongoDB collection
 */
export async function deleteMongoDocument(databaseName, collectionName, docId) {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(
      `${backendUrl}/mongo/db/${encodeURIComponent(databaseName)}/coll/${encodeURIComponent(collectionName)}/docs/${encodeURIComponent(docId)}/`,
      {
        method: 'DELETE'
      }
    );

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: result.message || 'Document deleted successfully' };
    }
    return { code: -1, message: result.message || 'Failed to delete document' };
  } catch (error) {
    console.error('Failed to delete MongoDB document:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

// ========== MongoDB Document Operations ==========
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
    const response = await fetch(`${backendUrl}/elasticsearch/config/`);
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
    console.error('Failed to fetch Elasticsearch config:', error);
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
export async function fetchElasticsearchIndices() {
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
export async function fetchElasticsearchIndexInfo(indexName) {
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
