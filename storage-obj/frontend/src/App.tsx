import { useEffect, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { appStore, PAGE_KEY } from './store/appStore'
import ResourceTree from './ResourceTree'
import ResourcePanel from './ResourcePanel'

const App = observer(() => {
  const navigate = useNavigate()
  const location = useLocation()
  const [isLocked, setIsLocked] = useState(false)
  const [pingMessage, setPingMessage] = useState({
    status: 'idle',
    messageText: '',
  })

  useEffect(() => {
    appStore.requestBootstrap()
  }, [])

  useEffect(() => {
    appStore.setCurrentRoutePath(location.pathname, location.search)
  }, [location.pathname, location.search])

  const isBusy = appStore.isSpacesLoading || appStore.isSpaceCreating || appStore.isSpaceDeleting || appStore.isSpaceClearing
  const isPanelLocked = isLocked || isBusy
  const handleClickPing = async () => {
    if (isPanelLocked) {
      return
    }
    setIsLocked(true)
    setPingMessage({
      status: 'loading',
      messageText: 'Running ping test',
    })
    const result = await appStore.requestPing()
    setPingMessage({
      status: result?.isSuccess ? 'success' : 'error',
      messageText: result?.messageText || '',
    })
    setIsLocked(false)
  }

  const handleClickCreateSpace = async () => {
    if (isPanelLocked) {
      return
    }
    const result = await appStore.requestCreateSpace()
    setPingMessage({
      status: result?.isSuccess ? 'success' : 'error',
      messageText: result?.messageText || '',
    })
    navigate(appStore.currentRoutePath)
  }

  const handleClickRefreshDatabases = async () => {
    if (isPanelLocked) {
      return
    }
    const result = await appStore.requestLoadDatabases()
    setPingMessage({
      status: result?.isSuccess ? 'success' : 'error',
      messageText: result?.messageText || '',
    })
  }

  const handleClickSwitchDatabase = async (databaseKey: string) => {
    if (isPanelLocked) {
      return
    }
    setIsLocked(true)
    setPingMessage({
      status: 'loading',
      messageText: `Switching database: ${databaseKey}`,
    })
    const result = await appStore.requestSwitchDatabase(databaseKey)
    setPingMessage({
      status: result?.isSuccess ? 'success' : 'error',
      messageText: result?.messageText || '',
    })
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
    setPingMessage({
      status: result?.isSuccess ? 'success' : 'error',
      messageText: result?.messageText || '',
    })
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
    setPingMessage({
      status: result?.isSuccess ? 'success' : 'error',
      messageText: result?.messageText || '',
    })
    return result
  }

  const navigateToPage = (pageKey: string, params: { spaceId?: string } = {}) => {
    appStore.setCurrentPageKey(pageKey, params)
    const routePath = appStore.getRoutePathByPageKey(pageKey, params)
    const currentRouteUrl = `${location.pathname}${location.search || ''}`
    if (routePath !== currentRouteUrl) {
      navigate(routePath)
    }
  }

  return (
    <div className="frontend-root">
      {appStore.isGlobalDbSchemaWarningVisible ? (
        <div className="frontend-global-warning-wrap">
          <div className="frontend-global-warning-bar">
            <span>{appStore.globalDbSchemaWarningText}</span>
            <button
              type="button"
              className="frontend-message-dismiss-btn"
              onClick={() => {
                navigateToPage(PAGE_KEY.metadata)
              }}
            >
              Go To Service Metadata
            </button>
          </div>
        </div>
      ) : null}
      <div className="frontend-layout">
        <aside className="frontend-sidebar">
          <ResourceTree onNavigateToPage={navigateToPage} />
        </aside>
        <section className={`frontend-main ${isPanelLocked ? 'is-locked' : ''}`}>
          <div className="frontend-main-panel">
            <ResourcePanel
              pingMessage={pingMessage}
              isPanelLocked={isPanelLocked}
              onClickCreateSpace={handleClickCreateSpace}
              onClickPing={handleClickPing}
              onClickRefreshDatabases={handleClickRefreshDatabases}
              onClickSwitchDatabase={handleClickSwitchDatabase}
              onClickDeleteSpace={handleClickDeleteSpace}
              onClickClearSpace={handleClickClearSpace}
            />
          </div>
        </section>
      </div>
    </div>
  )
})

export default App
