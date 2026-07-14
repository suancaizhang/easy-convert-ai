# Issue: Web 端入口无法直达转换目的

- **状态**: 待处理
- **优先级**: P2
- **标签**: `enhancement`, `frontend`, `ux`
- **创建日期**: 2026-07-14

---

## 问题描述

当前 `/convert` 页面是**通用型上传页面**，无论用户想做什么类型的转换，都只能：先选文件 → 根据文件类型展示可选的转换类型 → 选择 → 开始转换。

如果用户打开页面时就明确知道自己想做「图片转 PDF」或「PDF 转 Word」，仍然要走完上述完整流程，**没有捷径可走**。

## 用户旅程对比

### 当前流程（被动）

```
首页 → /convert
  → 拖拽/点击选择文件（如一张 PNG 图片）
  → 系统根据文件类型展示 2 个选项：「OCR 识别→Word」「图片→PDF」
  → 用户选择「图片→PDF」
  → 点击「开始转换」
  → 等待 → 下载
```

**痛点**：用户已经知道自己要「图片转 PDF」，但系统强迫他先选文件再选目的。

### 期望流程（主动）

```
首页 → 点击「图片→PDF」入口
  → 进入转换页，页面已预置：
    · 标题：「图片转 PDF」
    · 文件选择器已过滤：仅接受 png/jpg/webp
    · 转换类型已锁定：images_to_pdf
  → 选择文件 → 自动开始转换（或仅需一次点击）
  → 等待 → 下载
```

## 当前实现分析

### 页面结构

**相关文件**: `web/src/app/page.tsx`

首页目前展示的转换类型卡片是**纯展示装饰性元素**，不可点击：

```tsx
{["PDF ↔ Word", "Excel → PDF", "PPT → PDF", "OCR 识别"].map((t) => (
  <div key={t} className="border rounded-md px-4 py-2 bg-gray-50">
    {t}
  </div>
))}
```

下方只有一个「免费开始转换」链接直接指向 `/convert`。

### 转换页面

**相关文件**: `web/src/app/convert/page.tsx`

支持 7 种文件类型，8 种转换任务：

| 文件类型 | 转换选项 |
|---------|---------|
| pdf | PDF→Word, PDF→图片 |
| docx | Word→PDF |
| xlsx | Excel→PDF |
| pptx | PPT→PDF |
| png/jpg/webp | OCR→Word, 图片→PDF |

当前判定逻辑：根据上传文件的**扩展名**决定展示哪些转换选项。如果该类型只有 1 种选项则自动选中，如果有 2 种则让用户选择。

### 路由

**相关文件**: `web/src/app/convert/page.tsx`

路由只有 `/convert` 一条，无参数路由。页面未使用 `useSearchParams` 读取查询参数。

## 建议修复方案

### 方案 A（推荐）：首页 → 带参数的直达链接

#### 后端逻辑

将 `/convert/page.tsx` 改为读取 URL 查询参数 `taskType`。

#### 修改首页 `/page.tsx`

将 4 个装饰性卡片变为**可点击的直达链接**：

```tsx
const QUICK_LINKS = [
  { label: "PDF → Word", taskType: "pdf_to_word", icon: "📄" },
  { label: "Word → PDF", taskType: "word_to_pdf", icon: "📝" },
  { label: "图片 → PDF", taskType: "images_to_pdf", icon: "🖼" },
  { label: "OCR 识别", taskType: "ocr_to_word", icon: "🤖" },
  { label: "Excel → PDF", taskType: "excel_to_pdf", icon: "📊" },
  { label: "PPT → PDF", taskType: "ppt_to_pdf", icon: "📽" },
];

// 渲染
{QUICK_LINKS.map((link) => (
  <Link
    key={link.taskType}
    href={`/convert?taskType=${link.taskType}`}
    className="border rounded-md px-4 py-3 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 transition-colors text-center block"
  >
    <span className="text-lg mr-1">{link.icon}</span>
    {link.label}
  </Link>
))}
```

#### 修改转换页 `/convert/page.tsx`

1. 使用 `useSearchParams()` 读取 `taskType` 参数
2. 如果有 `taskType` 参数：
   - 锁定转换类型选择（隐藏类型选择器）
   - 根据 taskType 反推可接受的文件类型，过滤文件选择器
   - 页面标题改为具体名称，如"图片转 PDF"
3. 如果无 `taskType` 参数（普通上传）：行为不变

