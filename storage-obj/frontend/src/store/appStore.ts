import { makeAutoObservable } from 'mobx'
import { serviceStore } from './serviceStore'
import { spaceStore } from '../space/spaceStore'
import { objectStore } from '../object/objectStore'
import { storageEndpointStore } from './storageEndpointStore'

export const PAGE_KEY = {
  metadata: 'metadata',
  basicInfo: 'basic-info',
  database: 'database',
  storageEndpointOverview: 'storage-endpoint-overview',
  storageEndpointConfig: 'storage-endpoint-config',
  storageEndpointSpaces: 'storage-endpoint-spaces',
  spaceOverview: 'space-overview',
  spaceMetadata: 'space-metadata',
  spaceObjects: 'space-objects',
} as const

const PAGE_ROUTE_PATH_BY_KEY: Record<string, string> = {
  [PAGE_KEY.metadata]: '/service/metadata',
  [PAGE_KEY.basicInfo]: '/service/basic-info',
  [PAGE_KEY.database]: '/service/database',
  [PAGE_KEY.storageEndpointOverview]: '/storage-endpoints',
  [PAGE_KEY.storageEndpointConfig]: '/storage-endpoints/endpoint',
  [PAGE_KEY.storageEndpointSpaces]: '/storage-endpoints/endpoint',
  [PAGE_KEY.spaceOverview]: '/storage-endpoints/endpoint',
  [PAGE_KEY.spaceMetadata]: '/storage-endpoints/endpoint',
  [PAGE_KEY.spaceObjects]: '/storage-endpoints/endpoint',
}

class AppStore {
  isBootstrapping = false
  isDbSchemaChecking = false
  isDbSchemaWarningVisible = false
  dbSchemaWarningText = ''
  globalMessageStatus: 'idle' | 'loading' | 'success' | 'error' = 'idle'
  globalMessageText = ''
  globalMessageScrollLeft = 0
  cacheByKey: Record<string, Record<string, unknown>> = {}
  currentPageKey: string = PAGE_KEY.metadata
  currentRoutePath: string = PAGE_ROUTE_PATH_BY_KEY[PAGE_KEY.metadata]

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get titleText() {
    return serviceStore.titleText
  }

  get subtitleText() {
    return serviceStore.subtitleText
  }

  get isPingLoading() {
    return serviceStore.isPingLoading
  }

  get isDbTestLoading() {
    return serviceStore.isDbTestLoading
  }

  get isDatabaseLoading() {
    return serviceStore.isDatabaseLoading
  }

  get isDatabaseSwitching() {
    return serviceStore.isDatabaseSwitching
  }

  get databaseItems() {
    return serviceStore.databaseItems
  }

  get currentDatabaseKey() {
    return serviceStore.currentDatabaseKey
  }

  get isSpacesLoading() {
    return spaceStore.isSpacesLoading
  }

  get isStorageEndpointsLoading() {
    return storageEndpointStore.isLoading
  }

  get storageEndpointItems() {
    return storageEndpointStore.items
  }

  get selectedStorageEndpointKey() {
    return storageEndpointStore.selectedOrDefaultKey
  }

  get defaultStorageEndpointKey() {
    return storageEndpointStore.defaultKey
  }

  get selectedStorageEndpointType() {
    return storageEndpointStore.selectedItem?.type || ''
  }

  get isSpaceCreating() {
    return spaceStore.isSpaceCreating
  }

  get isSpaceDeleting() {
    return spaceStore.isSpaceDeleting
  }

  get isSpaceClearing() {
    return spaceStore.isSpaceClearing
  }

  get spaces() {
    return spaceStore.spaces
  }

  get spaceItems() {
    return spaceStore.spaceItems
  }

  get spaceMetadataItems() {
    return spaceStore.spaceMetadataItems
  }

  get selectedSpaceId() {
    return spaceStore.selectedSpaceId
  }

