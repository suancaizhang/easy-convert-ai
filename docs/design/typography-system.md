# 排版设计体系参考

> 参考来源：[tw93/kami](https://github.com/tw93/kami) — 面向 Agent 的编辑级设计系统
> 适用场景：easy-convert-ai 前端多语言排版规范

---

## 设计哲学

- **纸质编辑风格**：暖色画布、衬线字族为主、克制的装饰
- **一个文档一个字族**：`--sans` 指向 `--serif`，整页统一
- **印刷优先**：PDF 输出为第一目标，屏幕是预览
- **品牌色克制**：墨蓝点缀，最多占页面 5% 面积
- **无装饰原则**：禁止渐变、投影、3D、饱和多色

---

## 字体栈

### 按语言分配

| 语言 | CSS 变量 | 字体栈 |
|------|----------|--------|
| 英文 | `--serif` | Charter, Georgia, Palatino, "Times New Roman", serif |
| 简体中文 | `--serif` | "TsangerJinKai02", "Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "STSong", Georgia, serif |
| 繁体中文 | `--serif` | "TsangerJinKai02", "Source Han Serif TC", "Noto Serif CJK TC", "Songti TC", Georgia, serif |
| 日文 | `--serif` | "YuMincho", "Yu Mincho", "Hiragino Mincho ProN", "Noto Serif CJK JP", "Source Han Serif JP", Georgia, serif |
| 韩文 | `--serif` | "Source Han Serif K", "Source Han Serif KR", "Noto Serif KR", "Apple SD Gothic Neo", "AppleMyungjo", Charter, Georgia, serif |
| 等宽（共享） | `--mono` | "JetBrains Mono", "Fira Code", "SF Mono", Consolas, Monaco, monospace |
| 落地页 UI | `--ui` | Inter, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif |

### 字重规则

仅使用 3 个字重，禁止合成粗体/斜体：

| 字重 | 用途 |
|------|------|
| 400 | 正文 |
| 500 | 标题、强调 |
| 600 | UI 标签 |

禁止：100, 700, 900, synthetic bold, print italics。

### 韩文特殊处理

```css
html[lang="ko"] {
  font-synthesis: none; /* 防止合成粗体 */
}
```

---

## 字号体系（印刷尺度）

| 角色 | 字号 | 字重 | 行高 |
|------|------|------|------|
| Display | 36pt | 500 | 1.10 |
| H1 | 22pt | 500 | 1.20 |
| H2 | 16pt | 500 | 1.25 |
| H3 | 13pt | 500 | 1.30 |
| Body lead | 11pt | 400 | 1.55 |
| Body | 10pt | 400 | 1.55 |
| Dense body | 9.2pt | 400 | 1.42 |
| Caption | 9pt | 400 | 1.45 |
| Label | 9pt | 600 | 1.35 |
| Tiny/meta | 9pt | 400 | 1.40 |

屏幕换算：`pt × 1.33`（9pt ≈ 12px, 18pt ≈ 24px）

最小字号：屏幕 12px, PDF 9pt, 幻灯片注释 24px。

---

## 字间距（Tracking）

按语言和场景微调：

| 场景 | 英文 | 中文 | 日文 | 韩文 |
|------|------|------|------|------|
| 正文 | 0 | 0.1–0.3pt | 0.02em | 0.3pt |
| 导语 | 0 | 0.03–0.06em | 0 | — |
| 大标题 (24pt+) | -0.5pt | 0.2–1pt | 0.3px | 0 ~ -0.2pt |
| 小标签 (<10pt) | +0.2–0.5pt | +0.2–0.5pt | +0.2–0.5pt | +0.2–0.5pt |
| 英文全大写标签 | +0.5–1pt | — | — | — |

设计意图：
- 中文方块字需要更宽松的字间距
- 英文大标题用负值字间距增加视觉密度
- 日文用极小正值保持阅读节奏

---

## 行高分级

| 类别 | 行高范围 | 适用 |
|------|----------|------|
| 标题 | 1.10–1.30 | H1–H3, Display |
| 标签/注释 | 1.30–1.40 | Caption, Label |
| 密集文本 | 1.40–1.45 | 表格、紧凑段落 |
| 正文阅读 | 1.50–1.55 | 主体内容 |
| CJK 屏幕正文 | 1.55–1.65 | 中日韩屏幕阅读 |

禁止：正文 1.60+，普通文本 1.00–1.05。

---

## 配色体系

### 设计 Token

```css
:root {
  /* 表面 */
  --parchment: #f5f4ed;      /* 页面画布（暖白，永远不用纯白） */
  --ivory: #faf9f5;          /* 抬升表面（卡片） */
  --warm-sand: #e8e6dc;      /* 控件、边框 */
  --dark-surface: #30302e;   /* 暗色 UI 表面 */
  --deep-dark: #141413;      /* 最深暗色 */

  /* 品牌 */
  --brand: #1B365D;          /* 墨蓝色（最多 5% 面积） */
  --brand-light: #2D5A8A;    /* 浅品牌色 */

  /* 文字层级 */
  --near-black: #141413;     /* 主文字 */
  --dark-warm: #3d3d3a;      /* 次要文字 */
  --olive: #504e49;          /* 辅助文字 */
  --stone: #6b6a64;          /* 弱化文字 */

  /* 边框 */
  --border: #e8e6dc;         /* 标准边框 */
  --border-soft: #e5e3d8;    /* 柔和边框 */

  /* 功能色 */
  --tag-bg: #E4ECF5;         /* 标签背景（纯色，不用透明） */
  --breaking-bg: #f0e0d8;    /* 警告背景 */
  --breaking-fg: #8b4513;    /* 警告前景 */
}
```

### 日韩特调

日文/韩文辅助文字色使用 `#4d4c48`（比中英的 `#504e49` 稍深）。

### 禁止色值

- `#ffffff`（纯白）
- `#f8f9fa`, `#f3f4f6`（冷灰系列）
- 任何渐变填充
- drop-shadow（仅允许一处 `0 4pt 24pt rgba(0,0,0,0.05)` 微光）

---

## 间距系统

基数：**4pt**（印刷）/ **4px**（屏幕）

| 级别 | 值 |
|------|------|
| xs | 2–3pt |
| sm | 4–5pt |
| md | 8–10pt |
| lg | 16–20pt |
| xl | 24–32pt |
| 2xl | 40–60pt |
| 3xl | 80–120pt |

### 圆角梯度

4pt → 6pt → 8pt → 12pt → 16pt → 24pt → 32pt

默认圆角：8pt。

---

## 页面布局（A4 边距）

| 文档类型 | 上 | 右 | 下 | 左 |
|----------|-----|-----|-----|-----|
| 简历 | 11mm | 13mm | 11mm | 13mm |
| 单页报告 | 15mm | 18mm | 15mm | 18mm |
| 长文档 | 20mm | 22mm | 20mm | 22mm |
| 信件 | 25mm | 25mm | 25mm | 25mm |
| 作品集 | 12mm | 15mm | 12mm | 15mm |
| 研报 | 16mm | 18mm | 18mm | 18mm |

### 落地页布局

- 最大宽度：1120px 居中
- 外框内距：88px 64px 120px
- 断点：880px / 480px
- 手机侧距：16px（桌面 64px）
- 段落节奏：桌面 96/72px，平板 72/54px，手机 56/42px

---

## 多语言排版策略

### 核心方法

1. **每种语言一套模板**，不做运行时语言检测切换
2. 通过 CSS 变量 `--serif` 按 `html[lang]` 切换字体栈
3. 结构性 token（颜色、间距、圆角）全语言共享
4. 仅针对**字间距、行高、显示字号**做语言微调
5. 文字折行问题通过**编辑内容**解决，不改全局 CSS
6. 每个语言在 **375px** 和 **1280px** 两个宽度截图验收

### 语言特定调整

| 属性 | 英文 | 中文 | 日文 | 韩文 |
|------|------|------|------|------|
| 落地页标题 | 96px | 88px | 88px | 88px |
| 正文行高 | 1.55 | 1.55–1.65 | 1.55–1.65 | 1.55 |
| 正文字间距 | 0 | 0.1–0.3pt | 0.02em | 0.3pt |
| font-synthesis | auto | auto | auto | none |

### 日文特殊处理

```css
html[lang="ja"] .lede {
  font-size: clamp(12.5px, 1.2vw, 14.5px); /* 适配日文长文本 */
  white-space: nowrap;
}
```

---

## 应用到 easy-convert-ai 的建议

### 可直接复用

- 配色体系（暖色纸质风格，区分于常见的冷灰 SaaS）
- 间距/圆角梯度系统
- 字重三级制（400/500/600）
- 多语言字体栈定义方式

### 需要适配

- Kami 是印刷/文档系统，easy-convert-ai 是 Web 工具产品
- 正文字号需要从 pt 转为 px/rem（推荐 14–16px 正文）
- 品牌色可替换为项目自有色
- 等宽字体用于代码展示区域

### CSS 变量实现示例

```css
:root {
  --font-serif-en: Charter, Georgia, Palatino, "Times New Roman", serif;
  --font-serif-zh: "Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", Georgia, serif;
  --font-sans: Inter, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace;

  --text-primary: #141413;
  --text-secondary: #3d3d3a;
  --text-tertiary: #504e49;
  --text-muted: #6b6a64;

  --surface-page: #f5f4ed;
  --surface-card: #faf9f5;
  --surface-border: #e8e6dc;

  --brand: #1B365D;
  --brand-light: #2D5A8A;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
}

html[lang="zh-CN"] { --font-body: var(--font-serif-zh); }
html[lang="en"] { --font-body: var(--font-serif-en); }
```

---

## 参考资源

- [Kami GitHub](https://github.com/tw93/kami)
- [Source Han Serif (思源宋体)](https://github.com/adobe-fonts/source-han-serif)
- [Inter 字体](https://rsms.me/inter/)
- [Charter 字体](https://practicaltypography.com/charter.html)
