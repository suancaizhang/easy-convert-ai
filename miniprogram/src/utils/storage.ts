import Taro from '@tarojs/taro'

const TOKEN_KEY = 'easy_convert_token'

export function getToken(): string | null {
  return Taro.getStorageSync<string>(TOKEN_KEY) || null
}

export function setToken(token: string): void {
  Taro.setStorageSync(TOKEN_KEY, token)
}

export function clearToken(): void {
  Taro.removeStorageSync(TOKEN_KEY)
}

/** All authenticated transports share the same expired-session behavior. */
export function handleUnauthorized(statusCode: number): void {
  if (statusCode !== 401) return
  clearToken()
  void Taro.reLaunch({ url: '/pages/login/index' })
}