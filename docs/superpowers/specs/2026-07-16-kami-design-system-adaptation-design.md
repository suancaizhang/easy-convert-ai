# Kami 设计体系适配方案

> 日期：2026-07-16
> 状态：已确认
> 参考：[tw93/kami](https://github.com/tw93/kami)、`docs/design/typography-system.md`

---

## 概述

将 easy-convert-ai 前端从当前的"白底+默认蓝+冷灰"通用 SaaS 风格，全面换肤为 Kami 启发的暖色纸质编辑风格。

**核心决策：**
- 全面换肤（暖色画布、墨蓝品牌、去阴影、边框层级）
- 品牌色：墨蓝 `#1B365D`
- 字体：正文 serif + UI sans 分工
- 多语言：中英 serif，东南亚系统 sans 回退
- 实施方案：CSS 变量 + Tailwind 主题覆盖（方案 A）

---

## 1. 设计 Token（CSS 变量）

### 1.1 配色

```css
:root {
  /* 表面层级 */
  --surface-page: #f5f4ed;       /* 页面画布（暖白） */
  --surface-card: #faf9f5;       /* 卡片/抬升面 */
  --surface-dark: #30302e;       /* 深色表面 */

  /* 文字层级 */
  --text-primary: #141413;       /* 主文字 */
  --text-secondary: #3d3d3a;     /* 次要文字 */
  --text-tertiary: #504e49;      /* 辅助文字 */
  --text-muted: #6b6a64;         /* 弱化文字 */
  --text-on-brand: #ffffff;      /* 品牌色上的文字 */

  /* 品牌 */
  --brand: #1B365D;              /* 墨蓝主色 */
  --brand-hover: #152b4d;        /* 悬停态 */
  --brand-light: #2D5A8A;        /* 浅品牌色 */
  --brand-surface: #E4ECF5;      /* 品牌色背景 */

  /* 边框 */
  --border: #e8e6dc;             /* 标准边框 */
  --border-soft: #e5e3d8;        /* 柔和边框 */

  /* 功能色 */
  --success-bg: #e8f0e4;
  --success-fg: #3d6b35;
  --error-bg: #f0e0d8;
  --error-fg: #8b4513;
  --warning-bg: #f5ecd8;
  --warning-fg: #7a5c1e;
}
```

### 1.2 圆角

```css
:root {
  --radius-sm: 4px;
  --radius-md: 8px;    /* 默认 */
  --radius-lg: 12px;
  --radius-xl: 16px;
}
```

### 1.3 间距

沿用 Tailwind 默认间距（4px 基数），不重新定义。

---

## 2. 字体系统

### 2.1 字体栈

```css
:root {
  /* 内容字体 */
  --font-serif-zh: "Luo", "Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", Georgia, serif;
  --font-serif-en: Charter, Georgia, Palatino, "Times New Roman", serif;
  --font-serif-sea: Charter, Georgia, -apple-system, "Segoe UI", sans-serif;

  /* UI 字体 */
  --font-ui: Inter, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;

  /* 等宽字体 */
  --font-mono: "JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace;
}
```

### 2.2 按语言切换

```css
html[lang="zh-CN"]       { --font-content: var(--font-serif-zh); }
html[lang="en"]          { --font-content: var(--font-serif-en); }
html[lang="th"],
html[lang="vi"],
html[lang="id"],
html[lang="ms"],
html[lang="fil"]         { --font-content: var(--font-serif-sea); }
```

### 2.3 字重规则

| 字重 | 用途 | Tailwind 类 |
|------|------|-------------|
| 400 | 正文、描述 | `font-normal` |
| 500 | 标题（h1–h3）、强调 | `font-medium` |
| 600 | UI 标签、按钮 | `font-semibold` |

### 2.4 使用场景

| 区域 | 字体变量 | 示例 |
|------|----------|------|
| 页面标题、描述、卡片文案 | `font-content` | 首页标题、工具描述 |
| 按钮、导航、Tab、表单 | `font-ui` | 上传按钮、顶部导航 |
| 文件名、格式标签 | `font-mono` | "document.pdf" |

### 2.5 排版微调

```css
html[lang="zh-CN"] {
  letter-spacing: 0.02em;
  line-height: 1.6;
}

html[lang="en"] {
  letter-spacing: 0;
  line-height: 1.55;
}
```

---

## 3. Tailwind 主题映射

### 3.1 tailwind.config.ts 扩展

```ts
theme: {
  extend: {
    colors: {
      page: 'var(--surface-page)',
      card: 'var(--surface-card)',
      brand: {
        DEFAULT: 'var(--brand)',
        hover: 'var(--brand-hover)',
        light: 'var(--brand-light)',
        surface: 'var(--brand-surface)',
      },
      border: 'var(--border)',
      'border-soft': 'var(--border-soft)',
      success: { bg: 'var(--success-bg)', fg: 'var(--success-fg)' },
      error: { bg: 'var(--error-bg)', fg: 'var(--error-fg)' },
      warning: { bg: 'var(--warning-bg)', fg: 'var(--warning-fg)' },
    },
    textColor: {
      primary: 'var(--text-primary)',
      secondary: 'var(--text-secondary)',
      tertiary: 'var(--text-tertiary)',
      muted: 'var(--text-muted)',
      'on-brand': 'var(--text-on-brand)',
    },
    fontFamily: {
      content: 'var(--font-content)',
      ui: 'var(--font-ui)',
      mono: 'var(--font-mono)',
    },
    borderRadius: {
      sm: 'var(--radius-sm)',
      DEFAULT: 'var(--radius-md)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      xl: 'var(--radius-xl)',
    },
  }
}
```

### 3.2 类名替换映射

| 现有类名 | 替换为 | 说明 |
|----------|--------|------|
| `bg-white` | `bg-card` | 卡片背景 |
| `bg-gray-50` | `bg-page` | 页面背景 |
| `bg-blue-600` | `bg-brand` | 主按钮 |
| `hover:bg-blue-700` | `hover:bg-brand-hover` | 按钮悬停 |
| `text-blue-600` | `text-brand` | 链接/强调 |
| `text-gray-900` | `text-primary` | 主文字 |
| `text-gray-600` | `text-secondary` | 次要文字 |
| `text-gray-500` | `text-tertiary` | 辅助文字 |
| `text-gray-400` | `text-muted` | 弱化文字 |
| `border-gray-200` | `border-border` | 标准边框 |
| `bg-blue-50` / `bg-blue-100` | `bg-brand-surface` | 浅色品牌背景 |
| `bg-green-100` | `bg-success-bg` | 成功状态 |
| `bg-red-50` / `bg-red-100` | `bg-error-bg` | 错误状态 |
| `text-green-600` | `text-success-fg` | 成功文字 |
| `text-red-600` | `text-error-fg` | 错误文字 |
| `shadow-sm` / `shadow-md` | 删除 | 去阴影 |

---

## 4. 组件样式规则

### 4.1 body 基础

```css
body {
  background-color: var(--surface-page);
  color: var(--text-primary);
  font-family: var(--font-ui);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### 4.2 卡片

```
bg-card border border-border rounded-md
```

无 shadow。hover 仅允许微光：`hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)]`

### 4.3 导航栏

```
bg-card border-b border-border-soft
```

### 4.4 按钮

| 类型 | 样式 |
|------|------|
| 主按钮 | `bg-brand text-on-brand font-ui font-semibold rounded-md hover:bg-brand-hover` |
| 次按钮 | `bg-brand-surface text-brand font-ui font-semibold rounded-md` |
| 幽灵按钮 | `border border-border text-secondary font-ui rounded-md hover:bg-page` |

### 4.5 链接与 Tab

```
链接: text-brand hover:text-brand-hover
Tab 激活: border-b-2 border-brand text-brand
Tab 未激活: text-muted hover:text-secondary
```

### 4.6 投影规则

去掉所有 `shadow-*`。唯一允许的 hover 微光：

```css
box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
```

---

## 5. 不改动的部分

| 项目 | 原因 |
|------|------|
| 页面布局结构（max-w, 居中） | 已合理 |
| 响应式断点 | Tailwind 默认够用 |
| 间距数值 | 4px 基数与 Kami 一致 |
| 组件逻辑/状态管理 | 纯视觉改造 |
| i18n 翻译系统 | 只加 lang 选择器 |
| 暗色模式 | 不引入 |
| shadcn / CSS-in-JS | 不引入 |
| 字体文件下载 | Charter/Inter 走系统回退 |
| Next.js 字体加载方式 | 保持 @font-face |

---

## 6. 实施范围

### 需要修改的文件

| 文件 | 改动 |
|------|------|
| `web/src/app/globals.css` | 新增 CSS 变量、字体切换、排版微调 |
| `web/tailwind.config.ts` | 扩展主题（colors、textColor、fontFamily、borderRadius） |
| `web/src/app/layout.tsx` | body 类名调整（bg-page、font-ui） |
| `web/src/app/page.tsx` | 类名替换 |
| `web/src/app/convert/page.tsx` | 类名替换 |
| `web/src/app/history/page.tsx` | 类名替换 |
| `web/src/app/tools/*/page.tsx` | 类名替换（6个工具页） |
| `web/src/components/ToolPageLayout.tsx` | 类名替换 |
| 其他组件文件 | 按需替换 |

### 不修改的文件

- `web/src/lib/` 下所有逻辑文件
- `web/src/i18n/` 翻译文件
- API 和 Worker 代码
