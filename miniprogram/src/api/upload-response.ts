import type { UploadResponse } from '../types'

function decodeJson(data: unknown): unknown {
  if (typeof data !== 'string') return data
  try {
    return JSON.parse(data)
  } catch {
    return undefined
  }
}

export function parseUploadResponse(data: unknown): UploadResponse {
  const decoded = decodeJson(data)
  if (
    !decoded ||
    typeof decoded !== 'object' ||
    typeof (decoded as Record<string, unknown>).id !== 'string'
  ) {
    throw new Error('上传响应格式异常，请稍后再试')
  }
  return decoded as UploadResponse
}

export function uploadErrorMessage(data: unknown): string {
  const decoded = decodeJson(data)
  if (decoded && typeof decoded === 'object') {
    const detail = (decoded as Record<string, unknown>).detail
    if (typeof detail === 'string') return detail
  }
  return '上传失败，请稍后再试'
}
