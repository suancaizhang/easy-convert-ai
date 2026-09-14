# Kami 换肤提交审核与待办（接力文档）

> 创建于 2026-07-17。供下次 agent 接手处理。
> 源审核：对 `master` 领先 `origin/master` 的 7 个本地提交做全面 code review。

## 1. 背景：本次未 push 的 7 个提交

```
77143f4 fix: 修复遗漏的旧样式类名替换（工具页、登录、预览组件）【agent】
1eaeaab feat: 7个工具页面完成 Kami 换肤【agent】
77bcedb feat: convert 和 history 页面完成 Kami 换肤【agent】
2f0b323 feat: ToolPageLayout 共享组件完成 Kami 换肤【agent】
94271d8 feat: 首页和根布局完成 Kami 暖色换肤【agent】
4097578 feat: 建立 Kami 设计 token 体系和 Tailwind 主题映射【agent】
d8fa34b docs: 添加 Kami 设计体系适配方案 spec【agent】
```

统计：23 文件，+1414 / -195。改动范围 = token 体系 + 全站换肤 + 新增站内预览组件群 + images-to-pdf 工具页。

## 2. 结论：不可推送

换肤本身 token 体系设计合理，颜色映射基本一致。但存在 1 个硬阻塞和若干 Major 问题，**推送前必须先处理**。

---

## 3. 🔴 Blocker

### B1. 提交不完整——预览功能依赖的整条链路都没进提交

7 个提交引入了预览组件群（`FilePreview/PdfPreview/DocxPreview/ImagePreview/PreviewModal`）和工具页对 `tool.showPreview / closePreview` 的调用，但依赖的基础设施全部停留在**工作区未提交**状态：

| 依赖文件 | 工作区状态 | 后果 |
|---|---|---|
| `web/src/lib/fetchTaskFile.ts` | `??` 未跟踪 | `import { fetchTaskFile }` 报模块找不到 |
| `web/src/lib/useToolPage.ts` | `M`（+13/-9）未提交 | `tool.showPreview / closePreview` 不存在于提交版本，TS 编译失败 |
| `web/package.json` + `package-lock.json` | `M` 未提交 | `docx-preview / react-pdf / react-photo-view / @dnd-kit/*` 未声明，安装即缺包 |
| `web/src/i18n/*.ts`（zh/en/th/vi/id/ms/fil + types） | `M` 未提交 | `preview.* / imagesToPdf.* / convert.previewDocx / ocr.preview` 全部缺失，`t()` 返回 key 本身 |
| `api/app/routers/tasks.py` | `M` 未提交 | `ImagePreview` 调用的 `GET /api/tasks/{id}/pages` 与 `/download/{page_index}` 端点不存在，运行时 404 |

验证命令：
```bash
git log --oneline origin/master..HEAD -- web/src/lib/fetchTaskFile.ts   # 无输出 = 未提交
git diff -- web/src/lib/useToolPage.ts                                    # 有改动 = 未提交
git diff -- web/package.json | grep -iE "docx-preview|react-pdf|react-photo-view|dnd-kit"
git diff -- web/src/i18n/en.ts | grep -iE "preview|imagesToPdf|previewDocx"
git diff -- api/app/routers/tasks.py | grep -E "pages|download/\{page"
```

→ 推送这 7 个提交后，CI / 他人拉取 `npm run build` 必失败，预览功能运行时 404。**必须把上述工作区改动整理进提交后再推送。**

### useToolPage 工作区改动内容（未提交）
```diff
-  preview: () => Promise<void>;
+  preview: () => void;
+  showPreview: boolean;
+  closePreview: () => void;
// preview 从"调 fetchResult(true)"改成"setShowPreview(true)"
// 新增 closePreview = () => setShowPreview(false)
// reset 里追加 setShowPreview(false)
// return 追加 showPreview / closePreview
```

### fetchTaskFile.ts（未跟踪新文件）
导出 `fetchTaskFile(taskId, { path, preview, json })`，从 `useToolPage` 的 fetchResult 逻辑抽出，供预览组件复用。封装 `/api/tasks/{id}/download[?preview=1]`、`/pages`、`/download/{i}`，带 Bearer token。

---

## 4. 🟠 Major

### M1. OCR 登录校验被注释掉，混在换肤提交里
- 文件：`web/src/app/tools/ocr/page.tsx:85-88, 102-110`
- 内容：
  ```ts
  // TODO: 测试期间放开登录限制，上线前恢复
  // if (!user) { router.push("/login"); return; }
  const loginPrompt = null; // TODO: 测试期间隐藏登录提示，上线前恢复
  ```
- 风险：OCR 走 PaddleOCR 云 API（计费）+ 配额。绕过登录=匿名无配额限制占用计费资源，有被刷风险。
- 处理：恢复登录校验，或拆独立提交并显式标注。

### M2. 首页品牌文字被注释掉，logo 位空白
- 文件：`web/src/app/page.tsx:75`
- 内容：`{/* Easy Convert AI */}` 注释掉了品牌文字，没替换任何标识。
- 处理：恢复文字，或替换为 Kami 体系的品牌标识。