  get errorText() {
    return storageEndpointStore.errorText || spaceStore.errorText || serviceStore.errorText
  }

  get projectInfo() {
    return [
      { key: 'service', value: 'storage-obj' },
      { key: 'frontend', value: 'vite + react + mobx' },
      { key: 'backend', value: 'flask + postgresql + aws s3' },
      { key: 'dirBase', value: 'serves build from DIR_BASE/build' },
      { key: 'requests', value: String(serviceStore.requestCount + spaceStore.requestCount) },
      { key: 'ping', value: serviceStore.pingText },
      { key: 'db', value: serviceStore.dbText },
      { key: 'spaceNum', value: String(spaceStore.spaces.length) },
      { key: 'cacheKeys', value: String(Object.keys(this.cacheByKey).length) },
      { key: 'database', value: serviceStore.currentDatabaseKey || '-' },
    ]
  }

  get isGlobalDbSchemaWarningVisible() {
    return this.isDbSchemaWarningVisible
  }

  get globalDbSchemaWarningText() {
    return this.dbSchemaWarningText
  }

  get globalMessageBarState() {
    if (this.isDbSchemaWarningVisible) {
      return {
        status: 'error',
        messageText: this.dbSchemaWarningText,
      }
    }
    return {
      status: this.globalMessageStatus,
      messageText: this.globalMessageText,
    }
  }

  setGlobalMessage(status: 'idle' | 'loading' | 'success' | 'error', messageText: string) {
    this.globalMessageStatus = status
    this.globalMessageText = messageText
  }

  dismissGlobalMessage() {
    this.globalMessageStatus = 'idle'
    this.globalMessageText = ''
  }

  setGlobalMessageScrollLeft(scrollLeft: number) {
    this.globalMessageScrollLeft = Math.max(0, scrollLeft)
  }

  clearCache() {
    this.cacheByKey = {}
  }

  setSelectedSpaceId(spaceId: string) {
    spaceStore.setSelectedSpaceId(spaceId)
  }

  get selectedSpaceItem() {
    return spaceStore.spaceItems.find((item) => item.spaceId === spaceStore.selectedSpaceId) || null
  }

  getRoutePathByPageKey(pageKey: string, params: { spaceId?: string; storageEndpointKey?: string } = {}) {
    const basePath = PAGE_ROUTE_PATH_BY_KEY[pageKey] || PAGE_ROUTE_PATH_BY_KEY[PAGE_KEY.metadata]
    const storageEndpointKey = String(params.storageEndpointKey || storageEndpointStore.selectedOrDefaultKey || '').trim()
    if (
      pageKey === PAGE_KEY.storageEndpointConfig
      || pageKey === PAGE_KEY.storageEndpointSpaces
      || pageKey === PAGE_KEY.spaceOverview
      || pageKey === PAGE_KEY.spaceMetadata
      || pageKey === PAGE_KEY.spaceObjects
    ) {
      const searchParams = new URLSearchParams()
      if (storageEndpointKey) {
        searchParams.set('storageEndpointKey', storageEndpointKey)
      }
      if (pageKey === PAGE_KEY.storageEndpointConfig) {
        searchParams.set('panel', 'config')
      } else if (pageKey === PAGE_KEY.storageEndpointSpaces || pageKey === PAGE_KEY.spaceOverview) {
        searchParams.set('panel', 'spaces')
      }
      if (pageKey === PAGE_KEY.spaceMetadata || pageKey === PAGE_KEY.spaceObjects) {
        const spaceId = String(params.spaceId || spaceStore.selectedSpaceId || '').trim()
        if (spaceId) {
          searchParams.set('spaceId', spaceId)
          searchParams.set('panel', pageKey === PAGE_KEY.spaceObjects ? 'objects' : 'metadata')
        }
      }
      const searchText = searchParams.toString()
      return searchText ? `${basePath}?${searchText}` : basePath
    }
    return basePath
  }

