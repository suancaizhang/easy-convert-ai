import Taro from '@tarojs/taro'
import { clearToken, getToken } from '../utils/storage'

/** 构建期通过 TARO_APP_API_BASE 注入；默认本机联调地址 */
export const API_BASE: string = (process.env.TARO_APP_API_BASE || 'http://127.0.0.1:8111').replace(/\/+$/, '')

const LOGIN_PATH = '/api/auth/wechat/login'

interface RequestOptions {
  path: string
  method?: 'GET' | 'POST' | 'DELETE'
  data?: unknown
}

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const detail = (data as Record<string, unknown>).detail
    if (typeof detail === 'string') return detail
    if (typeof detail === 'object' && detail) {
      const first = Object.values(detail as Record<string, unknown>)[0]
      if (typeof first === 'string') return first
    }
  }
  return fallback
}

export async function request<T>({ path, method = 'GET', data }: RequestOptions): Promise<T> {
  const token = getToken()
  const header: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) header.Authorization = `Bearer ${token}`

  const res = await Taro.request<unknown>({
    url: `${API_BASE}${path}`,
    method,
    data,
    header,
    timeout: 30000,
  })
  if (res.statusCode >= 200 && res.statusCode < 300) return res.data as T

  if (res.statusCode === 401 && path !== LOGIN_PATH) {
    clearToken()
    Taro.reLaunch({ url: '/pages/login/index' })
  }
  throw new Error(errorMessage(res.data, '请求失败，请稍后再试'))
}