import { useCallback, useState } from 'react'
import Taro, { useLoad } from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'
import { wechatLogin } from '../../api'
import { setToken } from '../../utils/storage'
import { wxLogin } from '../../utils/wechat'
import './index.scss'

export default function Login() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const doLogin = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const code = await wxLogin()
      const { access_token } = await wechatLogin(code)
      setToken(access_token)
      Taro.switchTab({ url: '/pages/index/index' })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [busy])

  useLoad(() => {
    doLogin()
  })

  return (
    <View className='page login'>
      <View className='hero card'>
        <Text className='title'>易换文档 AI</Text>
        <Text className='subtitle'>PDF · Office · 图片智能转换，一键 AI 文字识别</Text>
      </View>
      <Button className="btn-primary btn-login" loading={busy} onClick={doLogin}>
        {busy ? '正在登录…' : '微信一键登录'}
      </Button>
      {error ? <Text className="login-error">{error}</Text> : null}
    </View>
  )
}