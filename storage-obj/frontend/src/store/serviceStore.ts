import { makeAutoObservable, runInAction } from 'mobx'

type JsonValue = Record<string, unknown>

type ApiResponse<T = JsonValue> = {
  code: number
  data?: T
  message?: string
}

export type DatabaseItem = {
  key: string
  label: string
  host: string
  port: number
  databaseName: string
  username: string
}

export class ServiceStore {
  titleText = 'obj-storage'
  subtitleText = 'MobX-driven UI with cache and backend relay'

  isPingLoading = false
  isDbTestLoading = false
  isDatabaseLoading = false
  isDatabaseSwitching = false

  pingText = 'idle'
  dbText = 'idle'
  errorText = ''

  databaseItems: DatabaseItem[] = []
  currentDatabaseKey = ''
  requestCount = 0

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  clearError() {
    this.errorText = ''
  }

  clearServiceData() {
    this.pingText = 'idle'
    this.dbText = 'idle'
    this.errorText = ''
  }

  async requestJson(url: string, options: RequestInit = {}) {
    this.clearError()
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

  async requestPing() {
    if (this.isPingLoading) {
      return
    }
    runInAction(() => {
      this.isPingLoading = true
    })
    try {
      const data = await this.requestJson('/api/health/ping')
      runInAction(() => {
        this.pingText = JSON.stringify(data)
      })
      return {
        isSuccess: true,
        messageText: JSON.stringify(data),
      }
    } catch (error: unknown) {
      runInAction(() => {
        this.errorText = String(error)
        this.pingText = 'error'
      })
      return {
        isSuccess: false,
        messageText: String(error),
      }
    } finally {
      runInAction(() => {
        this.isPingLoading = false
      })
    }
  }

  async requestDbTest() {
    if (this.isDbTestLoading) {
      return
    }
    runInAction(() => {
      this.isDbTestLoading = true
    })
    try {
      const data = await this.requestJson('/api/health/test')
      runInAction(() => {
        this.dbText = JSON.stringify(data)
      })
      return {
        isSuccess: true,
        messageText: JSON.stringify(data),
      }
    } catch (error: unknown) {
      runInAction(() => {
        this.errorText = String(error)
        this.dbText = 'error'
      })
      return {
        isSuccess: false,
        messageText: String(error),
      }
    } finally {
      runInAction(() => {
        this.isDbTestLoading = false
      })
    }
  }

  async requestDbTestByDatabaseKey(databaseKey: string, timeoutMs = 5000) {
    const normalizedDatabaseKey = String(databaseKey || '').trim()
    if (!normalizedDatabaseKey) {
      return {
        isSuccess: false,
        messageText: 'database key required',
      }
    }
    const normalizedTimeoutMs = Number.isFinite(timeoutMs)
      ? Math.max(1000, Math.min(30000, Math.floor(timeoutMs)))
      : 5000
    const abortController = new AbortController()
    const timeoutHandle = window.setTimeout(() => {
      abortController.abort()
    }, normalizedTimeoutMs)
    try {
      const data = await this.requestJson('/api/config/database/test', {
        method: 'POST',
        body: JSON.stringify({
          databaseKey: normalizedDatabaseKey,
          timeoutSeconds: Math.max(1, Math.floor(normalizedTimeoutMs / 1000)),
        }),
        signal: abortController.signal,
      })
      return {
        isSuccess: true,
        messageText: String(data.database || 'ok'),
      }
    } catch (error: unknown) {
      const isTimeoutError = error instanceof DOMException && error.name === 'AbortError'
      return {
        isSuccess: false,
        messageText: isTimeoutError ? `database test timeout (${normalizedTimeoutMs}ms)` : String(error),
      }
    } finally {
      window.clearTimeout(timeoutHandle)
    }
  }

  async requestLoadDatabases() {
    if (this.isDatabaseLoading) {
      return { isSuccess: false, messageText: 'database list is loading' }
    }
    runInAction(() => {
      this.isDatabaseLoading = true
    })
    try {
      const data = await this.requestJson('/api/config/database/list')
      const databaseItems = Array.isArray(data.items)
        ? data.items.map((item) => ({
          key: String(item.key || ''),
          label: String(item.label || item.key || ''),
          host: String(item.host || ''),
          port: Number(item.port || 0),
          databaseName: String(item.databaseName || ''),
          username: String(item.username || ''),
        }))
        : []
      runInAction(() => {
        this.databaseItems = databaseItems
        this.currentDatabaseKey = String(data.currentKey || databaseItems[0]?.key || '')
      })
      return { isSuccess: true, messageText: 'database list loaded' }
    } catch (error: unknown) {
      runInAction(() => {
        this.errorText = String(error)
      })
      return { isSuccess: false, messageText: String(error) }
    } finally {
      runInAction(() => {
        this.isDatabaseLoading = false
      })
    }
  }

  async requestSwitchDatabase(databaseKey: string) {
    const normalizedDatabaseKey = String(databaseKey || '').trim()
    if (!normalizedDatabaseKey) {
      return { isSuccess: false, messageText: 'database key required' }
    }
    if (this.currentDatabaseKey === normalizedDatabaseKey) {
      return { isSuccess: true, messageText: 'database already selected' }
    }
    if (this.isDatabaseSwitching) {
      return { isSuccess: false, messageText: 'database switching in progress' }
    }
    runInAction(() => {
      this.isDatabaseSwitching = true
    })
    try {
      const data = await this.requestJson('/api/config/database/switch', {
        method: 'POST',
        body: JSON.stringify({
          databaseKey: normalizedDatabaseKey,
        }),
      })
      const databaseItems = Array.isArray(data.items)
        ? data.items.map((item) => ({
          key: String(item.key || ''),
          label: String(item.label || item.key || ''),
          host: String(item.host || ''),
          port: Number(item.port || 0),
          databaseName: String(item.databaseName || ''),
          username: String(item.username || ''),
        }))
        : this.databaseItems
      runInAction(() => {
        this.databaseItems = databaseItems
        this.currentDatabaseKey = String(data.currentKey || normalizedDatabaseKey)
      })
      return {
        isSuccess: true,
        messageText: String(data.messageText || `database switched: ${normalizedDatabaseKey}`),
      }
    } catch (error: unknown) {
      runInAction(() => {
        this.errorText = String(error)
      })
      return { isSuccess: false, messageText: String(error) }
    } finally {
      runInAction(() => {
        this.isDatabaseSwitching = false
      })
    }
  }

  async requestReinitDatabase(isIncludeExampleData: boolean) {
    this.clearError()
    try {
      const response = await fetch('/api/config/database/reinit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isIncludeExampleData: isIncludeExampleData === true,
        }),
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
      const data = body.data || {}
      const messageText = String(data.messageText || body.message || '')
      return {
        isSuccess: body.code === 0,
        isPartialSuccess: body.code === 1,
        messageText,
        isInitDbSuccess: data.isInitDbSuccess === true,
        isInitExampleDataSuccess: data.isInitExampleDataSuccess === true,
      }
    } catch (error: unknown) {
      runInAction(() => {
        this.errorText = String(error)
      })
      return {
        isSuccess: false,
        isPartialSuccess: false,
        messageText: String(error),
        isInitDbSuccess: false,
        isInitExampleDataSuccess: false,
      }
    }
  }

