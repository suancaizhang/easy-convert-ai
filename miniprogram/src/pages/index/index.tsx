import { useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { Button, Input, Text, View } from '@tarojs/components'
import { createTask, fetchQuota, uploadDocument } from '../../api'
import { buildParams, CONVERSIONS, GROUPS, type ConversionDef } from '../../conversions'
import { getToken } from '../../utils/storage'
import { pickFiles, pickImages } from '../../utils/wechat'
import './index.scss'

interface PickedFile {
  path: string
  name: string
}

export default function Index() {
  const [active, setActive] = useState<ConversionDef | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [quota, setQuota] = useState<{ used: number; total: number } | null>(null)
  const [files, setFiles] = useState<PickedFile[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  const syncQuota = () => {
    fetchQuota()
      .then((q) => setQuota({ used: q.used, total: q.total }))
      .catch(() => {})
  }

  const selectType = (def: ConversionDef) => {
    setActive(def)
    setFiles([])
    if (def.params) {
      const defaults: Record<string, string> = {}
      for (const p of def.params) if (p.default) defaults[p.key] = p.default
      setValues(defaults)
    } else {
      setValues({})
    }
  }

  const pick = async () => {
    if (!active) {
      Taro.showToast({ title: '请先选择功能', icon: 'none' })
      return
    }
    try {
      const picked =
        active.picker === 'image'
          ? await pickImages(active.max)
          : await pickFiles(active.max, active.extensions || [])
      if (picked.length) setFiles(picked)
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    }
  }

  const start = async () => {
    if (!active) return
    if (!files.length) {
      Taro.showToast({ title: '请先选择文件', icon: 'none' })
      return
    }
    if (!getToken()) {
      Taro.reLaunch({ url: '/pages/login/index' })
      return
    }
    let params: Record<string, string | number>
    try {
      params = buildParams(active, values)
    } catch (e) {
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
      return
    }
    setBusy(true)
    setProgress('正在上传文件…')
    try {
      const docs = []
      for (const f of files) {
        docs.push(await uploadDocument(f.path))
      }
      setProgress('正在创建任务…')
      const task = await createTask({
        document_id: docs[0].id,
        task_type: active.type,
        source_document_ids: docs.length > 1 ? docs.map((d) => d.id) : undefined,
        params: Object.keys(params).length ? params : undefined,
      })
      Taro.reLaunch({ url: `/pages/result/index?id=${task.id}` })
    } catch (e) {
      setProgress('')
      Taro.showToast({ title: (e as Error).message, icon: 'none' })
    } finally {
      setBusy(false)
    }
  }

  useLoad(() => {
    if (!getToken()) {
      Taro.reLaunch({ url: '/pages/login/index' })
      return
    }
    syncQuota()
  })

  return (
    <View className='page'>
      {quota && (
        <View className='quota card'>
          <Text>今日剩余 AI 转换额度</Text>
          <Text className='quota-num'>{Math.max(quota.total - quota.used, 0)}/{quota.total}</Text>
        </View>
      )}
      {GROUPS.map((g) => (
        <View key={g} className='group'>
          <View className='group-title'>{g}</View>
          <View className='chips'>
            {CONVERSIONS.filter((c) => c.group === g).map((c, i) => (
              <View
                key={`${c.type}-${i}`}
                className={`chip${active === c ? ' chip-active' : ''}`}
                onClick={() => selectType(c)}
              >
                <Text>{c.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
      {active && active.params && (
        <View className='card params'>
          {active.params.map((p) => (
            <View key={p.key} className='param-row'>
              <Text className='param-label'>{p.label}</Text>
              {p.kind === 'select' ? (
                <View className='param-opts'>
                  {(p.options || []).map((o) => (
                    <View
                      key={o.value}
                      className={`opt${values[p.key] === o.value ? ' opt-active' : ''}`}
                      onClick={() => setValues({ ...values, [p.key]: o.value })}
                    >
                      <Text>{o.label}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Input
                  className='param-input'
                  value={values[p.key] || ''}
                  placeholder={p.placeholder || '请输入'}
                  maxlength={p.maxLength ?? -1}
                  onInput={(e) => setValues({ ...values, [p.key]: e.detail.value })}
                />
              )}
            </View>
          ))}
        </View>
      )}
      <View className='card actions'>
        <Button className='btn-primary btn-block' disabled={busy || !active} onClick={pick}>
          {files.length ? `已选择 ${files.length} 个文件，点击更换` : '选择文件'}
        </Button>
        {files.length > 0 && (
          <View className='file-list'>
            {files.map((f, i) => (
              <Text key={i} className='file-name'>
                {f.name}
              </Text>
            ))}
          </View>
        )}
        {progress ? (
          <Text className='progress'>{progress}</Text>
        ) : null}
        <Button
          className='btn-go btn-block'
          loading={busy}
          disabled={busy || !files.length}
          onClick={start}
        >
          开始转换
        </Button>
      </View>
    </View>
  )
}