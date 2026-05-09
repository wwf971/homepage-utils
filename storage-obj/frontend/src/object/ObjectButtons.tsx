import { observer } from 'mobx-react-lite'
import { objectStore, type ObjectPayloadType } from './objectStore'

type ObjectButtonsProps = {
  spaceId: string
  dataType: ObjectPayloadType
  isLocked: boolean
  onRequestDelete: () => Promise<void> | void
}

const ObjectButtons = observer(function ObjectButtons({
  spaceId,
  dataType,
  isLocked,
  onRequestDelete,
}: ObjectButtonsProps) {
  const typeState = objectStore.getSpaceTypeState(spaceId, dataType)
  if (!typeState) {
    return null
  }
  const selectedObjectNum = typeState.selectedObjectIdList.length
  return (
    <div className="frontend-actions object-buttons-root">
      <button
        type="button"
        className="frontend-btn"
        disabled={isLocked}
        onClick={() => objectStore.openCreateCard(spaceId, dataType)}
      >
        <span>Create</span>
      </button>
      <button
        type="button"
        className="frontend-btn is-danger"
        disabled={isLocked || selectedObjectNum <= 0}
        onClick={() => onRequestDelete()}
      >
        <span>Delete Selected ({selectedObjectNum})</span>
      </button>
    </div>
  )
})

export default ObjectButtons