  getPageKeyByRoute(pathname: string, search: string) {
    if (pathname === '/storage-endpoints') {
      return PAGE_KEY.storageEndpointOverview
    }
    if (pathname === '/storage-endpoints/endpoint') {
      const searchParams = new URLSearchParams(search || '')
      const storageEndpointKey = String(searchParams.get('storageEndpointKey') || '').trim()
      if (storageEndpointKey) {
        storageEndpointStore.setSelectedKey(storageEndpointKey)
      }
      const spaceId = String(searchParams.get('spaceId') || '').trim()
      if (spaceId) {
        spaceStore.setSelectedSpaceId(spaceId)
        const panelName = String(searchParams.get('panel') || 'metadata').trim()
        if (panelName === 'objects') {
          return PAGE_KEY.spaceObjects
        }
        return PAGE_KEY.spaceMetadata
      }
      spaceStore.setSelectedSpaceId('')
      const panelName = String(searchParams.get('panel') || 'config').trim()
      return panelName === 'spaces' ? PAGE_KEY.storageEndpointSpaces : PAGE_KEY.storageEndpointConfig
    }
    const entry = Object.entries(PAGE_ROUTE_PATH_BY_KEY).find(([key, path]) => {
      if (
        key === PAGE_KEY.storageEndpointOverview
        || key === PAGE_KEY.storageEndpointConfig
        || key === PAGE_KEY.storageEndpointSpaces
        || key === PAGE_KEY.spaceOverview
        || key === PAGE_KEY.spaceMetadata
        || key === PAGE_KEY.spaceObjects
      ) {
        return false
      }
      return path === pathname
    })
    return (entry?.[0] as string) || PAGE_KEY.metadata
  }

  setCurrentPageKey(pageKey: string, params: { spaceId?: string; storageEndpointKey?: string } = {}) {
    const safePageKey = PAGE_ROUTE_PATH_BY_KEY[pageKey] ? pageKey : PAGE_KEY.metadata
    if (params.storageEndpointKey) {
      storageEndpointStore.setSelectedKey(params.storageEndpointKey)
    }
    if (safePageKey === PAGE_KEY.spaceOverview || safePageKey === PAGE_KEY.storageEndpointSpaces) {
      spaceStore.setSelectedSpaceId('')
    }
    if ((safePageKey === PAGE_KEY.spaceMetadata || safePageKey === PAGE_KEY.spaceObjects) && params.spaceId) {
      spaceStore.setSelectedSpaceId(String(params.spaceId))
    }
    this.currentPageKey = safePageKey
    this.currentRoutePath = this.getRoutePathByPageKey(safePageKey, params)
  }

  setCurrentRoutePath(pathname: string, search: string) {
    const previousStorageEndpointKey = storageEndpointStore.selectedOrDefaultKey
    const pageKey = this.getPageKeyByRoute(pathname, search)
    if (
      previousStorageEndpointKey
      && previousStorageEndpointKey !== storageEndpointStore.selectedOrDefaultKey
      && storageEndpointStore.items.length > 0
    ) {
      this.clearCache()
      spaceStore.clearSpaceData()
      objectStore.clearAllState()
      void this.requestLoadSpaces()
    }
    this.currentRoutePath = this.getRoutePathByPageKey(pageKey)
    this.currentPageKey = pageKey
  }

