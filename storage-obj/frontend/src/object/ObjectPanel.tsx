import { useEffect, useRef, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { MessageBar } from '@wwf971/react-comp-misc'
import ObjectToolbar from './ObjectToolbar'
import ObjectTable from './ObjectTable'
import ObjectCard from './ObjectCard'
import { objectStore, type ObjectPayloadType } from './objectStore'
import { storageEndpointStore } from '../store/storageEndpointStore'
import './object.css'

type ObjectPanelProps = {
  spaceId: string
}

const ObjectPanel = observer(function ObjectPanel({
  spaceId,
}: ObjectPanelProps) {
  const [messageState, setMessageState] = useState({
    status: 'idle',
    messageText: '',
  })
  const latestContextKeyRef = useRef('')
  const dataType = objectStore.getCurrentPayloadType(spaceId)
  const typeState = objectStore.getSpaceTypeState(spaceId, dataType)
  const storageEndpointKey = storageEndpointStore.selectedOrDefaultKey

  const requestRefresh = async () => {
    const result = await objectStore.requestListCurrentPage(spaceId, dataType, { forceReload: true })
    setMessageState({
      status: result?.isSuccess ? 'success' : 'error',
      messageText: result?.messageText || '',
    })
  }

  useEffect(() => {
    if (!spaceId) {
      return
    }
    const contextKey = `${storageEndpointKey}:${spaceId}`
    const isSwitchingContext = latestContextKeyRef.current !== contextKey
    latestContextKeyRef.current = contextKey
    const currentRows = objectStore.getCurrentPageRows(spaceId, dataType)
    const hasCurrentRows = currentRows.length > 0
    if (isSwitchingContext || !hasCurrentRows) {
      objectStore.startListLoading(spaceId, dataType, true)
      objectStore.requestListCurrentPage(spaceId, dataType, { forceReload: true })
    } else {
      objectStore.requestListCurrentPage(spaceId, dataType)
    }
    if (isSwitchingContext) {
      ;(['text', 'bytes', 'json'] as ObjectPayloadType[])
        .filter((itemType) => itemType !== dataType)
        .forEach((itemType) => {
          objectStore.requestListCurrentPage(spaceId, itemType)
        })
    }
  }, [spaceId, dataType, storageEndpointKey])

  if (!spaceId || !typeState) {
    return (
      <div className="object-panel-root">
        <div className="frontend-title">Objects</div>
        <div className="frontend-subtitle">Select one space from tree first.</div>
      </div>
    )
  }

  const isLocked = typeState.isCreateOrEditSubmitting || typeState.isDeleteSubmitting
  const isSearchMode = (dataType === 'text' || dataType === 'json') && Boolean(typeState.activeSearchText)

  return (
    <div className="object-panel-root">
      <div className="frontend-title">Objects</div>
      <div className="frontend-subtitle">
        endpoint: {storageEndpointKey || '-'}, space: {spaceId}
      </div>
      <MessageBar
        data={{
          messageState,
          idleText: 'ready',
        }}
        config={{
          isPersistent: true,
        }}
        onEvent={(eventType) => {
          if (eventType === 'dismissMessageRequest') {
            setMessageState({
              status: 'idle',
              messageText: '',
            })
          }
        }}
      />
      <ObjectToolbar
        spaceId={spaceId}
        dataType={dataType}
        isLocked={isLocked}
        onRequestRefresh={requestRefresh}
        onRequestDelete={async () => {
          const result = await objectStore.requestDeleteSelectedObjects(spaceId, dataType)
          setMessageState({
            status: result?.isSuccess ? 'success' : 'error',
            messageText: result?.messageText || '',
          })
        }}
        onRequestPageChange={async (nextPageIndex) => {
          objectStore.setPageIndex(spaceId, dataType, nextPageIndex)
          await objectStore.requestListCurrentPage(spaceId, dataType)
        }}
      />
      {isSearchMode ? (
        <div className="object-search-result-summary">
          Search results for "{typeState.activeSearchText}"
        </div>
      ) : null}
      <ObjectTable
        spaceId={spaceId}
        dataType={dataType}
        isLocked={isLocked}
        onOpenEdit={(objectId) => {
          objectStore.openEditCard(spaceId, dataType, objectId)
        }}
      />
      <ObjectCard
        spaceId={spaceId}
        dataType={dataType}
        onRequestSave={async (input: { type?: number; editType?: number; valueText?: string; valueJsonText?: string; valueBase64?: string }) => {
          const result = typeState.cardMode === 'create'
            ? await objectStore.requestCreateObject(spaceId, dataType, input)
            : await objectStore.requestUpdateObject(spaceId, dataType, typeState.cardObjectId, input)
          setMessageState({
            status: result?.isSuccess ? 'success' : 'error',
            messageText: result?.messageText || '',
          })
          if (result?.isSuccess) {
            objectStore.closeCard(spaceId, dataType)
          }
        }}
      />
    </div>
  )
})

export default ObjectPanel
