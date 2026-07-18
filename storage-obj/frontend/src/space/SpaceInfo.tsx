import { useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { KeyValues, MetadataKeyValues } from '@wwf971/react-comp-misc'
import * as ReactCompMisc from '@wwf971/react-comp-misc'
import { appStore } from '../store/appStore'
import './space.css'

type SpaceInfoProps = {
  spaceId: string
  isLocked: boolean
  onDeleteSpace: (spaceId: string) => Promise<{
    isSuccess: boolean
    messageText: string
  }>
  onClearSpace: (spaceId: string) => Promise<{
    isSuccess: boolean
    messageText: string
  }>
}

const PanelPopupComp = (ReactCompMisc as any).PanelPopup

const SpaceInfo = observer(function SpaceInfo({
  spaceId,
  isLocked,
  onDeleteSpace,
  onClearSpace,
}: SpaceInfoProps) {
  const hasSelectedSpace = Boolean(spaceId)
  const [isConfirmDeleteVisible, setIsConfirmDeleteVisible] = useState(false)
  const [isConfirmClearVisible, setIsConfirmClearVisible] = useState(false)
  const [selectedMetadataTag, setSelectedMetadataTag] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState({
    status: 'idle',
    messageText: '',
  })

  useEffect(() => {
    if (!hasSelectedSpace) {
      return
    }
    ;(async () => {
      const result = await appStore.requestLoadSpaceMetadata(spaceId)
      if (result?.isSuccess) {
        setActionMessage({
          status: 'idle',
          messageText: '',
        })
      } else {
        setActionMessage({
          status: 'error',
          messageText: result?.messageText || 'failed to load metadata',
        })
      }
    })()
  }, [hasSelectedSpace, spaceId])

  const metadataRows = appStore.spaceMetadataItems.map((item) => ({
    id: item.tag,
    key: item.tag,
    value: String(item.valueText || ''),
    rank: item.rank || '',
    keyCompName: 'editable',
    valueCompName: 'editable',
  }))
  const handleMetadataSelectionChange = (nextSelectedMetadataTag: string | null) => {
    if (nextSelectedMetadataTag === null) {
      return
    }
    setSelectedMetadataTag(nextSelectedMetadataTag)
  }

  const handleMoveSelected = async (direction: 'up' | 'down') => {
    if (!hasSelectedSpace || !selectedMetadataTag) {
      return
    }
    const result = await appStore.requestMoveSpaceMetadata(spaceId, selectedMetadataTag, direction)
    setActionMessage({
      status: result?.isSuccess ? 'success' : 'error',
      messageText: result?.messageText || '',
    })
  }

  const handleDeleteSelectedRow = async () => {
    if (!hasSelectedSpace || !selectedMetadataTag) {
      return
    }
    const result = await appStore.requestDeleteSpaceMetadata(spaceId, selectedMetadataTag)
    setActionMessage({
      status: result?.isSuccess ? 'success' : 'error',
      messageText: result?.messageText || '',
    })
    if (result?.isSuccess) {
      setSelectedMetadataTag(null)
    }
  }

  return (
    <div className="space-info-root">
      <div className="frontend-title">Space Info</div>
      <div className="frontend-subtitle">
        {hasSelectedSpace ? `Current selected space: ${spaceId}` : 'Select one space from the left tree.'}
      </div>
      <div className="frontend-actions">
        <button
          className="frontend-btn is-danger"
          type="button"
          disabled={isLocked || !hasSelectedSpace}
          onClick={() => {
            setIsConfirmClearVisible(true)
          }}
        >
          <span>Empty Space</span>
        </button>
        <button
          className="frontend-btn is-danger"
          type="button"
          disabled={isLocked || !hasSelectedSpace}
          onClick={() => {
            setIsConfirmDeleteVisible(true)
          }}
        >
          <span>Delete Space</span>
        </button>
        <button
          className="frontend-btn"
          type="button"
          disabled={isLocked || !hasSelectedSpace}
          onClick={async () => {
            const result = await appStore.requestLoadSpaceMetadata(spaceId)
            setActionMessage({
              status: result?.isSuccess ? 'success' : 'error',
              messageText: result?.messageText || '',
            })
          }}
        >
          <span>Refresh Metadata</span>
        </button>
      </div>
      {isConfirmClearVisible ? (
        <PanelPopupComp
          type="confirm"
          title="Confirm Empty Space"
          message={`Delete all object rows and metadata rows inside space ${spaceId}?`}
          confirmText="Empty Space"
          cancelText="Cancel"
          isDanger={true}
          onCancel={() => setIsConfirmClearVisible(false)}
          onConfirm={async () => {
            setIsConfirmClearVisible(false)
            if (!hasSelectedSpace) {
              return
            }
            const result = await onClearSpace(spaceId)
            setActionMessage({
              status: result?.isSuccess ? 'success' : 'error',
              messageText: result?.messageText || '',
            })
          }}
        />
      ) : null}
      {isConfirmDeleteVisible ? (
        <PanelPopupComp
          type="confirm"
          title="Confirm Delete Space"
          message={`Delete space ${spaceId} and all its data?`}
          confirmText="Delete Space"
          cancelText="Cancel"
          isDanger={true}
          onCancel={() => setIsConfirmDeleteVisible(false)}
          onConfirm={async () => {
            setIsConfirmDeleteVisible(false)
            if (!hasSelectedSpace) {
              return
            }
            const result = await onDeleteSpace(spaceId)
            setActionMessage({
              status: result?.isSuccess ? 'success' : 'error',
              messageText: result?.messageText || '',
            })
          }}
        />
      ) : null}
      <div className="frontend-kv">
        <KeyValues
          data={{
            rows: [
              { key: 'spaceId', value: hasSelectedSpace ? spaceId : '-' },
              { key: 'deletable', value: hasSelectedSpace ? 'yes' : 'no' },
            ],
          }}
          config={{ isEditable: false }}
        />
      </div>
      <MetadataKeyValues
        data={{
          titleText: 'Metadata',
          rows: metadataRows,
          selectedRowId: selectedMetadataTag,
          messageState: actionMessage,
        }}
        config={{
          isLocked: isLocked || !hasSelectedSpace,
          isEditable: hasSelectedSpace,
          keyColWidth: '180px',
        }}
        onEvent={async (eventType, eventData) => {
          if (eventType === 'selectedRowIdChange') {
            handleMetadataSelectionChange(eventData.selectedRowId)
            return
          }
          if (eventType === 'messageDismiss') {
            setActionMessage({
              status: 'idle',
              messageText: '',
            })
            return
          }
          if (eventType === 'messageStateChange') {
            setActionMessage(eventData.messageState)
            return
          }
          if (eventType === 'cellUpdate') {
            const { rowId, field, nextValue } = eventData
            if (!hasSelectedSpace) {
              return { code: -1, message: 'invalid row' }
            }
            const row = metadataRows.find((item) => item.id === rowId)
            if (!row) {
              return { code: -1, message: 'row missing' }
            }
            if (field === 'value') {
              const result = await appStore.requestUpsertSpaceMetadata(spaceId, {
                tag: row.key,
                rank: row.rank,
                valueText: nextValue,
              })
              setActionMessage({
                status: result?.isSuccess ? 'success' : 'error',
                messageText: result?.messageText || '',
              })
              return result?.isSuccess ? { code: 0 } : { code: -1, message: result?.messageText || 'error' }
            }
            if (field === 'key') {
              const nextTag = nextValue.trim()
              if (!nextTag || nextTag === row.key) {
                return { code: 0 }
              }
              const renameResult = await appStore.requestRenameSpaceMetadata(spaceId, row.key, nextTag, row.rank, row.value)
              if (!renameResult?.isSuccess) {
                setActionMessage({
                  status: 'error',
                  messageText: renameResult?.messageText || 'error',
                })
                return { code: -1, message: renameResult?.messageText || 'error' }
              }
              setSelectedMetadataTag(nextTag)
              setActionMessage({
                status: 'success',
                messageText: renameResult?.messageText || `metadata renamed: ${row.key} to ${nextTag}`,
              })
              return { code: 0 }
            }
            return { code: 0 }
          }
          if (eventType === 'addAtEnd') {
            const result = await appStore.requestInsertSpaceMetadata(spaceId, 'tail')
            setActionMessage({
              status: result?.isSuccess ? 'success' : 'error',
              messageText: result?.messageText || '',
            })
            if (result?.tag) {
              setSelectedMetadataTag(result.tag)
            }
            return
          }
          if (eventType === 'addAbove') {
            const result = await appStore.requestInsertSpaceMetadata(spaceId, 'above', selectedMetadataTag || '')
            setActionMessage({
              status: result?.isSuccess ? 'success' : 'error',
              messageText: result?.messageText || '',
            })
            if (result?.tag) {
              setSelectedMetadataTag(result.tag)
            }
            return
          }
          if (eventType === 'addBelow') {
            const result = await appStore.requestInsertSpaceMetadata(spaceId, 'below', selectedMetadataTag || '')
            setActionMessage({
              status: result?.isSuccess ? 'success' : 'error',
              messageText: result?.messageText || '',
            })
            if (result?.tag) {
              setSelectedMetadataTag(result.tag)
            }
            return
          }
          if (eventType === 'moveUp') {
            await handleMoveSelected('up')
            return
          }
          if (eventType === 'moveDown') {
            await handleMoveSelected('down')
            return
          }
          if (eventType === 'delete') {
            await handleDeleteSelectedRow()
          }
        }}
      />
    </div>
  )
})

export default SpaceInfo