  get selectedTreeItemId() {
    if (this.currentPageKey === PAGE_KEY.metadata) {
      return 'service:metadata'
    }
    if (this.currentPageKey === PAGE_KEY.basicInfo) {
      return 'service:basic-info'
    }
    if (this.currentPageKey === PAGE_KEY.database) {
      return 'service:database'
    }
    if (this.currentPageKey === PAGE_KEY.storageEndpointOverview) {
      return 'storage-endpoints:overview'
    }
    const endpointKey = storageEndpointStore.selectedOrDefaultKey
    if (this.currentPageKey === PAGE_KEY.storageEndpointConfig) {
      return endpointKey ? `storage-endpoint:${endpointKey}:config` : 'storage-endpoints'
    }
    if (this.currentPageKey === PAGE_KEY.storageEndpointSpaces || this.currentPageKey === PAGE_KEY.spaceOverview) {
      return endpointKey ? `storage-endpoint:${endpointKey}:spaces` : 'storage-endpoints'
    }
    if (this.currentPageKey === PAGE_KEY.spaceMetadata) {
      return spaceStore.selectedSpaceId && endpointKey
        ? `storage-endpoint:${endpointKey}:space:${spaceStore.selectedSpaceId}:metadata`
        : 'storage-endpoints'
    }
    if (this.currentPageKey === PAGE_KEY.spaceObjects) {
      return spaceStore.selectedSpaceId && endpointKey
        ? `storage-endpoint:${endpointKey}:space:${spaceStore.selectedSpaceId}:objects`
        : 'storage-endpoints'
    }
    return 'service'
  }

  async requestPing() {
    return serviceStore.requestPing()
  }

  async requestDbTest() {
    return serviceStore.requestDbTest()
  }

  async requestDbTestByDatabaseKey(databaseKey: string, timeoutMs = 5000) {
    return serviceStore.requestDbTestByDatabaseKey(databaseKey, timeoutMs)
  }

  async requestS3AccessTest(timeoutMs = 10000) {
    return serviceStore.requestS3AccessTest(timeoutMs)
  }

  async requestLoadDatabases() {
    return serviceStore.requestLoadDatabases()
  }

  async requestLoadStorageEndpoints() {
    return storageEndpointStore.requestLoad()
  }

  async selectStorageEndpoint(storageEndpointKey: string) {
    const normalizedKey = String(storageEndpointKey || '').trim()
    if (!normalizedKey || normalizedKey === storageEndpointStore.selectedOrDefaultKey) {
      return
    }
    storageEndpointStore.setSelectedKey(normalizedKey)
    this.clearCache()
    spaceStore.clearSpaceData()
    objectStore.clearAllState()
    await this.requestLoadSpaces()
    await this.refreshDatabaseSchemaWarning()
  }

  async requestSetDefaultStorageEndpoint(storageEndpointKey: string) {
    const result = await storageEndpointStore.requestSetDefault(storageEndpointKey)
    if (!result?.isSuccess) {
      return result
    }
    this.clearCache()
    spaceStore.clearSpaceData()
    objectStore.clearAllState()
    await this.requestLoadSpaces()
    await this.refreshDatabaseSchemaWarning()
    return result
  }

  async requestLoadSpaces() {
    return spaceStore.requestLoadSpaces()
  }

  async requestCreateSpace() {
    const result = await spaceStore.requestCreateSpace()
    if (result?.isSuccess && spaceStore.selectedSpaceId) {
      this.setCurrentPageKey(PAGE_KEY.spaceMetadata, { spaceId: spaceStore.selectedSpaceId })
    }
    return result
  }

  async requestDeleteSpace(spaceId: string) {
    const result = await spaceStore.requestDeleteSpace(spaceId)
    if (result?.isSuccess) {
      if (!spaceStore.selectedSpaceId) {
        this.setCurrentPageKey(PAGE_KEY.spaceOverview)
      } else {
        this.setCurrentPageKey(PAGE_KEY.spaceMetadata, { spaceId: spaceStore.selectedSpaceId })
      }
    }
    return result
  }

  async requestClearSpace(spaceId: string) {
    const result = await spaceStore.requestClearSpace(spaceId)
    if (result?.isSuccess) {
      objectStore.clearAllState()
      await this.requestLoadSpaceMetadata(spaceId)
    }
    return result
  }

  async requestLoadSpaceMetadata(spaceId: string) {
    return spaceStore.requestLoadSpaceMetadata(spaceId)
  }

