import { useCallback, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'
import { deleteDocument, fetchHistory } from '../../api'
import { STATUS_TEXT, TASK_LABEL } from '../../conversions'
import type { HistoryItem } from '../../types'
import './index.scss'

export default function History() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetchHistory(1, 50)
      .then((r) => setItems(r.items))
      .catch(() => Taro.showToast({ title: '加载失败', icon: 'none' }))
      .finally(() => setLoading(false))
  }, [])

  useDidShow(load)

  const openItem = (it: HistoryItem) => {
    if (!it.task_id) {
      Taro.showToast({ title: '该记录暂无处理任务', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: `/pages/result/index?id=${it.task_id}` })
  }

  const removeItem = async (it: HistoryItem) => {
    try {
      await deleteDocument(it.id)
      load()
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    }
  }

  const formatTime = (iso: string) => (iso ? iso.replace('T', ' ').slice(0, 16) : '')

  return (
    <View className='page'>
      {loading && items.length === 0 ? (
        <Text className='empty'>加载中…</Text>
      ) : items.length === 0 ? (
        <View className='empty-wrap'>
          <Text className='empty'>还没有转换记录</Text>
          <Button className='btn-primary btn-go-home' onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
            去转换
          </Button>
        </View>
      ) : (
        items.map((it) => (
          <View key={it.id} className='card row' onClick={() => openItem(it)}>
            <View className='row-main'>
              <Text className='row-name'>{it.filename}</Text>
              <Text className='row-meta'>
                {it.file_type} · {it.task_type ? TASK_LABEL[it.task_type] || it.task_type : '未处理'} ·{' '}
                {formatTime(it.created_at)}
              </Text>
              {it.task_status ? (
                <Text className={`badge badge-${it.task_status}`}>{STATUS_TEXT[it.task_status]}</Text>
              ) : null}
            </View>
            {it.status === 'uploaded' && (
              <Button
                className='row-del'
                size='mini'
                onClick={(e) => {
                  e.stopPropagation()
                  removeItem(it)
                }}
              >
                删除
              </Button>
            )}
          </View>
        ))
      )}
    </View>
  )
}