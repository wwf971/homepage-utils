import { useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { KeyValues } from '@wwf971/react-comp-misc'
import * as ReactCompMisc from '@wwf971/react-comp-misc'
import KeyValuesComp from '@wwf971/react-comp-misc/KeyValuesComp'
import { EditableValueComp } from '@wwf971/react-comp-misc'
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
  const selectedRowIndex = selectedMetadataTag
    ? metadataRows.findIndex((item) => item.id === selectedMetadataTag)
    : -1
  const isMoveUpDisabled = selectedRowIndex <= 0
  const isMoveDownDisabled = selectedRowIndex < 0 || selectedRowIndex >= metadataRows.length - 1
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

  const EditableMetadataComp = ({ data, field, index }: any) => {
    const metadataRow = metadataRows[index]
    const metadataRowId = String(metadataRow?.id || '')
    return (
      <EditableValueComp
        data={String(data || '')}
        configKey={`${field}_${metadataRowId || index}`}
        valueType="text"
        isNotSet={false}
        index={index}
        field={field}
        onUpdate={async (_key, val) => {
          if (!hasSelectedSpace) {
            return { code: -1, message: 'invalid row' }
          }
          const row = metadataRows.find((item) => item.id === metadataRowId) || metadataRows[index]
          if (!row) {
            return { code: -1, message: 'row missing' }
          }
          const nextValue = String(val || '')
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
            return result?.isSuccess ? { code: 0, message: 'ok' } : { code: -1, message: result?.messageText || 'error' }
          }
          if (field === 'key') {
            const nextTag = nextValue.trim()
            if (!nextTag || nextTag === row.key) {
              return { code: 0, message: 'noop' }
            }
            const renameResult = await appStore.requestRenameSpaceMetadata(
              spaceId,
              row.key,
              nextTag,
              row.rank,
              row.value,
            )
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
            return { code: 0, message: 'ok' }
          }
          return { code: 0, message: 'noop' }
        }}
      />
    )
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
          data={[
            { key: 'spaceId', value: hasSelectedSpace ? spaceId : '-' },
            { key: 'deletable', value: hasSelectedSpace ? 'yes' : 'no' },
          ]}
          isEditable={false}
        />
      </div>
      <div className="frontend-title">Metadata</div>
      {actionMessage.messageText ? (
        <div className={`frontend-message-bar status-${actionMessage.status}`}>
          <div className="frontend-message-content">
            <span>{actionMessage.messageText}</span>
            <button
              type="button"
              className="frontend-message-dismiss-btn"
              onClick={() => {
                setActionMessage({
                  status: 'idle',
                  messageText: '',
                })
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
      <div
        className="frontend-actions space-metadata-actions"
        onMouseDown={(event) => {
          event.stopPropagation()
        }}
      >
        <button
          className="frontend-btn"
          type="button"
          disabled={isLocked || !hasSelectedSpace}
          onClick={async () => {
            const result = await appStore.requestInsertSpaceMetadata(spaceId, 'tail')
            setActionMessage({
              status: result?.isSuccess ? 'success' : 'error',
              messageText: result?.messageText || '',
            })
            if (result?.tag) {
              setSelectedMetadataTag(result.tag)
            }
          }}
        >
          <span>Add at End</span>
        </button>
        <button
          className="frontend-btn"
          type="button"
          disabled={isLocked || !hasSelectedSpace || !selectedMetadataTag}
          onClick={async () => {
            const result = await appStore.requestInsertSpaceMetadata(spaceId, 'above', selectedMetadataTag || '')
            setActionMessage({
              status: result?.isSuccess ? 'success' : 'error',
              messageText: result?.messageText || '',
            })
            if (result?.tag) {
              setSelectedMetadataTag(result.tag)
            }
          }}
        >
          <span>Add Above</span>
        </button>
        <button
          className="frontend-btn"
          type="button"
          disabled={isLocked || !hasSelectedSpace || !selectedMetadataTag}
          onClick={async () => {
            const result = await appStore.requestInsertSpaceMetadata(spaceId, 'below', selectedMetadataTag || '')
            setActionMessage({
              status: result?.isSuccess ? 'success' : 'error',
              messageText: result?.messageText || '',
            })
            if (result?.tag) {
              setSelectedMetadataTag(result.tag)
            }
          }}
        >
          <span>Add Below</span>
        </button>
        <button
          className="frontend-btn"
          type="button"
          disabled={isLocked || !hasSelectedSpace || isMoveUpDisabled}
          onClick={() => handleMoveSelected('up')}
        >
          <span>Up</span>
        </button>
        <button
          className="frontend-btn"
          type="button"
          disabled={isLocked || !hasSelectedSpace || isMoveDownDisabled}
          onClick={() => handleMoveSelected('down')}
        >
          <span>Down</span>
        </button>
        <button
          className="frontend-btn is-danger"
          type="button"
          disabled={isLocked || !hasSelectedSpace || !selectedMetadataTag}
          onClick={handleDeleteSelectedRow}
        >
          <span>Delete</span>
        </button>
      </div>
      <div className="space-metadata-list">
        <KeyValuesComp
          data={metadataRows}
          isEditable={!isLocked && hasSelectedSpace}
          isKeyEditable={!isLocked && hasSelectedSpace}
          isValueEditable={!isLocked && hasSelectedSpace}
          keyColWidth="180px"
          selectionMode="single"
          selectedRowId={selectedMetadataTag}
          onSelectionChange={handleMetadataSelectionChange}
          getComp={(name) => {
            if (name === 'editable') return EditableMetadataComp
            return null
          }}
        />
      </div>
    </div>
  )
})

export default SpaceInfo