```typescript
// 任务类型 → 接受的文件扩展名映射
const TASK_TO_EXT: Record<string, string[]> = {
  pdf_to_word: ["pdf"],
  pdf_to_image: ["pdf"],
  word_to_pdf: ["docx"],
  excel_to_pdf: ["xlsx"],
  ppt_to_pdf: ["pptx"],
  images_to_pdf: ["png", "jpg", "jpeg", "webp"],
  ocr_to_word: ["png", "jpg", "jpeg", "webp"],
};

// 任务类型 → 显示标题
const TASK_LABELS: Record<string, string> = {
  pdf_to_word: "PDF 转 Word",
  pdf_to_image: "PDF 转图片",
  word_to_pdf: "Word 转 PDF",
  excel_to_pdf: "Excel 转 PDF",
  ppt_to_pdf: "PPT 转 PDF",
  images_to_pdf: "图片转 PDF",
  ocr_to_word: "OCR 识别 → Word",
};
```

#### 状态机升级

页面当前使用 `Stage = "upload" | "converting" | "done" | "error"`。在预选模式下：

```
                           ┌─ 预选了 taskType?
upload ────────────────────┤
  ├─ 选择文件（按扩展名过滤） │
  ├─ 跳过类型选择 ───────────┘
  └─ 点击「开始转换」
       ↓
converting → done / error
```

### 方案 B（可选增强）：独立路由

如果未来有更多业务场景，可以拆分为独立页面：

```
/convert                  → 通用转换（保持现有）
/convert/pdf-to-word      → 预选 PDF→Word
/convert/images-to-pdf    → 预选 图片→PDF
/convert/ocr              → 预选 OCR→Word
```

每个页面复用 `components/ConvertForm.tsx` 组件，通过 props 传入 `defaultTaskType`。

### 方案 C（路线图）：先选目的再选文件的流程翻转

更适合「不知文件格式但知目的」的场景（如用户有一张图片想转 PDF，但不清楚文件类型）：

```
Step 1: 选择转换目标
  ┌────────────────────────────┐
  │  📄 PDF → Word             │
  │  🖼 图片 → PDF             │  ← 大卡片选择
  │  📊 Excel → PDF            │
  │  🤖 OCR → Word             │
  └────────────────────────────┘

Step 2: 上传文件（仅接受符合目的的文件类型）
  ┌────────────────────────────┐
  │  拖拽或选择文件             │
  │  支持: PNG, JPG, WebP      │  ← 动态展示可接受格式
  └────────────────────────────┘

Step 3: 自动开始转换
```

这种方案的额外优点是首页可以直接嵌入 Step 1，让流量从首页直接进入转换漏斗。

## 方案对比

| 维度 | 方案 A（推荐） | 方案 B | 方案 C |
|------|--------------|--------|--------|
| 改动量 | 小（2 个文件） | 中（新增组件 + 路由） | 大（流程重构） |
| 用户收益 | 中 | 高 | 高 |
| SEO 友好 | 否（SPA 参数） | 是（独立路由） | 否 |
| 与现有代码兼容 | 高 | 中（需提取组件） | 低 |
| 实施周期 | 1-2 天 | 2-3 天 | 3-5 天 |

## 涉及文件清单

### 方案 A

| 文件 | 修改类型 | 描述 |
|------|---------|------|
| `web/src/app/page.tsx` | 修改 | 将装饰卡片改为可点击的直达链接 |
| `web/src/app/convert/page.tsx` | 修改 | 读取 searchParams，支持预选 taskType |

## 验收标准

- [ ] 首页每种转换类型卡片可点击，跳转到 `/convert?taskType=xxx`
- [ ] 通过预选链接进入时，页面标题显示具体转换名称
- [ ] 预选后文件选择器自动过滤，只接受对应类型文件
- [ ] 上传文件后自动跳过类型选择步骤
- [ ] 直接访问 `/convert`（无参数）保持原有行为不变
- [ ] 用户仍然可以在预选模式下取消选择、返回通用选择
- [ ] URL 中错误的 `taskType` 值被优雅降级（回退到通用模式）
- [ ] 所有 8 种转换类型都有有效的预选入口

## 注意事项

- URL 参数 `taskType` 必须是受控的枚举值，不要直接拼接用户输入
- 预选模式下文件类型检查不能绕过：用户可能手动选择不匹配的文件
- 使用 `useSearchParams()` 需要组件包裹 `Suspense` 边界（Next.js App Router 要求）
- 两种模式（通用/预选）的渲染路径尽量共享代码，避免两份逻辑
- 降级策略：如果用户通过预选入口进入但上传了不匹配的文件，应提示清晰错误并允许回退到通用模式
- 未来可以考虑在 URL 中增加 `?fileType=image` 等更多参数，进一步细化入口