  async requestCheckDatabaseSchema() {
    this.clearError()
    try {
      const data = await this.requestJson('/api/config/database/check', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const failedTableCheckItems = Array.isArray(data.failedTableCheckItems) ? data.failedTableCheckItems : []
      const issueTextList = Array.isArray(data.issueTextList)
        ? data.issueTextList.map((item) => String(item || '').trim()).filter((item) => item)
        : failedTableCheckItems.map((item) => {
          const tableName = String(item?.tableName || '')
          const isTableFound = item?.isTableFound === true
          const missingColumnNames = Array.isArray(item?.missingColumnNames) ? item.missingColumnNames : []
          if (!isTableFound) {
            return `${tableName}: table not found`
          }
          if (missingColumnNames.length > 0) {
            return `${tableName}: missing columns [${missingColumnNames.join(', ')}]`
          }
          return `${tableName}: unknown issue`
        })
      const fallbackMessageText = issueTextList.length > 0
        ? `database schema check failed: ${issueTextList.join(' | ')}`
        : 'database schema check failed'
      return {
        isSuccess: data.isSchemaOk === true,
        messageText: data.isSchemaOk === true ? String(data.messageText || 'database schema ok') : String(data.messageText || fallbackMessageText),
        failedTableCheckItems,
        issueTextList,
      }
    } catch (error: unknown) {
      runInAction(() => {
        this.errorText = String(error)
      })
      return {
        isSuccess: false,
        messageText: String(error),
        failedTableCheckItems: [],
        issueTextList: [],
      }
    }
  }
}

export const serviceStore = new ServiceStore()
