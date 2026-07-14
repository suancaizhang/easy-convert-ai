# Issue: 文档转换完成后前端缺少删除入口

- **状态**: ✅ 已实现（Commit c2f1398）
- **优先级**: P1
- **标签**: `enhancement`, `frontend`, `backend`
- **创建日期**: 2026-07-14

---

## 问题描述

用户在 `/convert` 页面上传并转换文档后，**没有任何删除已上传/已转换文档的入口**。历史页面（`/history`）也只支持查看记录，没有删除操作。

目前用户在以下场景中无法删除文档：

| 场景 | 页面 | 当前可操作项 |
|------|------|-------------|
| 转换完成 | `/convert` done 阶段 | 下载、继续转换 |
| 转换失败 | `/convert` error 阶段 | 重试 |
| 历史记录 | `/history` | 查看（只读） |
| 上传后、转换前 | `/convert` upload 阶段 | 无（只能覆盖选择） |

## 影响

- 用户上传了敏感文件后无法主动删除，存在隐私顾虑
- 文件累积无法清理，用户无法管理自己的存储
- 选错文件时无法直接移除，只能刷新页面重来
- 不提供删除操作会让用户对平台产生不信任感

## 当前实现分析

### 后端（API 端）

**相关文件**: `api/app/routers/documents.py`

- 只实现了 `POST /api/documents/upload`（上传端点）
- **没有 DELETE 端点**，不支持删除文档
- Document 模型有 `file_status` 字段（值为 `active`/`expired`），可以通过软删除利用
- Task 模型外键关联 Document，删除文档前需要先清理关联的 Task

### 前端

**相关文件**: `web/src/app/convert/page.tsx`

- `stage` 状态机：`upload` → `converting` → `done`/`error`
- `done` 阶段：只渲染「下载」和「继续转换」两个按钮
- `error` 阶段：只渲染「重试」按钮
- 任何阶段都没有删除操作

**相关文件**: `web/src/app/history/page.tsx`

- 纯展示列表，无交互操作按钮
- `api.ts` 中已封装 `api.delete<T>(path)` 方法，前端调用层已就绪

### 数据模型

**相关文件**: `api/app/models.py`

```python
class Document(Base):
    __tablename__ = "documents"
    # ...
    file_status: str  # "active" | "expired"
    
    tasks: list[Task]  # 一对多关系，删除时需级联
```

## 建议修复方案

### 1. 后端：添加 DELETE 端点

在 `api/app/routers/documents.py` 中添加：

```python
@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除文档及其关联的任务记录"""
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")
    
    # 级联删除关联任务
    db.query(Task).filter(Task.document_id == document_id).delete()
    # 删除物理文件（可选）
    # if os.path.exists(doc.oss_path):
    #     os.remove(doc.oss_path)
    db.delete(doc)
    db.commit()
```

**要点**：
- 需要从 `app.models` 中 import `Task`
- 需要从 `app.deps` 中 import `get_current_user`
- 支持游客删除（可选）：游客的 document 没有 user_id，需要用 session/Cookie 来验证所有权
- 文件清理建议用 try/except 包裹，物理文件删除失败不应阻塞数据库操作

### 2. 前端：转换页面添加删除入口

**修改**: `web/src/app/convert/page.tsx`

#### 2a. done 阶段增加「删除文件」按钮

```tsx
// 在 download 和 继续转换 之间插入
{stage === "done" && (
  <>
    {/* 现有下载和继续按钮 */}
    <button onClick={handleDelete} className="w-full border border-red-200 text-red-500 rounded-md py-3 text-sm hover:bg-red-50">
      删除文件
    </button>
  </>
)}
```

#### 2b. error 阶段增加「删除文件」按钮

允许用户在转换失败时删除已上传的文件。

#### 2c. upload 阶段增加「移除已选文件」

在已选择文件后，文件名旁边增加 `×` 关闭按钮，允许用户在不刷新页面的情况下取消选择。

#### 2d. 实现 handleDelete 函数

```typescript
const handleDelete = async () => {
  if (!confirm("确定要删除此文件吗？删除后无法恢复。")) return;
  
  try {
    await api.delete(`/api/documents/${documentId}`);
    handleReset(); // 重置到上传状态
  } catch (err) {
    if (err instanceof ApiError) {
      setError(err.message);
    } else {
      setError("删除失败，请重试");
    }
  }
};
```

### 3. 前端：历史页面添加删除功能

**修改**: `web/src/app/history/page.tsx`

每行记录右侧添加删除按钮（垃圾桶图标），点击后弹出确认对话框，删除成功后从列表中移除该行并更新总数。

```tsx
// 在每条记录的右侧操作区
<div className="flex items-center gap-2">
  {isExpired && <span className="text-xs ...">已过期</span>}
  {item.task_status && STATUS_LABELS[item.task_status] && ( ... )}
  <button
    onClick={() => handleDelete(item.id)}
    className="text-gray-400 hover:text-red-500 p-1"
    title="删除"
  >
    🗑️
  </button>
</div>
```

## 涉及文件清单

| 文件 | 修改类型 | 描述 |
|------|---------|------|
| `api/app/routers/documents.py` | 新增 | 添加 `DELETE /api/documents/{id}` 端点 |
| `web/src/app/convert/page.tsx` | 修改 | done/error/upload 阶段添加删除入口 |
| `web/src/app/history/page.tsx` | 修改 | 每条记录添加删除按钮 |

## 验收标准

- [ ] 后端 `DELETE /api/documents/{id}` 端点正常工作，返回 204
- [ ] 不存在的文档 ID 返回 404
- [ ] 非所有者删除返回 403/404（不暴露存在性）
- [ ] 删除文档同时删除关联任务记录
- [ ] 物理文件从磁盘清理（不阻塞接口）
- [ ] 转换完成页「删除文件」按钮可点击并成功删除
- [ ] 转换失败页「删除文件」按钮可点击并成功删除
- [ ] 上传阶段可移除已选文件（× 按钮）
- [ ] 历史页每行可点击删除，删除后列表刷新
- [ ] 删除前弹出确认对话框
- [ ] 删除失败显示错误提示
- [ ] 游客的文档删除有合理的鉴权逻辑

## 注意事项

- 删除是永久性操作，**前端必须确认弹窗**
- 游客（无 user_id）删除方案需要额外设计，可以考虑删除时传入 upload 时返回的临时 token
- 删除后应清除前端 state/polling，避免后续操作报错
- 历史页推荐使用 `optimistic delete`（先删除列表中条目，请求失败再恢复），提升交互响应感
