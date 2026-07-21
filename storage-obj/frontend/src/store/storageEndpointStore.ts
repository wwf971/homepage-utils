import { makeAutoObservable, runInAction } from 'mobx'

type JsonValue = Record<string, unknown>

type ApiResponse<T = JsonValue> = {
  code: number
  data?: T
  message?: string
}

export type StorageEndpointItem = {
  key: string
  label: string
  type: string
  isDefault: boolean
  host?: string
  port?: number
  databaseName?: string
  username?: string
  bucketName?: string
  regionName?: string
  pathPrefix?: string
}

function normalizeItem(item: JsonValue): StorageEndpointItem {
  const type = String(item.type || '')
  return {
    key: String(item.key || ''),
    label: String(item.label || item.key || ''),
    type,
    isDefault: item.isDefault === true,
    ...(type === 'postgres'
      ? {
          host: String(item.host || ''),
          port: Number(item.port || 0),
          databaseName: String(item.databaseName || ''),
          username: String(item.username || ''),
        }
      : {}),
    ...(type === 's3_aws'
      ? {
          bucketName: String(item.bucketName || ''),
          regionName: String(item.regionName || ''),
          pathPrefix: String(item.pathPrefix || ''),
        }
      : {}),
  }
}

class StorageEndpointStore {
  items: StorageEndpointItem[] = []
  defaultKey = ''
  selectedKey = ''
  isLoading = false
  isTesting = false
  isSettingDefault = false
  errorText = ''
  requestCount = 0

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get selectedOrDefaultKey() {
    return this.selectedKey || this.defaultKey
  }

  get selectedItem() {
    return this.items.find((item) => item.key === this.selectedOrDefaultKey) || null
  }

  setSelectedKey(storageEndpointKey: string) {
    const normalizedKey = String(storageEndpointKey || '').trim()
    if (normalizedKey) {
      this.selectedKey = normalizedKey
    }
  }

  applyListData(data: JsonValue) {
    const items = Array.isArray(data.items)
      ? data.items.map((item) => normalizeItem(item as JsonValue)).filter((item) => item.key)
      : []
    const defaultKey = String(data.defaultKey || items.find((item) => item.isDefault)?.key || '')
    this.items = items.map((item) => ({
      ...item,
      isDefault: item.key === defaultKey,
    }))
    this.defaultKey = defaultKey
    if (!items.some((item) => item.key === this.selectedKey)) {
      this.selectedKey = defaultKey || items[0]?.key || ''
    }
  }

  async requestJson(url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    })
    const responseText = await response.text()
    let body: ApiResponse<JsonValue>
    try {
      body = JSON.parse(responseText) as ApiResponse<JsonValue>
    } catch (error: unknown) {
      const previewText = responseText.slice(0, 120).replace(/\s+/g, ' ')
      throw new Error(`backend response is not JSON (status ${response.status}): ${previewText}`, {
        cause: error,
      })
    }
    if (!response.ok || body.code < 0) {
      throw new Error(body.message || `request failed: ${response.status}`)
    }
    runInAction(() => {
      this.requestCount += 1
    })
    return body.data || {}
  }

  async requestLoad() {
    if (this.isLoading) {
      return { isSuccess: false, messageText: 'storage endpoint list is loading' }
    }
    runInAction(() => {
      this.isLoading = true
      this.errorText = ''
    })
    try {
      const data = await this.requestJson('/api/config/storage-endpoint/list')
      runInAction(() => {
        this.applyListData(data)
      })
      return { isSuccess: true, messageText: 'storage endpoints loaded' }
    } catch (error: unknown) {
      runInAction(() => {
        this.errorText = String(error)
      })
      return { isSuccess: false, messageText: String(error) }
    } finally {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }

  async requestTest(storageEndpointKey: string, timeoutSeconds = 10) {
    const normalizedKey = String(storageEndpointKey || '').trim()
    if (!normalizedKey) {
      return { isSuccess: false, messageText: 'storage endpoint key required' }
    }
    if (this.isTesting) {
      return { isSuccess: false, messageText: 'storage endpoint test is running' }
    }
    runInAction(() => {
      this.isTesting = true
    })
    try {
      await this.requestJson('/api/config/storage-endpoint/test', {
        method: 'POST',
        body: JSON.stringify({
          storageEndpointKey: normalizedKey,
          timeoutSeconds: Math.max(1, Math.min(30, Math.floor(timeoutSeconds))),
        }),
      })
      return { isSuccess: true, messageText: `storage endpoint test passed: ${normalizedKey}` }
    } catch (error: unknown) {
      return { isSuccess: false, messageText: String(error) }
    } finally {
      runInAction(() => {
        this.isTesting = false
      })
    }
  }

  async requestSetDefault(storageEndpointKey: string) {
    const normalizedKey = String(storageEndpointKey || '').trim()
    if (!normalizedKey) {
      return { isSuccess: false, messageText: 'storage endpoint key required' }
    }
    if (this.isSettingDefault) {
      return { isSuccess: false, messageText: 'default endpoint is changing' }
    }
    runInAction(() => {
      this.isSettingDefault = true
    })
    try {
      const data = await this.requestJson('/api/config/storage-endpoint/default/set', {
        method: 'POST',
        body: JSON.stringify({
          storageEndpointKey: normalizedKey,
        }),
      })
      runInAction(() => {
        this.applyListData(data)
        this.selectedKey = normalizedKey
      })
      return { isSuccess: true, messageText: `default endpoint set: ${normalizedKey}` }
    } catch (error: unknown) {
      return { isSuccess: false, messageText: String(error) }
    } finally {
      runInAction(() => {
        this.isSettingDefault = false
      })
    }
  }
}

export function getStorageEndpointKey() {
  return storageEndpointStore.selectedOrDefaultKey
}

export function withStorageEndpointBody(body: Record<string, unknown> = {}) {
  const storageEndpointKey = getStorageEndpointKey()
  return storageEndpointKey ? { ...body, storageEndpointKey } : body
}

export function withStorageEndpointSearchParams(searchParams = new URLSearchParams()) {
  const storageEndpointKey = getStorageEndpointKey()
  if (storageEndpointKey) {
    searchParams.set('storageEndpointKey', storageEndpointKey)
  }
  return searchParams
}

export const storageEndpointStore = new StorageEndpointStore()
