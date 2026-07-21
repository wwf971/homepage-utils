import { useCallback, useEffect, useMemo, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { EditableValueComp, InfoIconWithTooltip, KeyValues, SelectableValueComp } from '@wwf971/react-comp-misc'
import { objectStore, type ObjectPayloadType } from './objectStore'
import { computeObjectContentByteSize, formatObjectContentByteSize } from './objectContentSize'

type ObjectCardProps = {
  spaceId: string
  dataType: ObjectPayloadType
  onRequestSave: (input: { type?: number; editType?: number; valueText?: string; valueJsonText?: string; valueBase64?: string }) => Promise<void> | void
}

const OBJECT_TYPE_MIN = -2147483648
const OBJECT_TYPE_MAX = 2147483647

const EDIT_TYPE_OPTIONS = [
  {
    value: '0',
    label: 'UPDATE-ONLY(0)',
    description: 'Always append next version. In-version write is rejected.',
    compName: 'editTypeOption',
  },
  {
    value: '1',
    label: 'UPDATE-AND-EDIT(1)',
    description: 'Can append next version or rewrite current version.',
    compName: 'editTypeOption',
  },
  {
    value: '2',
    label: 'EDIT-ONLY(2)',
    description: 'Always rewrite current version. Append is rejected.',
    compName: 'editTypeOption',
  },
]

const EditTypeOptionComp = ({ data }: { data: { label?: string; description?: string } }) => {
  return (
    <span className="object-card-edit-type-option">
      <span className="object-card-edit-type-option-label">{data?.label || ''}</span>
      <InfoIconWithTooltip tooltipText={data?.description || ''} width={12} height={12} />
    </span>
  )
}

const ObjectCard = observer(function ObjectCard({
  spaceId,
  dataType,
  onRequestSave,
}: ObjectCardProps) {
  const typeState = objectStore.getSpaceTypeState(spaceId, dataType)!
  const [valueTextInput, setValueTextInput] = useState('')
  const [valueBase64Input, setValueBase64Input] = useState('')
  const [valueJsonTextInput, setValueJsonTextInput] = useState('{}')
  const [typeInputText, setTypeInputText] = useState('-1')
  const [typeErrorText, setTypeErrorText] = useState('')
  const [editTypeInputText, setEditTypeInputText] = useState('0')
  const editingObject = typeState.cardMode === 'edit'
    ? typeState.objectDataById[typeState.cardObjectId] || null
    : null
  useEffect(() => {
    if (typeState.cardMode === 'create') {
      setTypeErrorText('')
      setTypeInputText('-1')
      setEditTypeInputText('0')
      setValueTextInput('')
      setValueBase64Input('')
      setValueJsonTextInput('{}')
      return
    }
    setTypeInputText(String(Number.isFinite(Number(editingObject?.type)) ? Number(editingObject?.type) : -1))
    setTypeErrorText('')
    setEditTypeInputText(String(Number.isFinite(Number(editingObject?.editType)) ? Number(editingObject?.editType) : 0))
    setValueTextInput(String(editingObject?.valueText || ''))
    setValueBase64Input(String(editingObject?.valueBase64 || ''))
    setValueJsonTextInput(editingObject?.valueJson === undefined
      ? '{}'
      : JSON.stringify(editingObject.valueJson, null, 2))
  }, [typeState.cardMode, typeState.cardObjectId, editingObject?.type, editingObject?.editType, editingObject?.valueBase64, editingObject?.valueJson, editingObject?.valueText])

  const isSubmitting = typeState.isCreateOrEditSubmitting
  const contentByteSize = computeObjectContentByteSize(dataType, {
    valueText: valueTextInput,
    valueBase64: valueBase64Input,
    valueJsonText: valueJsonTextInput,
  })
  const contentSizeText = formatObjectContentByteSize(contentByteSize)
  const parseTypeInput = (rawValue: string) => {
    const normalizedText = String(rawValue || '').trim()
    if (!/^-?\d+$/.test(normalizedText)) {
      return {
        isValid: false,
        messageText: 'type should be an integer',
      }
    }
    const parsedValue = Number(normalizedText)
    if (!Number.isFinite(parsedValue)) {
      return {
        isValid: false,
        messageText: 'type should be an integer',
      }
    }
    if (parsedValue < OBJECT_TYPE_MIN || parsedValue > OBJECT_TYPE_MAX) {
      return {
        isValid: false,
        messageText: `type should be within ${OBJECT_TYPE_MIN}..${OBJECT_TYPE_MAX}`,
      }
    }
    return {
      isValid: true,
      value: Math.floor(parsedValue),
      messageText: '',
    }
  }

  const ObjectCardKeyWithInfoComp = ({ data, itemRef }: { data: unknown; itemRef?: { tooltipText?: string } }) => (
    <span className="object-card-kv-key">
      <span>{String(data ?? '')}</span>
      {itemRef?.tooltipText ? (
        <InfoIconWithTooltip tooltipText={itemRef.tooltipText} width={12} height={12} />
      ) : null}
    </span>
  )

  const ObjectCardReadOnlyValueComp = ({ data }: { data: unknown }) => (
    <span className="object-card-kv-value">{String(data ?? '')}</span>
  )

  const ObjectCardIdValueComp = ({ data, itemRef }: { data: unknown; itemRef?: { isGeneratedId?: boolean } }) => (
    <span className={`object-card-kv-value ${itemRef?.isGeneratedId ? 'object-card-id-value' : ''}`}>
      {String(data ?? '')}
    </span>
  )

  const ObjectCardTypeValueComp = ({ data }: { data: unknown }) => (
    <EditableValueComp
      data={String(data ?? '')}
      configKey="object.type"
      isEditable={!isSubmitting}
      onUpdate={async (_configKey: string, nextValue: string) => {
        const parsed = parseTypeInput(nextValue)
        if (!parsed.isValid) {
          setTypeErrorText(parsed.messageText)
          return { code: -1, message: parsed.messageText }
        }
        setTypeErrorText('')
        setTypeInputText(String(parsed.value))
        return { code: 0 }
      }}
    />
  )

  const ObjectCardEditTypeValueComp = ({ data }: { data: unknown }) => (
    <SelectableValueComp
      data={String(data ?? '0')}
      configKey="object.editType"
      onUpdate={async (_configKey: string, nextValue: string) => {
        setEditTypeInputText(String(nextValue || '0'))
        return { code: 0 }
      }}
      options={EDIT_TYPE_OPTIONS}
      getComp={(compName: string) => (compName === 'editTypeOption' ? EditTypeOptionComp : null)}
    />
  )

  const ObjectCardEditTypeReadOnlyComp = ({ data }: { data: unknown }) => {
    const selectedEditTypeOption = EDIT_TYPE_OPTIONS.find((item) => item.value === String(data)) || EDIT_TYPE_OPTIONS[0]
    return (
      <span className="object-card-edit-type-readonly">
        <span className="object-card-edit-type-option-label">{selectedEditTypeOption.label}</span>
        <InfoIconWithTooltip tooltipText="Updating editType by API is not supported yet." width={12} height={12} />
      </span>
    )
  }

  const resolveObjectCardComp = useCallback((compName: string) => {
    if (compName === 'keyWithInfo') {
      return ObjectCardKeyWithInfoComp
    }
    if (compName === 'readOnlyValue') {
      return ObjectCardReadOnlyValueComp
    }
    if (compName === 'objectIdValue') {
      return ObjectCardIdValueComp
    }
    if (compName === 'objectType') {
      return ObjectCardTypeValueComp
    }
    if (compName === 'objectEditType') {
      return ObjectCardEditTypeValueComp
    }
    if (compName === 'objectEditTypeReadOnly') {
      return ObjectCardEditTypeReadOnlyComp
    }
    return null
  }, [isSubmitting])

  const infoRows = useMemo(() => [
    { key: 'spaceId', value: spaceId, valueCompName: 'readOnlyValue' },
    { key: 'dataType', value: dataType, valueCompName: 'readOnlyValue' },
    {
      key: 'objectId',
      value: typeState.cardMode === 'create' ? 'generated by backend' : typeState.cardObjectId,
      valueCompName: 'objectIdValue',
      isGeneratedId: typeState.cardMode === 'create',
    },
    { key: 'size', value: contentSizeText, valueCompName: 'readOnlyValue' },
    {
      key: 'type',
      value: typeInputText,
      keyCompName: 'keyWithInfo',
      valueCompName: 'objectType',
      tooltipText: 'Semantic object type code, used by client logic.',
    },
    {
      key: 'editType',
      value: editTypeInputText,
      keyCompName: 'keyWithInfo',
      valueCompName: typeState.cardMode === 'create' ? 'objectEditType' : 'objectEditTypeReadOnly',
      tooltipText: 'Object write strategy: append-only, mixed mode, or edit-only.',
    },
  ], [
    spaceId,
    dataType,
    typeState.cardMode,
    typeState.cardObjectId,
    contentSizeText,
    typeInputText,
    editTypeInputText,
  ])

  if (!typeState.isCardVisible) {
    return null
  }

  return (
    <div className="object-card-overlay" onClick={() => objectStore.closeCard(spaceId, dataType)}>
      <div className="object-card-root" onClick={(event) => event.stopPropagation()}>
        <div className="object-card-title-row">
          <span className="frontend-title">{typeState.cardMode === 'create' ? 'Create Object' : 'Edit Object'}</span>
        </div>
        <div className="frontend-kv">
          <KeyValues
            data={{ rows: infoRows }}
            config={{
              isEditable: false,
              keyColWidth: '120px',
              compResolveFn: resolveObjectCardComp,
            }}
          />
        </div>
        {typeErrorText ? <div className="frontend-error">{typeErrorText}</div> : null}
        {dataType === 'text' ? (
          <textarea
            className="object-card-textarea"
            value={valueTextInput}
            onChange={(event) => setValueTextInput(event.target.value)}
            disabled={isSubmitting}
          />
        ) : null}
        {dataType === 'bytes' ? (
          <textarea
            className="object-card-textarea"
            value={valueBase64Input}
            onChange={(event) => setValueBase64Input(event.target.value)}
            disabled={isSubmitting}
          />
        ) : null}
        {dataType === 'json' ? (
          <textarea
            className="object-card-textarea object-card-textarea-json"
            value={valueJsonTextInput}
            onChange={(event) => setValueJsonTextInput(event.target.value)}
            disabled={isSubmitting}
          />
        ) : null}
        <div className="frontend-actions">
          <button
            type="button"
            className="frontend-btn"
            disabled={isSubmitting}
            onClick={() => objectStore.closeCard(spaceId, dataType)}
          >
            <span>Cancel</span>
          </button>
          <button
            type="button"
            className="frontend-btn"
            disabled={isSubmitting}
            onClick={() => {
              const parsed = parseTypeInput(typeInputText)
              if (!parsed.isValid) {
                setTypeErrorText(parsed.messageText)
                return
              }
              setTypeErrorText('')
              onRequestSave({
                type: parsed.value,
                editType: Number.isFinite(Number(editTypeInputText)) ? Math.floor(Number(editTypeInputText)) : 0,
                valueText: valueTextInput,
                valueBase64: valueBase64Input,
                valueJsonText: valueJsonTextInput,
              })
            }}
          >
            <span>{isSubmitting ? 'Submitting' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  )
})

export default ObjectCard
