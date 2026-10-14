const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function app() {
  const cache = new Map()
  const states = []
  let cursor = 0
  let onShow
  let effects = []
  let token = 'test-token'
  const calls = { uploads: [], downloads: [], requests: [], launches: [], previews: [], toasts: [] }
  const taro = {
    getStorageSync: () => token,
    removeStorageSync: () => { token = '' },
    reLaunch: async (value) => { calls.launches.push(value) },
    showToast: async (value) => { calls.toasts.push(value) },
    useRouter: () => ({ params: { id: 'task-1' } }),
    useLoad: () => {},
    useDidShow: (fn) => { onShow = fn },
    request: async (options) => {
      calls.requests.push(options)
      return { statusCode: 200, data: {} }
    },
    uploadFile: (options) => {
      calls.uploads.push(options)
      options.success({ statusCode: 401, data: '{"detail":"expired"}' })
    },
    downloadFile: (options) => {
      calls.downloads.push(options.url)
      if (options.url.endsWith('/1')) options.success({ statusCode: 404 })
      else options.success({ statusCode: 200, tempFilePath: '/tmp/page.png' })
    },
    previewImage: (options) => { calls.previews.push(options); options.success() },
    chooseMessageFile: (options) => options.success({ tempFiles: [{ path: '/tmp/a.pdf', name: 'a.pdf' }] }),
  }
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in states)) states[index] = initial
      return [states[index], (value) => { states[index] = typeof value === 'function' ? value(states[index]) : value }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in states)) states[index] = { current: initial }
      return states[index]
    },
    useCallback: (fn) => fn,
    useEffect: (fn) => { effects.push(fn) },
  }
  function load(relative) {
    const filename = path.resolve(__dirname, '../src', relative)
    if (cache.has(filename)) return cache.get(filename).exports
    const mod = { exports: {} }
    cache.set(filename, mod)
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2017 },
    }).outputText
    function localRequire(name) {
      if (name === '@tarojs/taro') return taro
      if (name === 'react') return react
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
      if (name === '@tarojs/components') return { View: 'View', Text: 'Text', Button: 'Button', Input: 'Input' }
      if (name.endsWith('.scss')) return {}
      const base = path.resolve(path.dirname(filename), name)
      const resolved = [base + '.ts', base + '.tsx', path.join(base, 'index.ts')].find(fs.existsSync)
      return load(path.relative(path.resolve(__dirname, '../src'), resolved))
    }
    vm.runInThisContext(`(function(require,module,exports,process){${code}\n})`, { filename })(localRequire, mod, mod.exports, { env: { TARO_APP_API_BASE: 'http://127.0.0.1:8111' } })
    return mod.exports
  }
  return { load, calls, taro, token: () => token, render(Component) { cursor = 0; effects = []; return Component() }, show: () => onShow(), effects: () => effects.forEach((effect) => effect()) }
}
function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((child) => nodes(child, predicate))
  if (!tree || typeof tree !== 'object') return []
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
}
const byClass = (tree, name) => nodes(tree, (node) => node.props?.className?.split(' ').includes(name))
const settle = () => new Promise((resolve) => setImmediate(resolve))

test('upload 401 clears auth and redirects just like request/download', async () => {
  const a = app()
  await assert.rejects(a.load('api/index.ts').uploadDocument('/tmp/a.pdf'))
  assert.equal(a.token(), '')
  assert.equal(a.calls.launches[0]?.url, '/pages/login/index')
})

test('history loads the 51st record using server total and page', async () => {
  const a = app()
  a.taro.request = async ({ url }) => {
    a.calls.requests.push(url)
    const page = Number(new URL(url).searchParams.get('page'))
    return { statusCode: 200, data: { total: 51, page, page_size: 50, items: Array.from({ length: page === 1 ? 50 : 1 }, (_, i) => ({ id: String((page - 1) * 50 + i), filename: `doc-${(page - 1) * 50 + i}`, created_at: '' })) } }
  }
  const Page = a.load('pages/history/index.tsx').default
  a.render(Page)
  await a.show()
  await settle()
  let tree = a.render(Page)
  const more = byClass(tree, 'load-more')[0]
  assert.ok(more, 'load-more action must be reachable when total > loaded')
  await more.props.onClick()
  await settle()
  tree = a.render(Page)
  assert.equal(byClass(tree, 'row-name').at(-1).props.children, 'doc-50')
  assert.equal(byClass(tree, 'load-more').length, 0)
})

test('image result only fetches selected page despite unrelated page failure', async () => {
  const a = app()
  a.taro.request = async ({ url }) => ({ statusCode: 200, data: url.endsWith('/pages') ? { total: 3, ext: 'png' } : { status: 'success', task_type: 'pdf_to_image' } })
  const Page = a.load('pages/result/index.tsx').default
  a.render(Page)
  a.effects()
  await settle()
  const tree = a.render(Page)
  await byClass(tree, 'page-item')[2].props.onClick()
  assert.deepEqual(a.calls.downloads, ['http://127.0.0.1:8111/api/tasks/task-1/download/2'])
  assert.deepEqual(a.calls.previews[0]?.urls, ['/tmp/page.png'])
})

