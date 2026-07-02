import { observer } from 'mobx-react-lite'
import { SpinningCircle } from '@wwf971/react-comp-misc'
import * as ReactCompMisc from '@wwf971/react-comp-misc'
import { objectStore, type ObjectPayloadType } from './objectStore'

const FolderHeaderComp = (ReactCompMisc as any).FolderHeader
const FolderViewComp = (ReactCompMisc as any).FolderView

const EDIT_TYPE_LABEL_BY_CODE: Record<number, string> = {
  0: 'UPDATE-ONLY',
  1: 'UPDATE-AND-EDIT',
  2: 'EDIT-ONLY',
}

type ObjectTableProps = {
  spaceId: string
  dataType: ObjectPayloadType
  isLocked: boolean
  onOpenEdit: (objectId: string) => void
  onRequestPageChange: (nextPageIndex: number) => Promise<void> | void
}

const ObjectTable = observer(function ObjectTable({
  spaceId,
  dataType,
  isLocked,
  onOpenEdit,
  onRequestPageChange,
}: ObjectTableProps) {
  const typeState = objectStore.getSpaceTypeState(spaceId, dataType)
  if (!typeState) {
    return null
  }
  const rows = objectStore.getCurrentPageRows(spaceId, dataType).map((item) => ({
    id: item.objectId,
    data: {
      objectId: item.objectId,
      type: String(Number.isFinite(Number(item.type)) ? Math.floor(Number(item.type)) : -1),
      editType: `${EDIT_TYPE_LABEL_BY_CODE[Number(item.editType)] || 'UNKNOWN'}(${Number.isFinite(Number(item.editType)) ? Number(item.editType) : 0})`,
      valuePreview: String(item.valuePreview || ''),
      updatedAt: item.updatedAt || item.createdAt || '',
    },
  }))
  const totalPageCount = objectStore.getTotalPageCount(spaceId, dataType)
  const columns = {
    objectId: { data: 'objectId', align: 'left' as const },
    type: { data: 'type', align: 'left' as const },
    editType: { data: 'editType', align: 'left' as const },
    valuePreview: { data: 'value', align: 'left' as const },
    updatedAt: { data: 'updatedAt', align: 'left' as const },
  }
  const columnsOrder = ['objectId', 'type', 'editType', 'valuePreview', 'updatedAt']
  const columnsSize = {
    objectId: { width: 180, minWidth: 120, resizable: true },
    type: { width: 70, minWidth: 55, resizable: true },
    editType: { width: 160, minWidth: 120, resizable: true },
    valuePreview: { width: 320, minWidth: 150, resizable: true },
    updatedAt: { width: 180, minWidth: 130, resizable: true },
  }
  const isBodyLoadingOnly = typeState.isListLoading && rows.length <= 0
  return (
    <div className="object-table-root">
      <div className="object-table-pagination frontend-actions">
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
      </div>
      {isBodyLoadingOnly ? (
        <div className="object-table-loading-wrapper">
          <FolderHeaderComp
            data={{
              columns,
              colsOrder: columnsOrder,
            }}
            config={{
              colSizeById: columnsSize,
              isColReorderAllowed: false,
              isLastColFilled: true,
            }}
          />
          <div className="object-table-loading-body">
            <SpinningCircle width={18} height={18} />
            <div className="object-table-loading-text">Fetching object data</div>
          </div>
        </div>
      ) : (
        <FolderViewComp
          data={{
            columns,
            colsOrder: columnsOrder,
            rows,
            rowIdsSelected: typeState.selectedObjectIdList,
            statusBar: {
              itemCount: rows.length,
              messageState: typeState.isListLoading
                ? { status: 'loading', messageText: 'Loading' }
                : typeState.errorText
                  ? { status: 'error', messageText: typeState.errorText }
                  : null,
            },
          }}
          config={{
            colSizeById: columnsSize,
            bodyHeight: 300,
            isListOnly: true,
            isStatusBarVisible: false,
            isStatusItemCountVisible: false,
            isLastColFilled: true,
            isColReorderAllowed: false,
            isRowReorderAllowed: false,
            selectionMode: 'multiple',
            isLocked: isLocked || typeState.isListLoading,
          }}
          onEvent={async (eventType, eventData) => {
            if (eventType === 'rowIdsSelectedChange') {
              objectStore.setSelectedObjectIdList(spaceId, dataType, eventData.rowIdsSelected as string[])
              return { code: 0 }
            }
            if (eventType === 'rowDoubleClick') {
              onOpenEdit(String(eventData.rowId || ''))
              return { code: 0 }
            }
            return { code: 0 }
          }}
        />
      )}
      {typeState.errorText ? <div className="frontend-error">{typeState.errorText}</div> : null}
    </div>
  )
})

export default ObjectTable
