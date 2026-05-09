import { makeAutoObservable, runInAction } from 'mobx'

export type ObjectPayloadType = 'text' | 'bytes' | 'json'

type JsonValue = Record<string, unknown>

type ApiResponse<T = JsonValue> = {
  code: number
  data?: T
  message?: string
}

export type ObjectRowItem = {
  objectId: string
  dataType: ObjectPayloadType
  type: number
  editType: number
  valuePreview: string
  valueText: string
  valueJson: unknown
  valueBase64: string
  createdAt: string
  updatedAt: string
}

type ObjectDataById = Record<string, ObjectRowItem>

type SpaceTypeState = {
  objectDataById: ObjectDataById
  rowIdsByPage: Record<number, string[]>
  selectedObjectIdList: string[]
  searchInputText: string
  activeSearchText: string
  pageIndex: number
  pageSize: number
  totalCount: number
  isListLoading: boolean
  isCreateOrEditSubmitting: boolean
  isDeleteSubmitting: boolean
  errorText: string
  isCardVisible: boolean
  cardMode: 'create' | 'edit'
  cardObjectId: string
}

type SpaceState = {
  currentPayloadType: ObjectPayloadType
  byPayloadType: Record<ObjectPayloadType, SpaceTypeState>
}

const DEFAULT_PAGE_SIZE = 20
const VALUE_PREVIEW_MAX_LEN = 160

function toValuePreview(dataType: ObjectPayloadType, itemRaw: Record<string, unknown>) {
  if (dataType === 'text') {
    return String(itemRaw.valueText ?? '').slice(0, VALUE_PREVIEW_MAX_LEN)
  }
  if (dataType === 'bytes') {
    const rawBase64 = String(itemRaw.valueBase64 ?? '')
    if (!rawBase64) {
      return ''
    }
    const shortBase64 = rawBase64.slice(0, 48)
    return rawBase64.length > 48 ? `${shortBase64}...` : shortBase64
  }
  try {
    const jsonText = JSON.stringify(itemRaw.valueJson ?? {})
    if (jsonText.length > VALUE_PREVIEW_MAX_LEN) {
      return `${jsonText.slice(0, VALUE_PREVIEW_MAX_LEN)}...`
    }
    return jsonText
  } catch (_error) {
    return '[invalid json]'
  }
}

function createSpaceTypeState(): SpaceTypeState {
  return {
    objectDataById: {},
    rowIdsByPage: {},
    selectedObjectIdList: [],
    searchInputText: '',
    activeSearchText: '',
    pageIndex: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalCount: 0,
    isListLoading: false,
    isCreateOrEditSubmitting: false,
    isDeleteSubmitting: false,
    errorText: '',
    isCardVisible: false,
    cardMode: 'create',
    cardObjectId: '',
  }
}

function createSpaceState(): SpaceState {
  return {
    currentPayloadType: 'text',
    byPayloadType: {
      text: createSpaceTypeState(),
      bytes: createSpaceTypeState(),
      json: createSpaceTypeState(),
    },
  }
}

class ObjectStore {
  stateBySpaceId: Record<string, SpaceState> = {}
  requestCount = 0

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  getSpaceState(spaceId: string) {
    const normalizedSpaceId = String(spaceId || '').trim()
    if (!normalizedSpaceId) {
      return null
    }
    if (!this.stateBySpaceId[normalizedSpaceId]) {
      this.stateBySpaceId[normalizedSpaceId] = createSpaceState()
    }
    return this.stateBySpaceId[normalizedSpaceId]
  }

  getSpaceTypeState(spaceId: string, dataType: ObjectPayloadType) {
    const spaceState = this.getSpaceState(spaceId)
    if (!spaceState) {
      return null
    }
    return spaceState.byPayloadType[dataType]
  }

  getCurrentPayloadType(spaceId: string): ObjectPayloadType {
    return this.getSpaceState(spaceId)?.currentPayloadType || 'text'
  }

  setCurrentPayloadType(spaceId: string, dataType: ObjectPayloadType) {
    const spaceState = this.getSpaceState(spaceId)
    if (!spaceState) {
      return
    }
    spaceState.currentPayloadType = dataType
  }

  setSearchInputText(spaceId: string, dataType: ObjectPayloadType, searchInputText: string) {
    const typeState = this.getSpaceTypeState(spaceId, dataType)
    if (!typeState) {
      return
    }
    typeState.searchInputText = String(searchInputText || '')
  }

