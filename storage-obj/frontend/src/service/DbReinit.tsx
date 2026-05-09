import { useState } from 'react'
import { SpinningCircle } from '@wwf971/react-comp-misc'
import * as ReactCompMisc from '@wwf971/react-comp-misc'
import { appStore } from '../store/appStore'

type DbReinitProps = {
  isLocked: boolean
}

const PanelPopupComp = (ReactCompMisc as any).PanelPopup

const DbReinit = function DbReinit({
  isLocked,
}: DbReinitProps) {
  const [isConfirmVisible, setIsConfirmVisible] = useState(false)
  const [isIncludeExampleData, setIsIncludeExampleData] = useState(true)
  const [messageState, setMessageState] = useState({
    status: 'idle',
    messageText: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <div className="db-reinit-root">
      <div className="frontend-subtitle">Database Re-Initialize</div>
      <div className="db-reinit-line">
        <button
          type="button"
          className="frontend-btn is-danger"
          disabled={isLocked || isSubmitting}
          onClick={() => setIsConfirmVisible(true)}
        >
          <span>Re-Init Tables</span>
        </button>
        <label className="db-reinit-check-wrap">
          <input
            type="checkbox"
            checked={isIncludeExampleData}
            disabled={isLocked || isSubmitting}
            onChange={(event) => setIsIncludeExampleData(event.target.checked)}
          />
          <span>Init example data too</span>
        </label>
        <span className="db-reinit-desc-text">Run init SQL scripts and reset all spaces/object tables.</span>
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
      {isConfirmVisible ? (
        <PanelPopupComp
          type="confirm"
          title="Confirm Re-Init"
          message={isIncludeExampleData
            ? 'Run init_db.sql and init_data_example.sql on current database?'
            : 'Run init_db.sql only on current database?'}
          confirmText="Re-Init"
          cancelText="Cancel"
          isDanger={true}
          onCancel={() => setIsConfirmVisible(false)}
          onConfirm={async () => {
            setIsConfirmVisible(false)
            setIsSubmitting(true)
            setMessageState({
              status: 'loading',
              messageText: 'Submitting re-init request',
            })
            const result = await appStore.requestReinitDatabase(isIncludeExampleData)
            setIsSubmitting(false)
            setMessageState({
              status: result?.isSuccess ? 'success' : result?.isPartialSuccess ? 'error' : 'error',
              messageText: result?.messageText || '',
            })
          }}
        />
      ) : null}
    </div>
  )
}

export default DbReinit
