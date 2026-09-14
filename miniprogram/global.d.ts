declare module '*.scss'
declare module '*.css'
declare module '*.png'
declare module '*.jpg'
declare module '*.jpeg'
declare module '*.webp'

declare namespace NodeJS {
  interface ProcessEnv {
    /** 小程序构建时可注入的后端地址，如 https://api.example.com */
    TARO_APP_API_BASE?: string
  }
}