  applySearchText(spaceId: string, dataType: ObjectPayloadType) {
    const typeState = this.getSpaceTypeState(spaceId, dataType)
    if (!typeState) {
      return
    }
    typeState.activeSearchText = String(typeState.searchInputText || '').trim()
    typeState.pageIndex = 1
    typeState.rowIdsByPage = {}
  }

  clearSearchText(spaceId: string, dataType: ObjectPayloadType) {
    const typeState = this.getSpaceTypeState(spaceId, dataType)
    if (!typeState) {
      return
    }
    typeState.searchInputText = ''
    typeState.activeSearchText = ''
    typeState.pageIndex = 1
    typeState.rowIdsByPage = {}
  }

  setSelectedObjectIdList(spaceId: string, dataType: ObjectPayloadType, selectedObjectIdList: string[]) {
    const typeState = this.getSpaceTypeState(spaceId, dataType)
    if (!typeState) {
      return
    }
    typeState.selectedObjectIdList = selectedObjectIdList.map((item) => String(item || '')).filter(Boolean)
  }

  setPageSize(spaceId: string, dataType: ObjectPayloadType, pageSize: number) {
    const typeState = this.getSpaceTypeState(spaceId, dataType)
    if (!typeState) {
      return
    }
    const normalizedPageSize = Number.isFinite(pageSize)
      ? Math.max(5, Math.min(200, Math.floor(pageSize)))
      : DEFAULT_PAGE_SIZE
    typeState.pageSize = normalizedPageSize
    typeState.pageIndex = 1
    typeState.rowIdsByPage = {}
  }

  setPageIndex(spaceId: string, dataType: ObjectPayloadType, pageIndex: number) {
    const typeState = this.getSpaceTypeState(spaceId, dataType)
    if (!typeState) {
      return
    }
    const normalizedPageIndex = Number.isFinite(pageIndex)
      ? Math.max(1, Math.floor(pageIndex))
      : 1
    typeState.pageIndex = normalizedPageIndex
  }

  getCurrentPageRows(spaceId: string, dataType: ObjectPayloadType) {
    const typeState = this.getSpaceTypeState(spaceId, dataType)
    if (!typeState) {
      return []
    }
    const rowIdList = typeState.rowIdsByPage[typeState.pageIndex] || []
    return rowIdList.map((rowId) => typeState.objectDataById[rowId]).filter(Boolean)
  }

