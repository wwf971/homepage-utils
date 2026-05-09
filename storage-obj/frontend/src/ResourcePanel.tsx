import { Navigate, useLocation } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { KeyValues } from '@wwf971/react-comp-misc'
import ServiceInfo from './service/ServiceInfo'
import SpaceInfo from './space/SpaceInfo'
import ObjectPanel from './object/ObjectPanel'
import { appStore, PAGE_KEY } from './store/appStore'

type ResourcePanelProps = {
  pingMessage: { status: string; messageText: string }
  isPanelLocked: boolean
  onClickCreateSpace: () => Promise<void> | void
  onClickPing: () => void
  onClickRefreshDatabases: () => Promise<void> | void
  onClickSwitchDatabase: (databaseKey: string) => Promise<void> | void
  onClickDeleteSpace: (spaceId: string) => Promise<{
    isSuccess: boolean
    messageText: string
  }>
  onClickClearSpace: (spaceId: string) => Promise<{
    isSuccess: boolean
    messageText: string
  }>
}

const ResourcePanel = observer(function ResourcePanel({
  pingMessage,
  isPanelLocked,
  onClickCreateSpace,
  onClickPing,
  onClickRefreshDatabases,
  onClickSwitchDatabase,
  onClickDeleteSpace,
  onClickClearSpace,
}: ResourcePanelProps) {
  const SpaceOverviewPanel = () => (
    <>
      <div className="frontend-title">OverView</div>
      <div className="frontend-subtitle">Create new spaces and view overall counts.</div>
      <div className="frontend-actions">
        <button className="frontend-btn" type="button" onClick={onClickCreateSpace} disabled={isPanelLocked}>
          <span>Create Space</span>
        </button>
      </div>
      <div className="frontend-kv">
        <KeyValues
          data={[
            { key: 'spaceNum', value: String(appStore.spaces.length) },
          ]}
          isEditable={false}
        />
      </div>
    </>
  )

  const location = useLocation()
  const selectedTreeItemId = appStore.selectedTreeItemId
  const searchParams = new URLSearchParams(location.search || '')
  const spaceIdFromUrl = String(searchParams.get('spaceId') || '').trim()
  const isKnownPath = [
    '/service/metadata',
    '/service/basic-info',
    '/service/database',
    '/spaces',
    '/',
  ].includes(location.pathname)

  if (!isKnownPath) {
    return <Navigate to="/service/metadata" replace />
  }
  if (location.pathname === '/') {
    return <Navigate to={appStore.getRoutePathByPageKey(appStore.currentPageKey)} replace />
  }

  if (location.pathname === '/service/metadata') {
    return (
      <ServiceInfo
        mode="metadata"
        pingMessage={pingMessage}
        isPanelLocked={isPanelLocked}
        onClickPing={onClickPing}
        onClickRefreshDatabases={onClickRefreshDatabases}
        onClickSwitchDatabase={onClickSwitchDatabase}
      />
    )
  }
  if (location.pathname === '/service/basic-info') {
    return (
      <ServiceInfo
        mode="basic-info"
        pingMessage={pingMessage}
        isPanelLocked={isPanelLocked}
        onClickPing={onClickPing}
        onClickRefreshDatabases={onClickRefreshDatabases}
        onClickSwitchDatabase={onClickSwitchDatabase}
      />
    )
  }
  if (location.pathname === '/service/database') {
    return (
      <ServiceInfo
        mode="database"
        pingMessage={pingMessage}
        isPanelLocked={isPanelLocked}
        onClickPing={onClickPing}
        onClickRefreshDatabases={onClickRefreshDatabases}
        onClickSwitchDatabase={onClickSwitchDatabase}
      />
    )
  }

  if (location.pathname === '/spaces') {
    const isSpaceMetadataSelected = appStore.currentPageKey === PAGE_KEY.spaceMetadata
    const isSpaceObjectsSelected = appStore.currentPageKey === PAGE_KEY.spaceObjects
    const isSpacePanelSelected = isSpaceMetadataSelected || isSpaceObjectsSelected || selectedTreeItemId.startsWith('space:')
    if (isSpacePanelSelected) {
      if (isSpaceObjectsSelected || selectedTreeItemId.endsWith(':objects')) {
        return (
          <ObjectPanel spaceId={spaceIdFromUrl || appStore.selectedSpaceId} />
        )
      }
      return (
        <SpaceInfo
          spaceId={spaceIdFromUrl || appStore.selectedSpaceId}
          isLocked={isPanelLocked}
          onDeleteSpace={onClickDeleteSpace}
          onClearSpace={onClickClearSpace}
        />
      )
    }
    return <SpaceOverviewPanel />
  }

  return <Navigate to="/service/metadata" replace />
})

export default ResourcePanel
