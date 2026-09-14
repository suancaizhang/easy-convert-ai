import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import './app.scss'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    // 应用启动时的全局初始化（登录态按需在页面内处理）
  })
  return children
}

export default App