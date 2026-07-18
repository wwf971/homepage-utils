import { useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { objectStore, type ObjectPayloadType } from './objectStore'

type ObjectToolbarProps = {
  spaceId: string
  dataType: ObjectPayloadType
  isLocked: boolean
  onRequestRefresh: () => Promise<void> | void
  onRequestDelete: () => Promise<void> | void
  onRequestPageChange: (nextPageIndex: number) => Promise<void> | void
}

function handleScrollRowWheel(
  event: React.WheelEvent<HTMLDivElement>,
  viewportEl: HTMLDivElement | null,
  trackEl: HTMLDivElement | null,
  scrollLeft: number,
  setScrollLeft: (nextScrollLeft: number) => void,
) {
  if (!viewportEl || !trackEl) {
    return
  }
  const maxScrollLeft = Math.max(0, trackEl.scrollWidth - viewportEl.clientWidth)
  if (maxScrollLeft <= 0) {
    return
  }
  const deltaX = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
  if (!deltaX) {
    return
  }
  event.preventDefault()
  const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, scrollLeft + deltaX))
  setScrollLeft(nextScrollLeft)
}

const ObjectToolbar = observer(function ObjectToolbar({
  spaceId,
  dataType,
  isLocked,
  onRequestRefresh,
  onRequestDelete,
  onRequestPageChange,
}: ObjectToolbarProps) {
  const typeState = objectStore.getSpaceTypeState(spaceId, dataType)
  const searchEditorRef = useRef<HTMLDivElement | null>(null)
  const mainViewportRef = useRef<HTMLDivElement | null>(null)
  const mainTrackRef = useRef<HTMLDivElement | null>(null)
  const paginationViewportRef = useRef<HTMLDivElement | null>(null)
  const paginationTrackRef = useRef<HTMLDivElement | null>(null)
  if (!typeState) {
    return null
  }
  const isSearchSupported = dataType === 'text' || dataType === 'json'
  const selectedObjectNum = typeState.selectedObjectIdList.length
  const totalPageCount = objectStore.getTotalPageCount(spaceId, dataType)
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
    <div className="object-toolbar-rows">
      <div
        className="object-toolbar-row"
        ref={mainViewportRef}
        onWheel={(event) => {
          handleScrollRowWheel(
            event,
            mainViewportRef.current,
            mainTrackRef.current,
            objectStore.toolbarMainScrollLeft,
            objectStore.setToolbarMainScrollLeft,
          )
        }}
      >
        <div
          ref={mainTrackRef}
          className="object-toolbar-track"
          style={{ transform: `translateX(${-objectStore.toolbarMainScrollLeft}px)` }}
        >
          <div className="object-toolbar-group">
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
          <div className="object-toolbar-group">
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
          <div className="object-toolbar-group">
            <button
              type="button"
              className="frontend-btn"
              disabled={isLocked}
              onClick={() => objectStore.openCreateCard(spaceId, dataType)}
            >
              <span>Create</span>
            </button>
            <button
              type="button"
              className="frontend-btn is-danger"
              disabled={isLocked || selectedObjectNum <= 0}
              onClick={() => onRequestDelete()}
            >
              <span>Delete Selected ({selectedObjectNum})</span>
            </button>
          </div>
        </div>
      </div>
      <div
        className="object-toolbar-row"
        ref={paginationViewportRef}
        onWheel={(event) => {
          handleScrollRowWheel(
            event,
            paginationViewportRef.current,
            paginationTrackRef.current,
            objectStore.toolbarPaginationScrollLeft,
            objectStore.setToolbarPaginationScrollLeft,
          )
        }}
      >
        <div
          ref={paginationTrackRef}
          className="object-toolbar-track"
          style={{ transform: `translateX(${-objectStore.toolbarPaginationScrollLeft}px)` }}
        >
          <div className="object-toolbar-group object-toolbar-pagination">
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
            <button
              type="button"
              className="frontend-btn"
              disabled={isLocked || typeState.pageIndex <= 1}
              onClick={() => onRequestPageChange(typeState.pageIndex - 1)}
            >
              <span>Prev</span>
            </button>
            <span className="object-table-pagination-text">
              Page {typeState.pageIndex} / {totalPageCount}
            </span>
            <button
              type="button"
              className="frontend-btn"
              disabled={isLocked || typeState.pageIndex >= totalPageCount}
              onClick={() => onRequestPageChange(typeState.pageIndex + 1)}
            >
              <span>Next</span>
            </button>
            <button type="button" className="frontend-btn" disabled={isLocked} onClick={() => onRequestRefresh()}>
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

export default ObjectToolbar
