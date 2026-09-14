import { useEffect, useRef, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'
import { downloadTaskFile, taskPages, taskStatus } from '../../api'
import { STATUS_TEXT, TASK_LABEL } from '../../conversions'
import { openDocument, previewImages, readTextFile } from '../../utils/wechat'
import type { PagesInfo, TaskStatus } from '../../types'
import './index.scss'

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp']
const TEXT_EXTS = ['txt', 'md', 'csv']
const POLL_INTERVAL = 3000

export default function Result() {
  const router = useRouter()
  const taskId = (router.params.id || '') as string
  const [status, setStatus] = useState<TaskStatus | null>(null)
  const [pages, setPages] = useState<PagesInfo | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const timer = useRef<NodeJS.Timeout>()

  useEffect(() => {
    let alive = true

    const tick = async () => {
      let finished = false
      try {
        const s = await taskStatus(taskId)
        if (!alive) return
        setStatus(s)
        if (s.status === 'success') {
          const p = await taskPages(taskId)
          if (!alive) return
          setPages(p)
          finished = true
        } else if (s.status === 'failed') {
          finished = true
        }
      } catch (e) {
        if (alive) Taro.showToast({ title: (e as Error).message, icon: 'none' })
      }
      if (alive && !finished) {
        timer.current = setTimeout(tick, POLL_INTERVAL)
      }
    }

    tick()
    return () => {
      alive = false
      clearTimeout(timer.current)
    }
  }, [taskId])

  const renderText = async (pageIndex?: number) => {
    const tmp = await downloadTaskFile(taskId, pageIndex)
    setText(await readTextFile(tmp))
  }

  const renderImages = async (pageIndex?: number) => {
    const urls: string[] = []
    const total = pages?.total || 1
    for (let i = 0; i < total; i++) urls.push(await downloadTaskFile(taskId, i))
    await previewImages(urls, pageIndex)
  }

  const renderDocument = async (pageIndex?: number) => {
    const tmp = await downloadTaskFile(taskId, pageIndex)
    const ext = pages?.ext || ''
    await openDocument(tmp, ext)
  }

  const openOutput = async (pageIndex?: number) => {
    if (busy || !pages) return
    setBusy(true)
    try {
      const ext = pages.ext
      if (TEXT_EXTS.includes(ext)) await renderText(pageIndex)
      else if (IMAGE_EXTS.includes(ext)) await renderImages(pageIndex)
      else await renderDocument(pageIndex)
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className='page'>
      {!status ? (
        <Text className='empty'>加载中…</Text>
      ) : (
        <View className='card status-card'>
          <Text className='status-label'>
            {status.task_type ? TASK_LABEL[status.task_type] || status.task_type : ''}
          </Text>
          <Text className={`status-value status-${status.status}`}>
            {STATUS_TEXT[status.status] || status.status}
          </Text>
          {status.status === 'processing' || status.status === 'waiting' ? (
            <Text className='status-hint'>转换中，请稍候…（可稍后到“历史”查看）</Text>
          ) : null}
          {status.status === 'failed' ? (
            <Text className='status-error'>
              {status.error_code ? `[${status.error_code}] ` : ''}
              {status.error_message || '处理失败'}
            </Text>
          ) : null}
        </View>
      )}

      {pages && (
        <View className='card actions'>
          <Button className='btn-primary btn-block' loading={busy} onClick={() => openOutput()}>
            {IMAGE_EXTS.includes(pages.ext) ? '预览结果图片' : '打开结果文档'}
          </Button>
          {pages.total > 0 && <Text className='pages-hint'>共 {pages.total} 个输出文件</Text>}
          {pages.total > 1 && (
            <View className='page-list'>
              {Array.from({ length: pages.total }, (_, i) => (
                <View key={i} className='page-item' onClick={() => openOutput(i)}>
                  <Text>第 {i + 1} 个 · 查看</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {text ? (
        <View className='card text-card'>
          <Text selectable className='text-body'>
            {text}
          </Text>
          <Button
            className='btn-go'
            onClick={() => Taro.setClipboardData({ data: text })}
          >
            复制全文
          </Button>
        </View>
      ) : null}

      <Button className='btn-home' onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
        返回首页继续转换
      </Button>
    </View>
  )
}