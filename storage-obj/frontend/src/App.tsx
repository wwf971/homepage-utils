import { useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { useLocation, useNavigate } from 'react-router-dom'
import { MessageBar, PanelDual } from '@wwf971/react-comp-misc'
import './App.css'
import { appStore, PAGE_KEY } from './store/appStore'
import ResourceTree from './ResourceTree'
import ResourcePanel from './ResourcePanel'

const App = observer(function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    appStore.requestBootstrap()
  }, [])

  useEffect(() => {
    appStore.setCurrentRoutePath(location.pathname, location.search)
  }, [location.pathname, location.search])

  const isBusy = appStore.isSpacesLoading || appStore.isSpaceCreating || appStore.isSpaceDeleting || appStore.isSpaceClearing
  const isPanelLocked = isLocked || isBusy

  const navigateToPage = (pageKey: string, params: { spaceId?: string } = {}) => {
    appStore.setCurrentPageKey(pageKey, params)
    const routePath = appStore.getRoutePathByPageKey(pageKey, params)
    const currentRouteUrl = `${location.pathname}${location.search || ''}`
    if (routePath !== currentRouteUrl) {
      navigate(routePath)
    }
  }

  const handleClickPing = async () => {
    if (isPanelLocked) {
      return
    }
    setIsLocked(true)
    appStore.setGlobalMessage('loading', 'Running ping test')
    const result = await appStore.requestPing()
    appStore.setGlobalMessage(result?.isSuccess ? 'success' : 'error', result?.messageText || '')
    setIsLocked(false)
  }

  const handleClickCreateSpace = async () => {
    if (isPanelLocked) {
      return
    }
    const result = await appStore.requestCreateSpace()
    appStore.setGlobalMessage(result?.isSuccess ? 'success' : 'error', result?.messageText || '')
    navigate(appStore.currentRoutePath)
  }

  const handleClickRefreshDatabases = async () => {
    if (isPanelLocked) {
      return
    }
    const result = await appStore.requestLoadDatabases()
    appStore.setGlobalMessage(result?.isSuccess ? 'success' : 'error', result?.messageText || '')
  }

  const handleClickSwitchDatabase = async (databaseKey: string) => {
    if (isPanelLocked) {
      return
    }
    setIsLocked(true)
    appStore.setGlobalMessage('loading', `Switching database: ${databaseKey}`)
    const result = await appStore.requestSwitchDatabase(databaseKey)
    appStore.setGlobalMessage(result?.isSuccess ? 'success' : 'error', result?.messageText || '')
    setIsLocked(false)
    navigate(appStore.currentRoutePath)
  }

  const handleClickDeleteSpace = async (spaceId: string) => {
    if (isPanelLocked) {
      return {
        isSuccess: false,
        messageText: 'panel is locked',
      }
    }
    const result = await appStore.requestDeleteSpace(spaceId)
    appStore.setGlobalMessage(result?.isSuccess ? 'success' : 'error', result?.messageText || '')
    navigate(appStore.currentRoutePath)
    return result
  }

  const handleClickClearSpace = async (spaceId: string) => {
    if (isPanelLocked) {
      return {
        isSuccess: false,
        messageText: 'panel is locked',
      }
    }
    const result = await appStore.requestClearSpace(spaceId)
    appStore.setGlobalMessage(result?.isSuccess ? 'success' : 'error', result?.messageText || '')
    return result
  }

  const globalMessageContentItems = appStore.isGlobalDbSchemaWarningVisible
    ? [
        { id: 'message', type: 'text' as const, text: appStore.globalDbSchemaWarningText },
        {
          id: 'gotoMetadata',
          type: 'button' as const,
          text: 'Go To Service Metadata',
          eventType: 'gotoMetadataRequest',
        },
      ]
    : undefined

  return (
    <div className="frontend-root">
      <div className="frontend-global-message-wrap">
        <MessageBar
          data={{
            messageState: appStore.globalMessageBarState,
            idleText: 'ready',
            contentItems: globalMessageContentItems,
          }}
          config={{
            isPersistent: true,
            isOneLine: true,
            heightSize: 'sm',
            scrollLeft: appStore.globalMessageScrollLeft,
            isBusy: appStore.isBootstrapping || appStore.isDbSchemaChecking,
          }}
          onEvent={(eventType, eventData) => {
            if (eventType === 'dismissMessageRequest') {
              if (!appStore.isGlobalDbSchemaWarningVisible) {
                appStore.dismissGlobalMessage()
              }
            }
            if (eventType === 'scrollLeftChangeRequest') {
              appStore.setGlobalMessageScrollLeft(Number(eventData?.scrollLeft ?? 0))
            }
            if (eventType === 'gotoMetadataRequest') {
              navigateToPage(PAGE_KEY.metadata)
            }
          }}
        />
      </div>
      <div className="frontend-layout">
        <PanelDual orientation="vertical" initialWidth={260}>
          <div className="frontend-sidebar">
            <ResourceTree onNavigateToPage={navigateToPage} />
          </div>
          <div className={`frontend-main ${isPanelLocked ? 'is-locked' : ''}`}>
            <div className="frontend-main-panel">
              <ResourcePanel
                isPanelLocked={isPanelLocked}
                onClickCreateSpace={handleClickCreateSpace}
                onClickPing={handleClickPing}
                onClickRefreshDatabases={handleClickRefreshDatabases}
                onClickSwitchDatabase={handleClickSwitchDatabase}
                onClickDeleteSpace={handleClickDeleteSpace}
                onClickClearSpace={handleClickClearSpace}
              />
            </div>
          </div>
        </PanelDual>
      </div>
    </div>
  )
})

export default App
