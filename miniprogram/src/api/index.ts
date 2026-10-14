import { API_BASE, request } from './client'
import { getToken, handleUnauthorized } from '../utils/storage'
import { downloadFile, uploadFile } from '../utils/wechat'
import { parseUploadResponse, uploadErrorMessage } from './upload-response'
import type {
  HistoryResponse,
  PagesInfo,
  QuotaStatus,
  TaskResponse,
  TaskStatus,
  TokenResponse,
  UploadResponse,
} from '../types'

export function wechatLogin(code: string, avatar?: string): Promise<TokenResponse> {
  return request<TokenResponse>({
    path: '/api/auth/wechat/login',
    method: 'POST',
    data: { code, avatar },
  })
}

export function fetchQuota(): Promise<QuotaStatus> {
  return request<QuotaStatus>({ path: '/api/quota/status' })
}

export async function uploadDocument(filePath: string): Promise<UploadResponse> {
  const url = `${API_BASE}/api/documents/upload`
  const res = await uploadFile(filePath, url, {
    Authorization: `Bearer ${getToken() || ''}`,
  })
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return parseUploadResponse(res.data)
  }
  handleUnauthorized(res.statusCode)
  throw new Error(uploadErrorMessage(res.data))
}

export interface CreateTaskBody {
  document_id: string
  task_type: string
  source_document_ids?: string[]
  params?: Record<string, string | number>
}

export function createTask(body: CreateTaskBody): Promise<TaskResponse> {
  return request<TaskResponse>({ path: '/api/tasks/create', method: 'POST', data: body })
}

export function taskStatus(taskId: string): Promise<TaskStatus> {
  return request<TaskStatus>({ path: `/api/tasks/${taskId}/status` })
}

export function taskPages(taskId: string): Promise<PagesInfo> {
  return request<PagesInfo>({ path: `/api/tasks/${taskId}/pages` })
}

export function fetchHistory(page = 1, pageSize = 20): Promise<HistoryResponse> {
  return request<HistoryResponse>({
    path: `/api/documents/history?page=${page}&page_size=${pageSize}`,
  })
}

export function deleteDocument(documentId: string): Promise<void> {
  return request<void>({ path: `/api/documents/${documentId}`, method: 'DELETE' })
}

/** 下载任务结果到本地临时文件，返回临时路径；pageIndex 省略时取第一个输出。 */
export async function downloadTaskFile(taskId: string, pageIndex?: number): Promise<string> {
  const suffix = pageIndex != null ? `/${pageIndex}` : ''
  const url = `${API_BASE}/api/tasks/${taskId}/download${suffix}`
  return downloadFile(url, { Authorization: `Bearer ${getToken() || ''}` })
}

export type TaskType =
  | 'pdf_to_word'
  | 'word_to_pdf'
  | 'excel_to_pdf'
  | 'ppt_to_pdf'
  | 'pdf_to_image'
  | 'images_to_pdf'
  | 'ocr_to_word'
  | 'pdf_merge'
  | 'pdf_split'
  | 'pdf_compress'
  | 'pdf_rotate'
  | 'pdf_watermark'