import { observer } from 'mobx-react-lite'
import { SpinningCircle } from '@wwf971/react-comp-misc'
import * as ReactCompMisc from '@wwf971/react-comp-misc'
import { objectStore, type ObjectPayloadType } from './objectStore'
import { formatObjectContentByteSize } from './objectContentSize'

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
}

const ObjectTable = observer(function ObjectTable({
  spaceId,
  dataType,
  isLocked,
  onOpenEdit,
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
      size: formatObjectContentByteSize(item.contentByteSize),
      editType: `${EDIT_TYPE_LABEL_BY_CODE[Number(item.editType)] || 'UNKNOWN'}(${Number.isFinite(Number(item.editType)) ? Number(item.editType) : 0})`,
      valuePreview: String(item.valuePreview || ''),
      updatedAt: item.updatedAt || item.createdAt || '',
    },
  }))
  const columns = {
    objectId: { data: 'objectId', align: 'left' as const },
    type: { data: 'type', align: 'left' as const },
    size: { data: 'size', align: 'right' as const },
    editType: { data: 'editType', align: 'left' as const },
    valuePreview: { data: 'value', align: 'left' as const },
    updatedAt: { data: 'updatedAt', align: 'left' as const },
  }
  const columnsOrder = ['objectId', 'type', 'size', 'editType', 'valuePreview', 'updatedAt']
  const columnsSize = {
    objectId: { width: 180, minWidth: 120, resizable: true },
    type: { width: 70, minWidth: 55, resizable: true },
    size: { width: 72, minWidth: 55, resizable: true },
    editType: { width: 160, minWidth: 120, resizable: true },
    valuePreview: { width: 320, minWidth: 150, resizable: true },
    updatedAt: { width: 180, minWidth: 130, resizable: true },
  }
  const isBodyLoadingOnly = typeState.isListLoading && rows.length <= 0
  return (
    <div className="object-table-root">
      <FolderViewComp
        data={{
          columns,
          colsOrder: columnsOrder,
          rows,
          rowIdsSelected: typeState.selectedObjectIdList,
          statusBar: {
            itemCount: rows.length,
            messageState: isBodyLoadingOnly
              ? { status: 'loading', messageText: 'Fetching object data' }
              : typeState.isListLoading
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
      {isBodyLoadingOnly ? (
        <div className="object-table-loading-overlay">
          <SpinningCircle width={18} height={18} />
          <div className="object-table-loading-text">Fetching object data</div>
        </div>
      ) : null}
      {typeState.errorText ? <div className="frontend-error">{typeState.errorText}</div> : null}
    </div>
  )
})

export default ObjectTable