### M3. PdfPreview worker 走 unpkg CDN，运行时外网依赖
- 文件：`web/src/components/preview/PdfPreview.tsx:11`
- 内容：`pdfjs.GlobalWorkerOptions.workerSrc = //unpkg.com/pdfjs-dist@.../pdf.worker.min.mjs`
- 风险：WSL2 网络约束 + 内网/离线部署时 PDF 预览直接失效。
- 处理：本地 bundle，`import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"` 或 `new Worker(new URL(...))`。

### M4. docx 预览后端兼容性未验证
- `convert/page.tsx` 与 `history/page.tsx` 把 `pdf_to_word` / `ocr_to_word` 的 `PREVIEWABLE_TYPES` 从 `false` 改 `true`，走 `DocxPreview` 拉 `GET /api/tasks/{id}/download?preview=1`。
- 需确认后端 `/download` 对 `.docx` 返回 `FileResponse` 流（而非只处理 PDF/image）。

---

## 5. 🟡 Minor

| 编号 | 位置 | 问题 | 建议 |
|---|---|---|---|
| m1 | `PdfPreview.tsx:73-109` 工具栏 | 仍用 `hover:bg-gray-100`、`text-gray-300`、裸 `border` | 换成 token：`hover:bg-page`、`text-muted`、`border-border` |
| m2 | `FilePreview.tsx:60-66` | cleanup 引用 `pdfFile` 闭包 + eslint-disable exhaustive-deps，陈旧闭包风险 | 在 `.then` 用局部变量捕获 url，cleanup revoke 局部变量 |
| m2 | `ImagePreview.tsx:69-72` | cleanup `imageUrls` 是闭包旧值（依赖只 taskId），loadImages 进行中重渲/卸载会漏 revoke → 内存泄漏 | effect 内创建的 urls 存 ref 或局部变量再 revoke |
| m3 | `images-to-pdf/page.tsx` SortableImageCard | `bg-black/60`、`bg-black/50`、`hover:bg-red-600` 硬编码 | 走 token 或确认 overlay 局部样式可接受 |
| m4 | `ToolPageLayout.tsx:118,124` | 下载按钮从 `bg-green-600` 改 `bg-brand`，与预览按钮同色，丢失语义区分 | 下载用 `success` 语义或保留差异化 |
| m5 | `page.tsx` | 新增 `useState` 把"两组并列"改"tab 切换"，`imagesToPdf` 入口从 `/convert?taskType=` 改到 `/tools/images-to-pdf` | 交互/路由变更混入换肤提交，边界不清；可拆独立提交 |

---

## 6. ⚪ Nit

- **n1** `tailwind.config.ts` 把 `borderRadius.DEFAULT` 重定义为 `--radius-md`(8px)，影响所有未显式指定圆角的 `rounded`——需全局回归确认视觉。
- **n2** `globals.css` 默认 `--font-content = --font-serif-zh`（衬线），正文走衬线是 Kami 明确取向，需确认产品/设计已确认中文正文可读性。
- **n3** `page.tsx:75` 留了 `{/* Easy Convert AI */}` 死注释，应删除或恢复。

---

## 7. 给下次 agent 的处理清单

按顺序执行：

1. **整理工作区未提交改动为独立提交**（B1）
   - `feat: 站内预览基础设施（fetchTaskFile + useToolPage 预览态 + 后端分页端点 + i18n + 依赖）`
   - 包含：`web/src/lib/fetchTaskFile.ts`（新）、`web/src/lib/useToolPage.ts`、`web/package.json` + lock、`web/src/i18n/*.ts`、`api/app/routers/tasks.py`
   - 也可按服务拆成 2 个提交（前端 + 后端）
2. **恢复 OCR 登录校验**（M1）——或拆独立提交显式标注"测试期间放开"
3. **补齐 PdfPreview 工具栏换肤**（m1）
4. **修 Blob URL cleanup 陈旧闭包**（m2 两处）
5. **确认 docx 预览后端走通**（M4）
6. **PDF worker 改本地 bundle**（M3）
7. **可选**：处理 m3/m4/n1/n2/n3
8. **验证**：`cd web && npm run lint && npm run build`，确认通过
9. **推送**：`git pull --rebase origin master && git push origin HEAD:refs/for/master`

## 8. 工作区当前未提交文件全量（供整理提交用）

```
M  api/app/routers/quota.py
M  api/app/routers/tasks.py
M  web/package-lock.json
M  web/package.json
M  web/src/i18n/en.ts
M  web/src/i18n/fil.ts
M  web/src/i18n/id.ts
M  web/src/i18n/ms.ts
M  web/src/i18n/th.ts
M  web/src/i18n/types.ts
M  web/src/i18n/vi.ts
M  web/src/i18n/zh-CN.ts
M  web/src/lib/useToolPage.ts
M  worker/worker/converters/excel_to_pdf.py
M  worker/worker/converters/images_to_pdf.py
M  worker/worker/converters/pdf_to_image.py
M  worker/worker/converters/pdf_to_word.py
M  worker/worker/converters/ppt_to_pdf.py
M  worker/worker/converters/word_to_pdf.py
M  worker/worker/models.py
?? web/src/lib/fetchTaskFile.ts
```

> 注：`worker/` 下的 6 个 converter + `models.py` 改动也属未提交，需一并审查（本次审核聚焦前端换肤提交，未覆盖 worker 改动）。`api/app/routers/quota.py` 同理。
