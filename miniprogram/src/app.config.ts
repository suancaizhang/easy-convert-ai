export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/history/index',
    'pages/result/index',
    'pages/login/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTitleText: '易换文档 AI',
    navigationBarTextStyle: 'white',
  },
  tabBar: {
    color: '#8a8f99',
    selectedColor: '#1677ff',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/index/index', text: '转换' },
      { pagePath: 'pages/history/index', text: '历史' },
    ],
  },
})