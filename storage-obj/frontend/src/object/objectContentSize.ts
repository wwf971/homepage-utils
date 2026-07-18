import type { ObjectPayloadType } from './objectStore'

type ObjectContentInput = {
  valueText?: string
  valueBase64?: string
  valueJson?: unknown
  valueJsonText?: string
}

function decodeBase64ByteLength(base64Text: string) {
  const normalizedText = String(base64Text || '').trim()
  if (!normalizedText) {
    return 0
  }
  try {
    return atob(normalizedText).length
  } catch (_error) {
    return 0
  }
}

function encodeUtf8ByteLength(text: string) {
  return new TextEncoder().encode(text).length
}

export function computeObjectContentByteSize(
  dataType: ObjectPayloadType,
  input: ObjectContentInput,
) {
  if (dataType === 'text') {
    return encodeUtf8ByteLength(String(input.valueText || ''))
  }
  if (dataType === 'bytes') {
    return decodeBase64ByteLength(String(input.valueBase64 || ''))
  }
  if (input.valueJsonText !== undefined) {
    return encodeUtf8ByteLength(String(input.valueJsonText || ''))
  }
  try {
    return encodeUtf8ByteLength(JSON.stringify(input.valueJson ?? null))
  } catch (_error) {
    return 0
  }
}

export function formatObjectContentByteSize(byteSizeRaw: number) {
  const byteSize = Number.isFinite(byteSizeRaw) ? Math.max(0, Math.floor(byteSizeRaw)) : 0
  const kbUnit = 1024
  const mbUnit = kbUnit * 1024
  const gbUnit = mbUnit * 1024
  if (byteSize < kbUnit) {
    return `${byteSize}B`
  }
  if (byteSize < mbUnit) {
    return `${Math.floor(byteSize / kbUnit)}KB`
  }
  if (byteSize < gbUnit) {
    return `${(byteSize / mbUnit).toFixed(1)}MB`
  }
  return `${(byteSize / gbUnit).toFixed(2)}GB`
}
