import { atom } from 'jotai';

// ========== Backend Server Config Atoms ==========
export const backendServerUrlAtom = atom('http://localhost:900');

// Backend Server Local Config Atoms
export const backendLocalConfigAtom = atom({
  serverName: '',
  serverId: ''
});

// Track if backend connection has ever failed (for re-fetching configs when it comes back)
export const backendConnectionFailedAtom = atom(false);

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

// ========== Backend Server Config API ==========

/**
 * Get current backend server URL
 */
export function getBackendServerUrl() {
  return getBackendUrl();
}

/**
 * Get backend server URL with layered config priority:
 * localStorage > config.0.js > config.js > default
 */
export async function loadBackendServerUrl() {
  // Check localStorage first (highest priority)
  const stored = localStorage.getItem('backendServerUrl');
  if (stored) {
    console.log('Using backend URL from localStorage:', stored);
    return stored;
  }

  // Check config files
  const fileUrl = await loadBackendUrlFromFiles();
  if (fileUrl) {
    return fileUrl;
  }

  // Use default
  console.log('Using default backend URL: http://localhost:900');
  return 'http://localhost:900';
}

/**
 * Update backend server URL in localStorage
 */
export function updateBackendServerUrl(url) {
  localStorage.setItem('backendServerUrl', url);
  
  // Clear all caches after URL change
  import('../mongo/mongoStore').then(module => {
    if (module.clearMongoCache) {
      module.clearMongoCache();
    }
  }).catch(err => console.warn('Failed to clear mongo cache:', err));
  
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

/**
 * Fetch backend local config from backend SQLite database
 */
export async function fetchBackendLocalConfig() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/local_config/category/backend/`);
    const result = await response.json();
    if (result.code === 0 && result.data) {
      return { code: 0, data: result.data };
    }
    return { code: -1, message: result.message || 'No config found', data: {} };
  } catch (error) {
    console.log('[ERROR] Failed to fetch backend local config:', error);
    return { code: -2, message: error.message || 'Network error', data: {} };
  }
}

/**
 * Update backend local config value
 */
export async function updateBackendLocalConfig(key, value) {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/local_config/set/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        category: 'backend',
        key: key,
        value: value
      })
    });
    const result = await response.json();
    return result;
  } catch (error) {
    console.log('[ERROR] Failed to update backend local config:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}
