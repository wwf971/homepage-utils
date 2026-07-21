import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { EndpointCard, KeyValues } from '@wwf971/react-comp-misc'
import { appStore } from '../store/appStore'
import { storageEndpointStore, type StorageEndpointItem } from '../store/storageEndpointStore'
import './storageEndpoint.css'

type CardMessage = {
  status: 'idle' | 'loading' | 'success' | 'error'
  messageText: string
}

type StorageEndpointPanelProps = {
  mode: 'overview' | 'config'
  isLocked: boolean
}

function getEndpointKeyValues(item: StorageEndpointItem) {
  const commonRows = [
    { key: 'key', value: item.key },
    { key: 'label', value: item.label },
    { key: 'type', value: item.type },
    { key: 'default', value: item.isDefault ? 'yes' : 'no' },
  ]
  if (item.type === 'postgres') {
    return [
      ...commonRows,
      { key: 'host', value: item.host || '' },
      { key: 'port', value: String(item.port || '') },
      { key: 'database', value: item.databaseName || '' },
      { key: 'username', value: item.username || '' },
    ]
  }
  if (item.type === 's3_aws') {
    return [
      ...commonRows,
      { key: 'bucket', value: item.bucketName || '' },
      { key: 'region', value: item.regionName || '' },
      { key: 'pathPrefix', value: item.pathPrefix || '' },
    ]
  }
  return commonRows
}

const StorageEndpointPanel = observer(function StorageEndpointPanel({
  mode,
  isLocked,
}: StorageEndpointPanelProps) {
  const [messageByKey, setMessageByKey] = useState<Record<string, CardMessage>>({})
  const visibleItems = mode === 'config'
    ? storageEndpointStore.items.filter((item) => item.key === storageEndpointStore.selectedOrDefaultKey)
    : storageEndpointStore.items

  const runAction = async (item: StorageEndpointItem, actionId: string) => {
    setMessageByKey((previous) => ({
      ...previous,
      [item.key]: {
        status: 'loading',
        messageText: actionId === 'test' ? `Testing ${item.key}` : `Setting default ${item.key}`,
      },
    }))
    const result = actionId === 'test'
      ? await storageEndpointStore.requestTest(item.key)
      : await appStore.requestSetDefaultStorageEndpoint(item.key)
    setMessageByKey((previous) => ({
      ...previous,
      [item.key]: {
        status: result?.isSuccess ? 'success' : 'error',
        messageText: result?.messageText || '',
      },
    }))
  }

  return (
    <div className="storage-endpoint-panel-root">
      <div className="frontend-title">
        {mode === 'overview' ? 'Storage Endpoints' : storageEndpointStore.selectedItem?.label || 'Endpoint Config'}
      </div>
      <div className="frontend-subtitle">
        {mode === 'overview'
          ? 'View configured storage endpoints and choose the backend default.'
          : `Safe configuration values for ${storageEndpointStore.selectedOrDefaultKey || 'the selected endpoint'}.`}
      </div>
      {mode === 'overview' ? (
        <div className="frontend-kv">
          <KeyValues
            data={{
              rows: [
                { key: 'endpointNum', value: String(storageEndpointStore.items.length) },
                { key: 'defaultKey', value: storageEndpointStore.defaultKey || '-' },
                { key: 'selectedKey', value: storageEndpointStore.selectedOrDefaultKey || '-' },
              ],
            }}
            config={{ isEditable: false }}
          />
        </div>
      ) : null}
      <div className="storage-endpoint-card-list">
        {visibleItems.map((item) => {
          const messageState = messageByKey[item.key]
          const isActionRunning = storageEndpointStore.isTesting || storageEndpointStore.isSettingDefault
          return (
            <EndpointCard
              key={item.key}
              data={{
                id: item.key,
                titleText: item.label,
                statusTagText: item.isDefault ? 'default' : item.type,
                statusMessage: messageState?.status !== 'idle' ? messageState : null,
                keyValues: getEndpointKeyValues(item),
              }}
              config={{
                isLocked: isLocked || isActionRunning,
                actionItems: [
                  {
                    id: 'test',
                    labelText: storageEndpointStore.isTesting ? 'Testing' : 'Test',
                    isVisible: true,
                    isDisabled: isLocked || isActionRunning,
                  },
                  {
                    id: 'set-default',
                    labelText: storageEndpointStore.isSettingDefault ? 'Setting Default' : 'Set Default',
                    isVisible: true,
                    isDisabled: isLocked || isActionRunning || item.isDefault,
                  },
                ],
              }}
              onEvent={async (eventType, eventData) => {
                if (eventType === 'dismissStatusMessage') {
                  setMessageByKey((previous) => ({
                    ...previous,
                    [item.key]: {
                      status: 'idle',
                      messageText: '',
                    },
                  }))
                  return
                }
                if (eventType === 'action') {
                  await runAction(item, String(eventData?.actionId || ''))
                }
              }}
            />
          )
        })}
      </div>
      {visibleItems.length === 0 ? (
        <div className="frontend-subtitle">No storage endpoint available.</div>
      ) : null}
      {storageEndpointStore.errorText ? (
        <div className="frontend-error">{storageEndpointStore.errorText}</div>
      ) : null}
    </div>
  )
})

export default StorageEndpointPanel
