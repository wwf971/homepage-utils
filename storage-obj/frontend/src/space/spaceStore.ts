import { makeAutoObservable, runInAction } from 'mobx'

type JsonValue = Record<string, unknown>

type ApiResponse<T = JsonValue> = {
  code: number
  data?: T
  message?: string
}

export type SpaceItem = {
  spaceId: string
  name: string
  displayName: string
}

export type SpaceMetadataItem = {
  tag: string
  rank?: string
  valueType?: number
  valueText?: string
  valueJson?: unknown
  valueBytes?: string
  valueInt?: number
  valueBoolean?: boolean
}

export class SpaceStore {
  isSpacesLoading = false
  isSpaceCreating = false
  isSpaceDeleting = false
  isSpaceClearing = false

  errorText = ''
  spaces: string[] = []
  spaceItems: SpaceItem[] = []
  spaceMetadataItems: SpaceMetadataItem[] = []
  selectedSpaceId = ''
  requestCount = 0

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  clearError() {
    this.errorText = ''
  }

  clearSpaceData() {
    this.spaces = []
    this.spaceItems = []
    this.spaceMetadataItems = []
    this.selectedSpaceId = ''
    this.errorText = ''
  }

  setSelectedSpaceId(spaceId: string) {
    this.selectedSpaceId = spaceId
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

  async requestLoadSpaces() {
    if (this.isSpacesLoading) {
      return
    }
    runInAction(() => {
      this.isSpacesLoading = true
    })
    try {
      const data = await this.requestJson('/api/space/list')
      const spaces = Array.isArray(data.spaces) ? data.spaces.map((item) => String(item)) : []
      const spaceItems = Array.isArray(data.spaceItems)
        ? data.spaceItems.map((item) => ({
          spaceId: String(item.spaceId || ''),
          name: String(item.name || ''),
          displayName: String(item.displayName || item.spaceId || ''),
        }))
        : spaces.map((spaceId) => ({
          spaceId,
          name: '',
          displayName: `ANONY ${spaceId}`,
        }))
      runInAction(() => {
        this.spaces = spaces
        this.spaceItems = spaceItems
        if (this.selectedSpaceId && spaces.includes(this.selectedSpaceId)) {
          return
        }
        this.selectedSpaceId = spaces[0] || ''
      })
      return { isSuccess: true, messageText: 'spaces loaded' }
    } catch (error: unknown) {
      runInAction(() => {
        this.errorText = String(error)
      })
      return { isSuccess: false, messageText: String(error) }
    } finally {
      runInAction(() => {
        this.isSpacesLoading = false
      })
    }
  }

  async requestCreateSpace() {
    if (this.isSpaceCreating) {
      return
    }
    runInAction(() => {
      this.isSpaceCreating = true
    })
    try {
      const data = await this.requestJson('/api/space/create', { method: 'POST', body: JSON.stringify({}) })
      const spaces = Array.isArray(data.spaces) ? data.spaces.map((item) => String(item)) : []
      const spaceId = String(data.spaceId || '')
      runInAction(() => {
        this.spaces = spaces
        this.selectedSpaceId = spaceId
        this.spaceItems = spaces.map((spaceItemId) => {
          if (spaceItemId === spaceId) {
            return {
              spaceId: spaceItemId,
              name: '',
              displayName: `ANONY ${spaceItemId}`,
            }
          }
          const existing = this.spaceItems.find((item) => item.spaceId === spaceItemId)
          return existing || {
            spaceId: spaceItemId,
            name: '',
            displayName: `ANONY ${spaceItemId}`,
          }
        })
      })
      return {
        isSuccess: true,
        messageText: `space created: ${spaceId}`,
      }
    } catch (error: unknown) {
      runInAction(() => {
        this.errorText = String(error)
      })
      return {
        isSuccess: false,
        messageText: String(error),
      }
    } finally {
      runInAction(() => {
        this.isSpaceCreating = false
      })
    }
  }

  async requestDeleteSpace(spaceId: string) {
    if (this.isSpaceDeleting || !spaceId) {
      return { isSuccess: false, messageText: 'invalid space id' }
    }
    runInAction(() => {
      this.isSpaceDeleting = true
    })
    try {
      const data = await this.requestJson('/api/space/delete', { method: 'POST', body: JSON.stringify({ spaceId }) })
      const spaces = Array.isArray(data.spaces) ? data.spaces.map((item) => String(item)) : []
      runInAction(() => {
        this.spaces = spaces
        this.spaceItems = this.spaceItems.filter((item) => spaces.includes(item.spaceId))
        if (!spaces.includes(this.selectedSpaceId)) {
          this.selectedSpaceId = spaces[0] || ''
        }
      })
      return {
        isSuccess: true,
        messageText: `space deleted: ${spaceId}`,
      }
    } catch (error: unknown) {
      runInAction(() => {
        this.errorText = String(error)
      })
      return {
        isSuccess: false,
        messageText: String(error),
      }
    } finally {
      runInAction(() => {
        this.isSpaceDeleting = false
      })
    }
  }

  async requestClearSpace(spaceId: string) {
    const normalizedSpaceId = String(spaceId || '').trim()
    if (this.isSpaceClearing || !normalizedSpaceId) {
      return { isSuccess: false, messageText: 'invalid space id' }
    }
    runInAction(() => {
      this.isSpaceClearing = true
    })
    try {
      const data = await this.requestJson('/api/space/clear', {
        method: 'POST',
        body: JSON.stringify({ spaceId: normalizedSpaceId }),
      })
      runInAction(() => {
        this.spaceMetadataItems = []
      })
      return {
        isSuccess: true,
        messageText: `space cleared: ${normalizedSpaceId}, deleted ${Number(data.deletedTotalNum || 0)} rows`,
      }
    } catch (error: unknown) {
      runInAction(() => {
        this.errorText = String(error)
      })
      return {
        isSuccess: false,
        messageText: String(error),
      }
    } finally {
      runInAction(() => {
        this.isSpaceClearing = false
      })
    }
  }

  async requestLoadSpaceMetadata(spaceId: string) {
    const normalizedSpaceId = String(spaceId || '').trim()
    if (!normalizedSpaceId) {
      runInAction(() => {
        this.spaceMetadataItems = []
      })
      return { isSuccess: true, messageText: 'space metadata cleared' }
    }
    try {
      const data = await this.requestJson(`/api/space/metadata/list?spaceId=${encodeURIComponent(normalizedSpaceId)}`)
      const items = Array.isArray(data.items)
        ? data.items.map((item) => ({
          tag: String(item.tag || ''),
          rank: String(item.rank || ''),
          valueType: typeof item.valueType === 'number' ? item.valueType : undefined,
          valueText: item.valueText === null || item.valueText === undefined ? '' : String(item.valueText),
          valueJson: item.valueJson,
          valueBytes: item.valueBytes === null || item.valueBytes === undefined ? '' : String(item.valueBytes),
          valueInt: typeof item.valueInt === 'number' ? item.valueInt : undefined,
          valueBoolean: typeof item.valueBoolean === 'boolean' ? item.valueBoolean : undefined,
        }))
        : []
      runInAction(() => {
        this.spaceMetadataItems = items
      })
      return { isSuccess: true, messageText: 'space metadata loaded' }
    } catch (error: unknown) {
      runInAction(() => {
        this.errorText = String(error)
      })
      return { isSuccess: false, messageText: String(error) }
    }
  }

  async requestUpsertSpaceMetadata(spaceId: string, item: SpaceMetadataItem) {
    const normalizedSpaceId = String(spaceId || '').trim()
    const tag = String(item.tag || '').trim()
    if (!normalizedSpaceId || !tag) {
      return { isSuccess: false, messageText: 'spaceId/tag required' }
    }
    try {
      const body = {
        spaceId: normalizedSpaceId,
        tag,
        rank: item.rank || '',
        valueType: 1,
        valueText: String(item.valueText || ''),
      }
      await this.requestJson('/api/space/metadata/upsert', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      await this.requestLoadSpaceMetadata(normalizedSpaceId)
      await this.requestLoadSpaces()
      return { isSuccess: true, messageText: `metadata upserted: ${tag}` }
    } catch (error: unknown) {
      runInAction(() => {
        this.errorText = String(error)
      })
      return { isSuccess: false, messageText: String(error) }
    }
  }

  async requestRenameSpaceMetadata(spaceId: string, fromTag: string, toTag: string, rank = '', valueText = '') {
    const normalizedSpaceId = String(spaceId || '').trim()
    const normalizedFromTag = String(fromTag || '').trim()
    const normalizedToTag = String(toTag || '').trim()
    if (!normalizedSpaceId || !normalizedFromTag || !normalizedToTag) {
      return { isSuccess: false, messageText: 'spaceId/fromTag/toTag required' }
    }
    if (normalizedFromTag === normalizedToTag) {
      return { isSuccess: true, messageText: 'noop' }
    }
    try {
      await this.requestJson('/api/space/metadata/upsert', {
        method: 'POST',
        body: JSON.stringify({
          spaceId: normalizedSpaceId,
          tag: normalizedToTag,
          rank: String(rank || ''),
          valueType: 1,
          valueText: String(valueText || ''),
        }),
      })
      await this.requestJson('/api/space/metadata/delete', {
        method: 'POST',
        body: JSON.stringify({
          spaceId: normalizedSpaceId,
          tag: normalizedFromTag,
        }),
      })
      await this.requestLoadSpaceMetadata(normalizedSpaceId)
      await this.requestLoadSpaces()
      return { isSuccess: true, messageText: `metadata renamed: ${normalizedFromTag} -> ${normalizedToTag}` }
    } catch (error: unknown) {
      runInAction(() => {
        this.errorText = String(error)
      })
      return { isSuccess: false, messageText: String(error) }
    }
  }

  buildUniqueMetadataTag(baseTag: string) {
    const normalizedBaseTag = String(baseTag || '').trim() || 'new_tag'
    const existingTagSet = new Set(this.spaceMetadataItems.map((item) => String(item.tag || '').trim()))
    if (!existingTagSet.has(normalizedBaseTag)) {
      return normalizedBaseTag
    }
    let counter = 2
    while (counter < 10000) {
      const candidate = `${normalizedBaseTag}_${counter}`
      if (!existingTagSet.has(candidate)) {
        return candidate
      }
      counter += 1
    }
    return `${normalizedBaseTag}_${Date.now()}`
  }

  async requestInsertSpaceMetadata(spaceId: string, position: 'above' | 'below' | 'tail', targetTag = '') {
    const normalizedSpaceId = String(spaceId || '').trim()
    if (!normalizedSpaceId) {
      return { isSuccess: false, messageText: 'spaceId required' }
    }
    const newTag = this.buildUniqueMetadataTag('new_tag')
    try {
      await this.requestJson('/api/space/metadata/insert', {
        method: 'POST',
        body: JSON.stringify({
          spaceId: normalizedSpaceId,
          tag: newTag,
          valueType: 1,
          valueText: '',
          position,
          targetTag: String(targetTag || '').trim(),
        }),
      })
      await this.requestLoadSpaceMetadata(normalizedSpaceId)
      return { isSuccess: true, messageText: `metadata inserted: ${newTag}`, tag: newTag }
    } catch (error: unknown) {
      runInAction(() => {
        this.errorText = String(error)
      })
      return { isSuccess: false, messageText: String(error), tag: '' }
    }
  }

  async requestDeleteSpaceMetadata(spaceId: string, tag: string) {
    const normalizedSpaceId = String(spaceId || '').trim()
    const normalizedTag = String(tag || '').trim()
    if (!normalizedSpaceId || !normalizedTag) {
      return { isSuccess: false, messageText: 'spaceId/tag required' }
    }
    try {
      await this.requestJson('/api/space/metadata/delete', {
        method: 'POST',
        body: JSON.stringify({
          spaceId: normalizedSpaceId,
          tag: normalizedTag,
        }),
      })
      await this.requestLoadSpaceMetadata(normalizedSpaceId)
      await this.requestLoadSpaces()
      return { isSuccess: true, messageText: `metadata deleted: ${normalizedTag}` }
    } catch (error: unknown) {
      runInAction(() => {
        this.errorText = String(error)
      })
      return { isSuccess: false, messageText: String(error) }
    }
  }

  async requestMoveSpaceMetadata(spaceId: string, tag: string, direction: 'up' | 'down') {
    const normalizedSpaceId = String(spaceId || '').trim()
    const normalizedTag = String(tag || '').trim()
    if (!normalizedSpaceId || !normalizedTag) {
      return { isSuccess: false, messageText: 'spaceId/tag required' }
    }
    try {
      await this.requestJson('/api/space/metadata/move', {
        method: 'POST',
        body: JSON.stringify({
          spaceId: normalizedSpaceId,
          tag: normalizedTag,
          direction,
        }),
      })
      await this.requestLoadSpaceMetadata(normalizedSpaceId)
      return { isSuccess: true, messageText: `metadata moved ${direction}: ${normalizedTag}` }
    } catch (error: unknown) {
      runInAction(() => {
        this.errorText = String(error)
      })
      return { isSuccess: false, messageText: String(error) }
    }
  }
}

export const spaceStore = new SpaceStore()
