import { useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { objectStore, type ObjectPayloadType } from './objectStore'

type ObjectFilterProps = {
  spaceId: string
  dataType: ObjectPayloadType
  isLocked: boolean
  onRequestRefresh: () => Promise<void> | void
}

const ObjectFilter = observer(function ObjectFilter({
  spaceId,
  dataType,
  isLocked,
  onRequestRefresh,
}: ObjectFilterProps) {
  const typeState = objectStore.getSpaceTypeState(spaceId, dataType)
  const searchEditorRef = useRef<HTMLDivElement | null>(null)
  if (!typeState) {
    return null
  }
  const isSearchSupported = dataType === 'text' || dataType === 'json'
  useEffect(() => {
    if (!isSearchSupported) {
      return
    }
    const targetEl = searchEditorRef.current
    if (!targetEl) {
      return
    }
    const nextValue = typeState.searchInputText
    if ((targetEl.textContent || '') !== nextValue) {
      targetEl.textContent = nextValue
    }
  }, [isSearchSupported, typeState.searchInputText])
  return (
    <div className="object-filter-root">
      <div className="object-filter-line">
        {(['text', 'bytes', 'json'] as ObjectPayloadType[]).map((itemType) => (
          <button
            key={itemType}
            type="button"
            className={`frontend-btn object-filter-data-type-btn ${dataType === itemType ? 'object-filter-data-type-btn-active' : ''}`}
            disabled={isLocked}
            onClick={() => {
              objectStore.setCurrentPayloadType(spaceId, itemType)
            }}
          >
            <span>{itemType}</span>
          </button>
        ))}
      </div>
      <div className="object-filter-line">
        {isSearchSupported ? (
          <>
            <div
              ref={searchEditorRef}
              className={`object-filter-search-editor ${isLocked ? 'is-locked' : ''}`}
              contentEditable={!isLocked}
              suppressContentEditableWarning={true}
              onInput={(event) => {
                objectStore.setSearchInputText(spaceId, dataType, event.currentTarget.textContent || '')
              }}
            />
            <button
              type="button"
              className="frontend-btn"
              disabled={isLocked}
              onClick={() => {
                objectStore.applySearchText(spaceId, dataType)
                onRequestRefresh()
              }}
            >
              <span>Search</span>
            </button>
            <button
              type="button"
              className="frontend-btn"
              disabled={isLocked || (!typeState.activeSearchText && !typeState.searchInputText)}
              onClick={() => {
                objectStore.clearSearchText(spaceId, dataType)
                onRequestRefresh()
              }}
            >
              <span>Clear Search</span>
            </button>
          </>
        ) : (
          <span className="object-filter-info-item">Search is available for text/json only.</span>
        )}
      </div>
      <div className="object-filter-line object-filter-line-small">
        <span className="object-filter-info-item">Total: {typeState.totalCount}</span>
        <span className="object-filter-info-item">Page Size:</span>
        {[10, 20, 50, 100].map((size) => (
          <button
            key={size}
            type="button"
            className={`frontend-btn ${typeState.pageSize === size ? 'is-active' : ''}`}
            disabled={isLocked}
            onClick={() => {
              objectStore.setPageSize(spaceId, dataType, size)
              onRequestRefresh()
            }}
          >
            <span>{size}</span>
          </button>
        ))}
        <button type="button" className="frontend-btn" disabled={isLocked} onClick={() => onRequestRefresh()}>
          <span>Refresh</span>
        </button>
      </div>
    </div>
  )
})

export default ObjectFilter
