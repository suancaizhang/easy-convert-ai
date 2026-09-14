import type { TaskType } from './api'

export interface ParamDef {
  key: string
  label: string
  kind: 'select' | 'input'
  options?: { label: string; value: string }[]
  placeholder?: string
  default?: string
  /** API 侧为数值字段，提交时发送 JSON number；避免依赖 Pydantic 的字符串强转差异。 */
  numeric?: boolean
}

export interface ConversionDef {
  type: TaskType
  label: string
  group: string
  /** 文件来源：image=相册/拍摄；file=会话文件（限扩展名） */
  picker: 'image' | 'file'
  extensions?: string[]
  max: number
  params?: ParamDef[]
}

export const CONVERSIONS: ConversionDef[] = [
  {
    type: 'ocr_to_word',
    label: '图片文字识别',
    group: 'AI 智能',
    picker: 'image',
    max: 1,
    params: [
      {
        key: 'output_format',
        label: '输出格式',
        kind: 'select',
        default: 'docx',
        options: [
          { label: '可编辑 Word', value: 'docx' },
          { label: '纯文本', value: 'txt' },
          { label: '可搜索 PDF', value: 'searchable_pdf' },
        ],
      },
    ],
  },
  {
    type: 'ocr_to_word',
    label: 'PDF 文字识别',
    group: 'AI 智能',
    picker: 'file',
    extensions: ['pdf'],
    max: 1,
    params: [
      {
        key: 'output_format',
        label: '输出格式',
        kind: 'select',
        default: 'docx',
        options: [
          { label: '可编辑 Word', value: 'docx' },
          { label: '纯文本', value: 'txt' },
          { label: '可搜索 PDF', value: 'searchable_pdf' },
        ],
      },
    ],
  },
  { type: 'pdf_to_word', label: 'PDF → Word', group: '格式转换', picker: 'file', extensions: ['pdf'], max: 1 },
  { type: 'word_to_pdf', label: 'Word → PDF', group: '格式转换', picker: 'file', extensions: ['docx'], max: 1 },
  { type: 'excel_to_pdf', label: 'Excel → PDF', group: '格式转换', picker: 'file', extensions: ['xlsx'], max: 1 },
  { type: 'ppt_to_pdf', label: 'PPT → PDF', group: '格式转换', picker: 'file', extensions: ['pptx'], max: 1 },
  { type: 'pdf_to_image', label: 'PDF → 图片', group: '格式转换', picker: 'file', extensions: ['pdf'], max: 1 },
  { type: 'images_to_pdf', label: '图片 → PDF', group: '格式转换', picker: 'image', max: 9 },
  { type: 'pdf_merge', label: 'PDF 合并', group: 'PDF 工具', picker: 'file', extensions: ['pdf'], max: 9 },
  {
    type: 'pdf_split',
    label: 'PDF 拆分',
    group: 'PDF 工具',
    picker: 'file',
    extensions: ['pdf'],
    max: 1,
    params: [
      {
        key: 'pages',
        label: '拆分页码',
        kind: 'input',
        placeholder: '如 1-3, 5, 7-9',
        default: '1',
      },
    ],
  },
  {
    type: 'pdf_compress',
    label: 'PDF 压缩',
    group: 'PDF 工具',
    picker: 'file',
    extensions: ['pdf'],
    max: 1,
    params: [
      {
        key: 'quality',
        label: '压缩强度',
        kind: 'select',
        default: 'medium',
        options: [
          { label: '低', value: 'low' },
          { label: '中', value: 'medium' },
          { label: '高', value: 'high' },
        ],
      },
    ],
  },
  {
    type: 'pdf_rotate',
    label: 'PDF 旋转',
    group: 'PDF 工具',
    picker: 'file',
    extensions: ['pdf'],
    max: 1,
    params: [
      {
        key: 'angle',
        label: '旋转角度',
        kind: 'select',
        default: '90',
        numeric: true,
        options: [
          { label: '90°', value: '90' },
          { label: '180°', value: '180' },
          { label: '270°', value: '270' },
        ],
      },
      {
        key: 'pages',
        label: '应用范围',
        kind: 'input',
        placeholder: '默认 all，或如 1-3,5',
        default: 'all',
      },
    ],
  },
  {
    type: 'pdf_watermark',
    label: 'PDF 水印',
    group: 'PDF 工具',
    picker: 'file',
    extensions: ['pdf'],
    max: 1,
    params: [
      {
        key: 'text',
        label: '水印文字',
        kind: 'input',
        placeholder: '输入水印内容',
      },
      {
        key: 'opacity',
        label: '透明度',
        kind: 'select',
        default: '0.3',
        numeric: true,
        options: [
          { label: '淡', value: '0.1' },
          { label: '中', value: '0.3' },
          { label: '深', value: '0.6' },
        ],
      },
      {
        key: 'position',
        label: '水印位置',
        kind: 'select',
        default: 'center',
        options: [
          { label: '居中', value: 'center' },
          { label: '左上', value: 'top-left' },
          { label: '右上', value: 'top-right' },
          { label: '左下', value: 'bottom-left' },
          { label: '右下', value: 'bottom-right' },
        ],
      },
    ],
  },
]

export const GROUPS = ['AI 智能', '格式转换', 'PDF 工具'] as const

export const TASK_LABEL: Record<string, string> = CONVERSIONS.reduce<Record<string, string>>(
  (acc, c) => {
    if (!(c.type in acc)) acc[c.type] = c.label
    return acc
  },
  {},
)

export const STATUS_TEXT: Record<string, string> = {
  waiting: '排队中',
  processing: '处理中',
  success: '已完成',
  failed: '失败',
}