export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface UploadResponse {
  id: string
  filename: string
  file_type: string
  file_size: number
  status: string
}

export interface TaskResponse {
  id: string
  task_type: string
  status: string
  error_message: string | null
  error_code: string | null
}

export interface TaskStatus extends TaskResponse {
  progress: number | null
  progress_current: number | null
  progress_total: number | null
}

export interface HistoryItem {
  id: string
  filename: string
  file_type: string
  file_size: number
  status: string
  file_status: string
  created_at: string
  task_type: string | null
  task_status: string | null
  task_id: string | null
}

export interface HistoryResponse {
  items: HistoryItem[]
  total: number
  page: number
  page_size: number
}

export interface QuotaStatus {
  used: number
  total: number
  remaining: number
}

export interface PagesInfo {
  total: number
  ext: string
}

export type TaskStatusName = 'waiting' | 'processing' | 'success' | 'failed'