test('invalid parameters fail before any upload', async () => {
  const a = app()
  const Page = a.load('pages/index/index.tsx').default
  let tree = a.render(Page)
  const split = byClass(tree, 'chip').find((node) => nodes(node, (child) => child.props?.children === 'PDF 拆分').length)
  split.props.onClick()
  tree = a.render(Page)
  await byClass(tree, 'btn-primary').at(-1).props.onClick()
  tree = a.render(Page)
  nodes(tree, (node) => node.type === 'Input')[0].props.onInput({ detail: { value: '0,invalid' } })
  tree = a.render(Page)
  await byClass(tree, 'btn-go')[0].props.onClick()
  assert.deepEqual(a.calls.uploads, [])
  assert.ok(a.calls.toasts.length)
})

test('parameter validation matches API boundaries and preserves numeric JSON values', () => {
  const { buildParams, CONVERSIONS } = app().load('conversions.ts')
  const convert = (type, values) => buildParams(CONVERSIONS.find((def) => def.type === type), values)
  for (const pages of ['', '0', '1,,2', '1-a', 'all', '1'.repeat(1001)]) {
    assert.throws(() => convert('pdf_split', { pages }))
  }
  assert.equal(convert('pdf_split', { pages: ' 1-3, 5 ' }).pages, ' 1-3, 5 ')
  assert.deepEqual(convert('pdf_rotate', { angle: '270', pages: 'all' }), { angle: 270, pages: 'all' })
  assert.throws(() => convert('pdf_rotate', { angle: '45' }))
  for (const opacity of ['NaN', 'Infinity', '0', '0.049', '1.01', '']) {
    assert.throws(() => convert('pdf_watermark', { text: 'watermark', opacity }))
  }
  for (const opacity of ['0.05', '1']) {
    const body = convert('pdf_watermark', { text: '字'.repeat(500), opacity })
    assert.equal(JSON.parse(JSON.stringify(body)).opacity, Number(opacity))
  }
  assert.throws(() => convert('pdf_watermark', { text: '字'.repeat(501) }))
  assert.throws(() => convert('pdf_watermark', { text: ' ', opacity: '0.3' }))
  assert.throws(() => convert('pdf_watermark', { text: 'text', position: 'other' }))
  assert.throws(() => convert('pdf_compress', { quality: 'unknown' }))
  assert.throws(() => convert('ocr_to_word', { output_format: 'pdf' }))
})

test('request/download 401 invalidate auth; login rejection does not redirect', async () => {
  for (const transport of ['request', 'download']) {
    const a = app()
    a.taro.request = async () => ({ statusCode: 401, data: { detail: 'expired' } })
    a.taro.downloadFile = (options) => options.success({ statusCode: 401 })
    const api = a.load('api/index.ts')
    await assert.rejects(transport === 'request' ? api.fetchQuota() : api.downloadTaskFile('task-1'))
    assert.equal(a.token(), '')
    assert.equal(a.calls.launches[0]?.url, '/pages/login/index')
  }
  const a = app()
  a.taro.request = async () => ({ statusCode: 401, data: { detail: 'bad login' } })
  await assert.rejects(a.load('api/index.ts').wechatLogin('bad-code'))
  assert.equal(a.token(), 'test-token')
  assert.deepEqual(a.calls.launches, [])
})

test('history load-more retries without losing rows or skipping a failed page', async () => {
  const a = app()
  let failed = false
  const pages = []
  a.taro.request = async ({ url }) => {
    const page = Number(new URL(url).searchParams.get('page'))
    pages.push(page)
    if (page === 2 && !failed) { failed = true; throw new Error('offline') }
    return { statusCode: 200, data: { total: 51, page, items: Array.from({ length: page === 1 ? 50 : 1 }, (_, index) => ({ id: String((page - 1) * 50 + index), filename: 'file', created_at: '' })) } }
  }
  const Page = a.load('pages/history/index.tsx').default
  a.render(Page)
  a.show()
  await settle()
  await byClass(a.render(Page), 'load-more')[0].props.onClick()
  assert.equal(byClass(a.render(Page), 'row-name').length, 50)
  await byClass(a.render(Page), 'load-more')[0].props.onClick()
  assert.deepEqual(pages, [1, 2, 2])
  assert.equal(byClass(a.render(Page), 'row-name').length, 51)
})

test('multi-image primary action lazily opens only first page', async () => {
  const a = app()
  a.taro.request = async ({ url }) => ({ statusCode: 200, data: url.endsWith('/pages') ? { total: 100, ext: 'png' } : { status: 'success' } })
  const Page = a.load('pages/result/index.tsx').default
  a.render(Page)
  a.effects()
  await settle()
  await byClass(a.render(Page), 'btn-primary')[0].props.onClick()
  assert.deepEqual(a.calls.downloads, ['http://127.0.0.1:8111/api/tasks/task-1/download/0'])
  assert.equal(a.calls.previews[0]?.current, '/tmp/page.png')
})