  async requestUpsertSpaceMetadata(spaceId: string, item: { tag: string; rank?: string; valueText?: string }) {
    return spaceStore.requestUpsertSpaceMetadata(spaceId, item)
  }

  async requestRenameSpaceMetadata(spaceId: string, fromTag: string, toTag: string, rank = '', valueText = '') {
    return spaceStore.requestRenameSpaceMetadata(spaceId, fromTag, toTag, rank, valueText)
  }

  async requestInsertSpaceMetadata(spaceId: string, position: 'above' | 'below' | 'tail', targetTag = '') {
    return spaceStore.requestInsertSpaceMetadata(spaceId, position, targetTag)
  }

  async requestDeleteSpaceMetadata(spaceId: string, tag: string) {
    return spaceStore.requestDeleteSpaceMetadata(spaceId, tag)
  }

  async requestMoveSpaceMetadata(spaceId: string, tag: string, direction: 'up' | 'down') {
    return spaceStore.requestMoveSpaceMetadata(spaceId, tag, direction)
  }

  async reloadAfterDatabaseSwitch() {
    this.clearCache()
    spaceStore.clearSpaceData()
    serviceStore.clearServiceData()
    await Promise.all([
      this.requestPing(),
      this.requestDbTest(),
    ])
    await this.requestLoadSpaces()
    if (this.currentPageKey === PAGE_KEY.spaceMetadata || this.currentPageKey === PAGE_KEY.spaceObjects) {
      if (!spaceStore.selectedSpaceId) {
        this.setCurrentPageKey(PAGE_KEY.spaceOverview)
      } else {
        await this.requestLoadSpaceMetadata(spaceStore.selectedSpaceId)
      }
    }
    await this.refreshDatabaseSchemaWarning()
  }

  async requestSwitchDatabase(databaseKey: string) {
    const switchResult = await serviceStore.requestSwitchDatabase(databaseKey)
    if (!switchResult?.isSuccess) {
      return switchResult
    }
    await this.reloadAfterDatabaseSwitch()
    return switchResult
  }

  async requestReinitDatabase(isIncludeExampleData: boolean) {
    const result = await serviceStore.requestReinitDatabase(isIncludeExampleData)
    if (!result?.isSuccess && !result?.isPartialSuccess) {
      return result
    }
    this.clearCache()
    spaceStore.clearSpaceData()
    serviceStore.clearServiceData()
    objectStore.clearAllState()
    await this.requestLoadDatabases()
    await this.requestPing()
    await this.requestDbTest()
    await this.requestLoadSpaces()
    await this.refreshDatabaseSchemaWarning()
    return result
  }

  async requestCheckDatabaseSchema() {
    return serviceStore.requestCheckDatabaseSchema()
  }

  async refreshDatabaseSchemaWarning() {
    if (this.selectedStorageEndpointType !== 'postgres') {
      this.isDbSchemaWarningVisible = false
      this.dbSchemaWarningText = ''
      return {
        isSuccess: true,
        messageText: 'database schema check not applicable',
      }
    }
    this.isDbSchemaChecking = true
    try {
      const result = await this.requestCheckDatabaseSchema()
      if (result?.isSuccess) {
        this.isDbSchemaWarningVisible = false
        this.dbSchemaWarningText = ''
        return result
      }
      this.isDbSchemaWarningVisible = true
      this.dbSchemaWarningText = result?.messageText || 'database schema check failed'
      return result
    } finally {
      this.isDbSchemaChecking = false
    }
  }

  async requestBootstrap() {
    if (this.isBootstrapping) {
      return
    }
    this.isBootstrapping = true
    try {
      await this.requestLoadStorageEndpoints()
      await this.requestLoadDatabases()
      await this.requestPing()
      await this.requestDbTest()
      await this.requestLoadSpaces()
      await this.refreshDatabaseSchemaWarning()
    } finally {
      this.isBootstrapping = false
    }
  }
}

export const appStore = new AppStore()
