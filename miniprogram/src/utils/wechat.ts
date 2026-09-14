import Taro from '@tarojs/taro'
import { clearToken } from './storage'

export interface PickedFile {
  path: string
  name: string
}

export interface UploadResult {
  statusCode: number
  data: unknown
}

/** wx.login：换取 code 供后端 jscode2session 使用 */
export function wxLogin(): Promise<string> {
  return new Promise((resolve, reject) => {
    Taro.login({
      success: (r) => resolve(r.code),
      fail: () => reject(new Error('微信登录失败，请重试')),
    })
  })
}

/** 相册/拍摄选择图片 */
export function pickImages(count: number): Promise<PickedFile[]> {
  return new Promise((resolve, reject) => {
    Taro.chooseMedia({
      count,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (r) =>
        resolve(
          r.tempFiles.map((f) => ({
            path: f.tempFilePath,
            name: f.tempFilePath.split('/').pop() || 'image',
          })),
        ),
      fail: () => reject(new Error('未选择图片')),
    })
  })
}

/** 从聊天会话选择文件（按扩展名过滤） */
export function pickFiles(count: number, extensions: string[]): Promise<PickedFile[]> {
  return new Promise((resolve, reject) => {
    Taro.chooseMessageFile({
      count,
      type: 'file',
      extension: extensions,
      success: (r) =>
        resolve(
          r.tempFiles.map((f) => ({
            path: (f as { path: string }).path,
            name: (f as { name?: string }).name || 'file',
          })),
        ),
      fail: () => reject(new Error('未选择文件')),
    })
  })
}

export function uploadFile(
  filePath: string,
  url: string,
  header: Record<string, string>,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    Taro.uploadFile({
      url,
      filePath,
      name: 'file',
      header,
      timeout: 60000,
      success: (r) => resolve({ statusCode: r.statusCode, data: r.data }),
      fail: () => reject(new Error('上传失败，请检查网络')),
    })
  })
}

/** 下载任务结果到临时文件，返回临时路径 */
export function downloadFile(
  url: string,
  header: Record<string, string>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    Taro.downloadFile({
      url,
      header,
      timeout: 60000,
      success: (r) => {
        if (r.statusCode >= 200 && r.statusCode < 300) {
          resolve(r.tempFilePath)
          return
        }
        if (r.statusCode === 401) {
          clearToken()
          Taro.reLaunch({ url: '/pages/login/index' })
          reject(new Error('登录已过期，请重新登录'))
          return
        }
        reject(new Error(`下载失败（HTTP ${r.statusCode}）`))
      },
      fail: () => reject(new Error('下载失败，请重试')),
    })
  })
}

/** 用系统查看器打开本地文档（右上角菜单可转发/保存） */
export function openDocument(filePath: string, fileType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    Taro.openDocument({
      filePath,
      fileType: fileType as never,
      showMenu: true,
      success: () => resolve(),
      fail: () => reject(new Error('无法打开该文件')),
    })
  })
}

/** 读取文本文件结果内容 */
export function readTextFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fs = Taro.getFileSystemManager()
    fs.readFile({
      filePath,
      encoding: 'utf8',
      success: (r) => resolve(String(r.data)),
      fail: () => reject(new Error('读取文件失败')),
    })
  })
}

/** 预览本地图片列表 */
export function previewImages(urls: string[], current?: number): Promise<void> {
  return new Promise((resolve, reject) => {
    Taro.previewImage({
      urls,
      current: current != null ? urls[current] : undefined,
      success: () => resolve(),
      fail: () => reject(new Error('图片预览失败')),
    })
  })
}