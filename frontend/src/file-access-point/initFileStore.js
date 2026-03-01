/**
 * Initialize fileStore with frontend-specific dependencies
 * This must be called early in the app initialization, before any component uses fileStore
 */

import { initFileStore } from '@wwf971/homepage-utils-utils';
import mongoDocStore from '../mongo/mongoDocStore';
import { updateDocField } from '../mongo/mongoStore';
import { getBackendServerUrl } from '../remote/dataStore';

// Initialize the store with dependencies
initFileStore({
  mongoDocStore,
  updateDocField,
  getBackendServerUrl
});

console.log('[initFileStore] File store initialized with frontend dependencies');
