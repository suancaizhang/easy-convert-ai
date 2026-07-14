# 多图合并转 PDF 功能设计

## 概述

在 easy-convert-ai 中新增独立页面 `/merge-images`，支持用户一次上传多张图片（最多 20 张），通过拖拽排序确定顺序后，合并生成一个多页 PDF 文件（每张图片原样嵌入为一页）。

## 需求摘要

| 项目 | 内容 |
|------|------|
| 功能 | 多张图片按顺序合并为一个多页 PDF |
| 入口 | 新建独立页面 `/merge-images` |
| 图片数量 | 2~20 张 |
| 支持格式 | PNG、JPG、WebP |
| 交互 | 拖拽排序 + 缩略图预览 |
| 输出 | 单个 PDF，每张图片占一页 |
| 配额 | 一次合并消耗 1 次配额 |

## 技术方案

采用**方案 A：多次上传 + 批量任务创建**。

- 前端逐个上传图片（复用现有 `/api/documents/upload`），并发执行
- 上传完成后用户可拖拽排序
- 点击合并调用新接口 `POST /api/tasks/create-merge`，传入有序 document_ids
- Worker 层已有的 `ImagesToPdfConverter` 支持多路径输入，零改动

## 前端设计

### 页面路径

`/merge-images` — 独立页面

### 页面结构

1. **标题区** — "图片合并为 PDF"，简短功能说明
2. **上传区** — 点击或拖拽上传区域，支持一次选择多个文件
   - `accept`: `image/png, image/jpeg, image/webp`
   - 最多 20 张，超出提示
3. **图片列表区** — 缩略图网格展示
   - 每张图：缩略图 + 文件名 + 上传状态（进度/完成/失败）
   - 拖拽排序（原生 HTML5 drag & drop，不引入额外依赖）
   - 每张图右上角删除按钮
   - 失败的图片可重试
4. **操作区**
   - "开始合并" 按钮（所有图片上传成功 + 至少 2 张时启用）
   - 转换中：进度状态
   - 完成后：下载按钮

### 交互流程

```
选择图片 (≤20, png/jpg/webp)
    ↓
并发上传（每张独立进度条）
    ↓
上传完成 → 拖拽调整顺序
    ↓
点击「开始合并」
    ↓
轮询任务状态
    ↓
完成 → 下载 PDF
```

### 拖拽排序实现

使用原生 HTML5 Drag and Drop API：
- `dragstart` / `dragover` / `drop` 事件
- 图片数量 ≤20，原生 API 性能足够，无需引入第三方库

## 后端 API 设计

### 复用接口

`POST /api/documents/upload` — 单文件上传，无需修改

### 新增接口

#### `POST /api/tasks/create-merge`

创建多图合并转换任务。

**请求体**：
```json
{
  "document_ids": ["uuid1", "uuid2", "uuid3"],
  "task_type": "images_to_pdf"
}
```

**校验逻辑**：
1. `document_ids` 长度 2~20
2. 所有 document 存在且属于当前用户；游客场景下校验 `user_id IS NULL`（与现有单文件任务逻辑一致）
3. 所有 document 的 `file_type` 为图片格式（png/jpg/webp）
4. 检查用户配额（消耗 1 次）

**响应**：
```json
{
  "task_id": "uuid",
  "status": "pending"
}
```

**错误响应**：
- `400` — document_ids 数量不合法、文档不存在、格式不对
- `403` — 配额不足

### 数据模型调整

Task 表新增字段：
- `source_document_ids`: JSON array，存储有序的文档 ID 列表

现有 `document_id` 字段保留，指向列表中第一个文档，兼容现有的删除/查询逻辑。

### Celery 任务处理

任务 handler 根据 `source_document_ids`：
1. 按顺序获取每个 document 的物理文件路径
2. 用逗号连接路径，传给 `ImagesToPdfConverter.convert()`
3. 其余逻辑（状态更新、结果保存）与现有单文件任务一致

## Worker 层

`ImagesToPdfConverter` 已支持逗号分隔多路径输入，**无需修改**。

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| 单张图片上传失败 | 标红该图片，允许重试或移除，不影响其他 |
| 文件格式不对 | 前端 accept 过滤 + 后端校验双重保障 |
| 超过 20 张 | 前端阻止添加，提示"最多 20 张" |
| 单张超过 20MB | 上传时后端返回 400，前端标红提示 |
| 配额不足 | 点击合并时返回 403，前端提示 |
| Worker 转换失败 | Task status → failed，前端显示错误信息 |
| 部分文档过期/不存在 | create-merge 校验失败，返回具体哪些文档有问题 |

## 配额与限制

- 一次合并操作消耗 **1 次**配额（不论图片数量）
- 单张图片最大 20MB（现有限制）
- 图片数量限制：2~20 张
- 上传文档 24 小时过期（现有逻辑）
- 转换结果遵循现有过期机制

## 范围外（不做）

- 图片旋转/裁剪编辑
- PDF 页面尺寸自定义
- 多图转 Word（OCR 合并）
- 前端纯客户端合并