  getTotalPageCount(spaceId: string, dataType: ObjectPayloadType) {
    const typeState = this.getSpaceTypeState(spaceId, dataType)
    if (!typeState) {
      return 1
    }
    return Math.max(1, Math.ceil(typeState.totalCount / typeState.pageSize))
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

  async listObjects(spaceId: string, dataType: ObjectPayloadType, options: { forceReload?: boolean } = {}) {
    const normalizedSpaceId = String(spaceId || '').trim()
    const typeState = this.getSpaceTypeState(normalizedSpaceId, dataType)
    if (!normalizedSpaceId || !typeState) {
      return { isSuccess: false, messageText: 'invalid space id' }
    }
    const { pageIndex, pageSize, activeSearchText } = typeState
    const cacheHit = Boolean(typeState.rowIdsByPage[pageIndex]) && !options.forceReload
    if (cacheHit) {
      return { isSuccess: true, messageText: 'cache hit' }
    }
    runInAction(() => {
      typeState.isListLoading = true
      typeState.errorText = ''
    })
    try {
      const searchParams = new URLSearchParams()
      searchParams.set('spaceId', normalizedSpaceId)
      searchParams.set('dataType', dataType)
      searchParams.set('pageIndex', String(pageIndex))
      searchParams.set('pageSize', String(pageSize))
      if (activeSearchText.trim()) {
        searchParams.set('searchText', activeSearchText.trim())
      }
      const data = await this.requestJson(`/api/object/list?${searchParams.toString()}`)
      const itemList = Array.isArray(data.items) ? data.items : []
      const rowIdList: string[] = []
      const nextObjectDataById = { ...typeState.objectDataById }
      itemList.forEach((itemRaw) => {
        const objectId = String(itemRaw.objectId || '').trim()
        if (!objectId) {
          return
        }
        rowIdList.push(objectId)
        nextObjectDataById[objectId] = {
          objectId,
          dataType,
          type: Number.isFinite(Number(itemRaw.type)) ? Math.floor(Number(itemRaw.type)) : -1,
          editType: Number.isFinite(Number(itemRaw.editType)) ? Math.floor(Number(itemRaw.editType)) : 0,
          valuePreview: toValuePreview(dataType, itemRaw as Record<string, unknown>),
          valueText: itemRaw.valueText === undefined || itemRaw.valueText === null ? '' : String(itemRaw.valueText),
          valueJson: itemRaw.valueJson,
          valueBase64: itemRaw.valueBase64 === undefined || itemRaw.valueBase64 === null ? '' : String(itemRaw.valueBase64),
          createdAt: String(itemRaw.createdAt || ''),
          updatedAt: String(itemRaw.updatedAt || ''),
        }
      })
      runInAction(() => {
        typeState.objectDataById = nextObjectDataById
        typeState.rowIdsByPage = {
          ...typeState.rowIdsByPage,
          [pageIndex]: rowIdList,
        }
        typeState.totalCount = Number(data.totalCount || 0)
      })
      return { isSuccess: true, messageText: 'object list loaded' }
    } catch (error: unknown) {
      runInAction(() => {
        typeState.errorText = String(error)
      })
      return { isSuccess: false, messageText: String(error) }
    } finally {
      runInAction(() => {
        typeState.isListLoading = false
      })
    }
  }

  async listAllObjectText(spaceId: string, options: { forceReload?: boolean } = {}) {
    return this.listObjects(spaceId, 'text', options)
  }

  async listAllObjectBytes(spaceId: string, options: { forceReload?: boolean } = {}) {
    return this.listObjects(spaceId, 'bytes', options)
  }

  async listAllObjectJson(spaceId: string, options: { forceReload?: boolean } = {}) {
    return this.listObjects(spaceId, 'json', options)
  }

  async requestListCurrentPage(spaceId: string, dataType: ObjectPayloadType, options: { forceReload?: boolean } = {}) {
    if (dataType === 'text') {
      return this.listAllObjectText(spaceId, options)
    }
    if (dataType === 'bytes') {
      return this.listAllObjectBytes(spaceId, options)
    }
    return this.listAllObjectJson(spaceId, options)
  }

  startListLoading(spaceId: string, dataType: ObjectPayloadType, isResetCurrentPageRows = false) {
    const typeState = this.getSpaceTypeState(spaceId, dataType)
    if (!typeState) {
      return
    }
    typeState.isListLoading = true
    typeState.errorText = ''
    if (isResetCurrentPageRows) {
      typeState.rowIdsByPage = {
        ...typeState.rowIdsByPage,
        [typeState.pageIndex]: [],
      }
    }
  }

  async requestCreateObject(spaceId: string, dataType: ObjectPayloadType, input: { type?: number; editType?: number; valueText?: string; valueJsonText?: string; valueBase64?: string }) {
    const typeState = this.getSpaceTypeState(spaceId, dataType)
    if (!typeState) {
      return { isSuccess: false, messageText: 'invalid space id' }
    }
    runInAction(() => {
      typeState.isCreateOrEditSubmitting = true
    })
    try {
      const valueJson = dataType === 'json'
        ? JSON.parse(String(input.valueJsonText || '{}'))
        : undefined
      const typeValue = Number.isFinite(input.type) ? Math.floor(Number(input.type)) : -1
      const editTypeValue = Number.isFinite(input.editType) ? Math.floor(Number(input.editType)) : 0
      const data = await this.requestJson('/api/object/create', {
        method: 'POST',
        body: JSON.stringify({
          spaceId,
          dataType,
          type: typeValue,
          editType: editTypeValue,
          valueText: dataType === 'text' ? String(input.valueText || '') : undefined,
          valueBase64: dataType === 'bytes' ? String(input.valueBase64 || '') : undefined,
          valueJson,
        }),
      })
      runInAction(() => {
        typeState.pageIndex = 1
        typeState.rowIdsByPage = {}
        typeState.selectedObjectIdList = [String(data.objectId || '')].filter(Boolean)
      })
      await this.requestListCurrentPage(spaceId, dataType, { forceReload: true })
      return { isSuccess: true, messageText: `object created: ${String(data.objectId || '')}` }
    } catch (error: unknown) {
      runInAction(() => {
        typeState.errorText = String(error)
      })
      return { isSuccess: false, messageText: String(error) }
    } finally {
      runInAction(() => {
        typeState.isCreateOrEditSubmitting = false
      })
    }
  }

  async requestUpdateObject(spaceId: string, dataType: ObjectPayloadType, objectId: string, input: { type?: number; editType?: number; valueText?: string; valueJsonText?: string; valueBase64?: string }) {
    const typeState = this.getSpaceTypeState(spaceId, dataType)
    if (!typeState) {
      return { isSuccess: false, messageText: 'invalid space id' }
    }
    runInAction(() => {
      typeState.isCreateOrEditSubmitting = true
    })
    try {
      const valueJson = dataType === 'json'
        ? JSON.parse(String(input.valueJsonText || '{}'))
        : undefined
      const typeValue = Number.isFinite(input.type) ? Math.floor(Number(input.type)) : -1
      const editTypeValue = Number.isFinite(input.editType) ? Math.floor(Number(input.editType)) : 0
      await this.requestJson('/api/object/update', {
        method: 'POST',
        body: JSON.stringify({
          spaceId,
          dataType,
          objectId,
          type: typeValue,
          editType: editTypeValue,
          valueText: dataType === 'text' ? String(input.valueText || '') : undefined,
          valueBase64: dataType === 'bytes' ? String(input.valueBase64 || '') : undefined,
          valueJson,
        }),
      })
      typeState.rowIdsByPage = {}
      await this.requestListCurrentPage(spaceId, dataType, { forceReload: true })
      return { isSuccess: true, messageText: `object updated: ${objectId}` }
    } catch (error: unknown) {
      runInAction(() => {
        typeState.errorText = String(error)
      })
      return { isSuccess: false, messageText: String(error) }
    } finally {
      runInAction(() => {
        typeState.isCreateOrEditSubmitting = false
      })
    }
  }

  async requestDeleteSelectedObjects(spaceId: string, dataType: ObjectPayloadType) {
    const typeState = this.getSpaceTypeState(spaceId, dataType)
    if (!typeState) {
      return { isSuccess: false, messageText: 'invalid space id' }
    }
    const objectIdList = typeState.selectedObjectIdList.map((item) => String(item || '').trim()).filter(Boolean)
    if (objectIdList.length <= 0) {
      return { isSuccess: false, messageText: 'no objects selected' }
    }
    runInAction(() => {
      typeState.isDeleteSubmitting = true
    })
    try {
      await this.requestJson('/api/object/delete', {
        method: 'POST',
        body: JSON.stringify({
          spaceId,
          dataType,
          objectIds: objectIdList,
        }),
      })
      runInAction(() => {
        typeState.selectedObjectIdList = []
        typeState.rowIdsByPage = {}
      })
      await this.requestListCurrentPage(spaceId, dataType, { forceReload: true })
      return { isSuccess: true, messageText: `objects deleted: ${objectIdList.length}` }
    } catch (error: unknown) {
      runInAction(() => {
        typeState.errorText = String(error)
      })
      return { isSuccess: false, messageText: String(error) }
    } finally {
      runInAction(() => {
        typeState.isDeleteSubmitting = false
      })
    }
  }

  openCreateCard(spaceId: string, dataType: ObjectPayloadType) {
    const typeState = this.getSpaceTypeState(spaceId, dataType)
    if (!typeState) {
      return
    }
    typeState.isCardVisible = true
    typeState.cardMode = 'create'
    typeState.cardObjectId = ''
  }

  openEditCard(spaceId: string, dataType: ObjectPayloadType, objectId: string) {
    const typeState = this.getSpaceTypeState(spaceId, dataType)
    if (!typeState) {
      return
    }
    typeState.isCardVisible = true
    typeState.cardMode = 'edit'
    typeState.cardObjectId = String(objectId || '')
  }

  closeCard(spaceId: string, dataType: ObjectPayloadType) {
    const typeState = this.getSpaceTypeState(spaceId, dataType)
    if (!typeState) {
      return
    }
    typeState.isCardVisible = false
  }

  clearAllState() {
    this.stateBySpaceId = {}
  }
}

export const objectStore = new ObjectStore()
