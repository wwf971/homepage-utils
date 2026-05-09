import { observer } from 'mobx-react-lite'
import { DbConnectionCard, KeyValues, RefreshIcon, SpinningCircle } from '@wwf971/react-comp-misc'
import { useState } from 'react'
import { appStore } from '../store/appStore'
import DbCheck from './DbCheck'
import DbReinit from './DbReinit'
import './service.css'

type ServiceInfoProps = {
  mode: 'metadata' | 'basic-info' | 'database'
  pingMessage: { status: string; messageText: string }
  isPanelLocked: boolean
  onClickPing: () => void
  onClickRefreshDatabases: () => void
  onClickSwitchDatabase: (databaseKey: string) => Promise<void> | void
}

type CardMessage = {
  status: 'idle' | 'loading' | 'success' | 'error'
  messageText: string
}

const ServiceInfo = observer(function ServiceInfo({
  mode,
  pingMessage,
  isPanelLocked,
  onClickPing,
  onClickRefreshDatabases,
  onClickSwitchDatabase,
}: ServiceInfoProps) {
  const [databaseTestMessageByKey, setDatabaseTestMessageByKey] = useState<Record<string, CardMessage>>({})
  const [isDatabaseTestingByKey, setIsDatabaseTestingByKey] = useState<Record<string, boolean>>({})

  if (mode === 'basic-info') {
    return (
      <>
        <div className="frontend-title">Basic Info</div>
        <div className="frontend-kv">
          <KeyValues data={appStore.projectInfo} isEditable={false} />
        </div>
      </>
    )
  }

  if (mode === 'database') {
    return (
      <>
        <div className="frontend-title">Database</div>
        <div className="frontend-subtitle">Switch active database preset, then reload service and spaces.</div>
        <div className="frontend-actions">
          <button className="frontend-btn" type="button" onClick={onClickRefreshDatabases} disabled={isPanelLocked || appStore.isDatabaseLoading || appStore.isDatabaseSwitching}>
            <span>Refresh Databases</span>
          </button>
        </div>
        <div className="service-database-card-list">
          {appStore.databaseItems.length > 0 ? appStore.databaseItems.map((item) => {
            const isCurrent = item.key === appStore.currentDatabaseKey
            const isTesting = isDatabaseTestingByKey[item.key] === true
            const cardMessage = databaseTestMessageByKey[item.key] || {
              status: 'idle',
              messageText: '',
            }
            return (
              <DbConnectionCard
                key={item.key}
                titleText={item.label}
                statusTagText={isCurrent ? 'current' : ''}
                statusMessage={cardMessage.status !== 'idle' ? cardMessage : null}
                keyValuesData={[
                  { key: 'key', value: item.key },
                  { key: 'host', value: item.host },
                  { key: 'port', value: String(item.port) },
                  { key: 'database', value: item.databaseName },
                  { key: 'user', value: item.username },
                ]}
                actionItems={[
                  {
                    id: 'test',
                    labelText: isTesting ? 'Testing' : 'Test',
                    isVisible: true,
                    isDisabled: isTesting || appStore.isDatabaseSwitching || appStore.isDatabaseLoading || isPanelLocked,
                  },
                  {
                    id: 'switch',
                    labelText: appStore.isDatabaseSwitching && !isCurrent ? 'Switching' : 'Switch',
                    isVisible: true,
                    isDisabled: isCurrent || appStore.isDatabaseSwitching || appStore.isDatabaseLoading || isPanelLocked,
                  },
                ]}
                isLocked={isPanelLocked || appStore.isDatabaseLoading || appStore.isDatabaseSwitching || isTesting}
                onDismissStatusMessage={() => {
                  setDatabaseTestMessageByKey((prev) => ({
                    ...prev,
                    [item.key]: {
                      status: 'idle',
                      messageText: '',
                    },
                  }))
                }}
                onAction={async (actionId) => {
                  if (actionId === 'test') {
                    setIsDatabaseTestingByKey((prev) => ({
                      ...prev,
                      [item.key]: true,
                    }))
                    setDatabaseTestMessageByKey((prev) => ({
                      ...prev,
                      [item.key]: {
                        status: 'loading',
                        messageText: `Testing database: ${item.key}`,
                      },
                    }))
                    const result = await appStore.requestDbTestByDatabaseKey(item.key, 5000)
                    setDatabaseTestMessageByKey((prev) => ({
                      ...prev,
                      [item.key]: {
                        status: result?.isSuccess ? 'success' : 'error',
                        messageText: result?.messageText || '',
                      },
                    }))
                    setIsDatabaseTestingByKey((prev) => ({
                      ...prev,
                      [item.key]: false,
                    }))
                    return
                  }
                  if (actionId !== 'switch') {
                    return
                  }
                  await onClickSwitchDatabase(item.key)
                }}
              />
            )
          }) : (
            <div className="frontend-subtitle">No database preset found.</div>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <div className="frontend-title">{appStore.titleText}</div>
      <div className="frontend-subtitle">{appStore.subtitleText}</div>
      {pingMessage.status !== 'idle' ? (
        <div className={`frontend-message-bar status-${pingMessage.status}`}>
          {pingMessage.status === 'loading' ? <SpinningCircle width={12} height={12} /> : null}
          <span>{pingMessage.messageText}</span>
        </div>
      ) : null}
      <div className="frontend-actions">
        <button
          className="frontend-btn"
          type="button"
          onClick={onClickPing}
          disabled={isPanelLocked}
        >
          {appStore.isPingLoading ? <SpinningCircle width={12} height={12} /> : <RefreshIcon width={12} height={12} />}
          <span>Ping</span>
        </button>
        <button className="frontend-btn" type="button" onClick={appStore.requestLoadSpaces} disabled={isPanelLocked}>
          <span>Refresh Spaces</span>
        </button>
        <button className="frontend-btn" type="button" onClick={appStore.clearCache} disabled={isPanelLocked}>
          <span>Clear Cache</span>
        </button>
      </div>
      <DbCheck isLocked={isPanelLocked} />
      <DbReinit isLocked={isPanelLocked} />
      {appStore.errorText ? <div className="frontend-error">{appStore.errorText}</div> : null}
    </>
  )
})

export default ServiceInfo
