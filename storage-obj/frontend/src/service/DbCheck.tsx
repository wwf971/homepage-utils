import { useState } from 'react'
import { SpinningCircle } from '@wwf971/react-comp-misc'
import { appStore } from '../store/appStore'

type DbCheckProps = {
  isLocked: boolean
}

const DbCheck = function DbCheck({
  isLocked,
}: DbCheckProps) {
  const [messageState, setMessageState] = useState({
    status: 'idle',
    messageText: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <div className="db-check-root">
      <div className="frontend-subtitle">Database Check</div>
      <div className="db-check-line">
        <button
          type="button"
          className="frontend-btn"
          disabled={isLocked || isSubmitting}
          onClick={async () => {
            setIsSubmitting(true)
            setMessageState({
              status: 'loading',
              messageText: 'Checking database schema',
            })
            const result = await appStore.requestCheckDatabaseSchema()
            setIsSubmitting(false)
            setMessageState({
              status: result?.isSuccess ? 'success' : 'error',
              messageText: result?.messageText || '',
            })
          }}
        >
          <span>Check DB Tables</span>
        </button>
        <span className="db-check-desc-text">Verify required tables and columns for current database.</span>
      </div>
      {messageState.status !== 'idle' ? (
        <div className={`frontend-message-bar status-${messageState.status === 'loading' ? 'loading' : messageState.status}`}>
          <div className="frontend-message-content">
            <span className="db-reinit-message-main">
              {messageState.status === 'loading' ? <SpinningCircle width={13} height={13} /> : null}
              <span>{messageState.messageText}</span>
            </span>
            {messageState.status !== 'loading' ? (
              <button
                type="button"
                className="frontend-message-dismiss-btn"
                onClick={() => setMessageState({ status: 'idle', messageText: '' })}
              >
                Dismiss
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default DbCheck
