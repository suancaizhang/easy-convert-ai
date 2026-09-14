# Phase 1 技术决策记录

基于 PRD Grilling 会话，2026-07-16

---

## 决策汇总

| # | 决策领域 | 结论 |
|---|----------|------|
| 1 | 当前阶段 | Phase 1 做扎实，不急于进入 AI 能力 |
| 2 | 优先序 | 基础设施修复归部署前清单，当前直接做功能扩展 |
| 3 | 本地环境 | 链路已通（非 Docker），直接开发新功能 |
| 4 | 功能扩展排序 | A(PDF工具箱) → B(OCR增强) → C(高级能力留后续) |
| 5 | PDF工具技术方案 | 纯 PyMuPDF，不引入 Ghostscript |
| 6 | 任务模型 | 全部走 Celery 异步队列 |
| 7 | 类型设计 | 复用 conversion_type 体系，Task 加 `params` JSON 字段 |
| 8 | 多文件上传 | 多次上传 + 一次提交（传 document_ids） |
| 9 | 队列分配 | PDF 工具箱全走 `default` 队列 |
| 10 | 前端路由 | `/convert` 保留格式转换，`/tools/*` 放工具箱 |
| 11 | 页面组件 | 抽 `ToolPageLayout` 通用组件 |
| 12 | 迁移策略 | 统一重构，`/convert` 和 `/merge-images` 也迁移到 ToolPageLayout |
| 13 | /convert 改进 | 只做组件结构迁移，交互行为不变 |
| 14 | /merge-images | 合并到 `/tools/merge`，支持 PDF+图片混合输入，原路由 redirect |
| 15 | 首页 | 分组展示（格式转换 + PDF 工具箱） |
| 16 | PDF↔Word | 保持分开两个独立入口 |
| 17 | OCR 输出格式 | TXT + Searchable PDF 进 Phase 1，Excel 表格识别后续再排 |
| 18 | OCR 输入 | 统一入口，接受图片 + PDF |
| 19 | OCR 输出选择 | 始终显示三个选项（DOCX/TXT/Searchable PDF），图片输入也生成带文字层 PDF |
| 20 | 范围确认 | 清单确认，无增减 |
| 21 | 多文件关联 | 用 `params.document_ids` 数组，不建关联表 |
| 22 | 国际化 | 7 种语言同步补齐 |
| 23 | 翻译方式 | AI 生成全部 7 种语言初稿，标记待校对，后续母语者审核 |

---

## Phase 1 工作范围

### 前端重构

- 抽取 `ToolPageLayout` 通用组件（上传区 + 参数插槽 + 提交 + 轮询 + 下载）
- `/convert` 迁移到 ToolPageLayout（行为不变）
- `/merge-images` 合并到 `/tools/merge`，原路由 redirect
- 首页改版：分组展示（格式转换 + PDF 工具箱）

### PDF 工具箱（新功能）

| 路由 | conversion_type | params |
|------|-----------------|--------|
| `/tools/merge` | `pdf_merge` | `{"document_ids": [...], "order": [0,1,2]}` |
| `/tools/split` | `pdf_split` | `{"pages": "1-3,5,7-10"}` |
| `/tools/compress` | `pdf_compress` | `{"quality": "low\|medium\|high"}` |
| `/tools/rotate` | `pdf_rotate` | `{"angle": 90, "pages": "all\|1,3,5"}` |
| `/tools/watermark` | `pdf_watermark` | `{"text": "...", "opacity": 0.3, "position": "center"}` |

技术实现：全部基于 PyMuPDF，走 Celery `default` 队列。

### OCR 增强

- 统一 OCR 入口，接受图片（JPG/PNG/WebP）+ PDF
- 输出格式扩展：DOCX（已有）/ TXT（新增）/ Searchable PDF（新增）
- 用户选输出格式，通过 `params.output_format` 传递

### 后端改动

- Task 模型新增 `params: JSON` 可选字段（Alembic 迁移）
- 5 个 PDF 工具的 converter 模块
- OCR 输出 TXT 的 converter 逻辑
- OCR 输出 Searchable PDF 的 converter 逻辑（PyMuPDF 叠加文字层）
- 合并任务：从 `params.document_ids` 加载多个文件路径

### 不包含在本次范围内

- 批量处理
- 文件在线预览/编辑
- OCR → Excel 表格识别
- Phase 2/3 AI 能力（文档问答、总结、翻译、Agent）
- 支付/会员体系
- Google/Apple/手机号登录

---

## 部署前清单（Docker 修复）

上云部署前需要处理：

1. **共享卷**：Worker 结果文件（`/tmp/convert_*`）需通过 Docker volume 与 API 容器共享
2. **Worker CMD**：Dockerfile 添加 `-Q default,office` 确保订阅所有队列
3. **PDF→图片多文件下载**：修复只返回第一张的问题，支持 zip 打包或逐张下载

---

## 后续阶段预留

- OCR → Excel 表格识别
- 批量处理（多文件同时转换/OCR/压缩）
- 文件在线预览
- 简单编辑（删除/添加页面、标注）
- Phase 2 AI 文档助手
- Phase 3 AI Agent 工作流
- Phase 4 企业 API 服务
