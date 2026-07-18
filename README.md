# Easy Convert AI

AI 驱动的在线文档转换平台，支持 PDF、Word、Excel、PPT、图片之间的格式互转，集成 OCR 文字识别。

## 功能特性

- **PDF ↔ Word**: PDF 提取文本转 Word，Word 转 PDF
- **Office → PDF**: Excel、PPT 一键转 PDF（LibreOffice 引擎）
- **PDF → 图片**: PDF 逐页渲染为 PNG（150 DPI）
- **图片 → PDF**: 多张图片合并为 PDF
- **OCR 识别**: PaddleOCR-VL 1.6 云服务，支持中英文识别
- **多图合并转 PDF**: 支持 2~20 张图片批量合并为单个 PDF，独立页面操作
- **用户体系**: 注册登录、JWT 鉴权、游客免注册试用
- **配额管理**: 注册用户 8 次/天，游客 3 次/天（IP 限流），自动重置
- **异步处理**: Celery 双队列架构，Office 转换隔离，支持重试
- **转换历史**: 分页查看历史记录，过期文件标记
- **文档删除**: 支持删除已上传/已转换文档及关联任务记录，自动清理物理文件
- **转换预选**: 首页直达入口，通过 `?taskType=` 参数预选转换类型，跳过类型选择步骤
- **自定义字体**: 内置自定义字体（Luo），优化文档渲染效果

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 15 + React 19 + TypeScript + Tailwind CSS |
| 后端 API | FastAPI + SQLAlchemy 2.0 + Alembic |
| 任务队列 | Celery 5.4 + Redis（双队列: default / office） |
| 数据库 | PostgreSQL 16 |
| 转换引擎 | PyMuPDF、python-docx、LibreOffice Headless |
| OCR | PaddleOCR-VL 1.6 云服务 |
| 部署 | Docker Compose（5 容器） |

## 架构

```
┌──────────┐     ┌──────────┐     ┌───────────┐
│  Next.js │────▶│ FastAPI  │────▶│   Redis   │
│  :3000   │     │  :8000   │     │   :6379   │
└──────────┘     └────┬─────┘     └─────┬─────┘
                      │                  │
                      ▼                  ▼
                ┌──────────┐     ┌───────────────┐
                │PostgreSQL│     │ Celery Worker  │
                │  :5432   │     │ (default+office)│
                └──────────┘     └───────────────┘
```

> 注：Docker 部署暴露 `:8000`，本地开发通常使用 `:8111`。

**数据流**:
1. 用户上传文件 → API 存储到共享卷 → 返回 document_id
2. 用户创建转换任务 → API 扣配额 → Celery 派发到对应队列
3. Worker 执行转换 → 结果写入共享卷 → 更新任务状态
4. 前端轮询任务状态 → 完成后下载结果文件

## Docker 部署

### 前置条件

- Docker & Docker Compose v2
- Node.js 20+（前端本地开发）
- Python 3.11+（后端本地开发）

### 一键启动

```bash
# 1. 复制环境变量
cp .env.example .env

# 2. 编辑 .env，至少设置 JWT_SECRET
#    JWT_SECRET=your-random-secret-here

# 3. 启动所有服务
docker compose up --build
```

启动后访问：

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3000 |
| API | http://localhost:8000 |
| API 文档 (Swagger) | http://localhost:8000/docs |
| 健康检查 | http://localhost:8000/health |

## 本地开发

以下步骤适用于 **WSL2 + 原生 PostgreSQL/Redis** 环境（Windows 项目代码挂载在 WSL2 的 `/mnt/d` 下）。

### 环境架构

```
Windows (D盘)                    WSL2 (Ubuntu)
┌──────────────┐     /mnt/d     ┌──────────────────────┐
│  项目代码    │◄──── 挂载 ────│  FastAPI (:8111)     │
│  D:\workspace│                │  Celery Worker       │
│  \easy-conve-│                │  PostgreSQL (:5432)  │
│  rt-ai       │                │  Redis (:6379)       │
└──────────────┘                └──────────────────────┘
```

> 所有命令都在 **WSL2 终端** 中执行。Windows 浏览器通过 `http://localhost:8111` 访问 API（WSL2 端口自动转发）。

### 1. 环境变量配置

```bash
cd /mnt/d/workspace/easy-convert-ai

# 复制环境变量模板
cp .env.example .env
```

编辑 `.env`，确保内容如下（WSL2 本地部署）：

```env
# Database
DATABASE_URL=postgresql://easyconvert:easyconvert_dev@localhost:5432/easyconvert

# Redis
REDIS_URL=redis://localhost:6379/0

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# JWT（必填）
JWT_SECRET=dev-secret-key-easy-convert-ai-2024
```

> ⚠️ 所有服务地址用 `localhost` 而非 `postgres`/`redis`（Docker 容器名在本地不可用）。
> ⚠️ `JWT_SECRET` 必须设置，否则启动报错。
> ⚠️ `.env` 中只保留 Settings 类声明的字段，多余的变量会导致 pydantic 校验失败。

### 2. 启动后端 API（FastAPI）

```bash
cd /mnt/d/workspace/easy-convert-ai/api

# 创建虚拟环境（首次）
python3 -m venv .venv

# 激活虚拟环境
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 运行数据库迁移
export DATABASE_URL=postgresql://easyconvert:easyconvert_dev@localhost:5432/easyconvert
export JWT_SECRET=dev-secret-key-easy-convert-ai-2024
./.venv/bin/python -m alembic upgrade head

# 启动 API 服务
# --reload: 代码变更自动重载，开发时使用
# --host 0.0.0.0: 监听所有网络接口，允许 Windows 浏览器访问
# --port 8111: 端口号，可根据需要修改
./.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8111
```

验证：
- Windows 浏览器打开 `http://localhost:8111/docs` 查看 Swagger 文档
- `http://localhost:8111/health` 返回 `{"status":"healthy"}`

> 💡 如果端口冲突，修改 `--port` 参数，同时更新前端代码中的 API 地址默认值。

### 3. 启动 Celery Worker

```bash
cd /mnt/d/workspace/easy-convert-ai/worker

# 创建虚拟环境（首次）
python3 -m venv .venv

# 激活虚拟环境
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动 Worker（需要先启动 Redis）
# -Q default,office: 监听两个队列，office 用于 Office 文档转换
# --loglevel=info: 显示任务执行日志
DATABASE_URL=postgresql://easyconvert:easyconvert_dev@localhost:5432/easyconvert \
CELERY_BROKER_URL=redis://localhost:6379/0 \
CELERY_RESULT_BACKEND=redis://localhost:6379/1 \
./.venv/bin/celery -A worker.celery_app worker --loglevel=info -Q default,office
```

> ⚠️ Worker 需要以下环境变量，默认值均使用 Docker 容器名（`postgres`、`redis`），WSL2 下必须传 `localhost`：
> - `DATABASE_URL` — 连接 PostgreSQL（Worker 直接读写数据库，非通过 API 代理）
> - `CELERY_BROKER_URL` — 连接 Redis Broker
> - `CELERY_RESULT_BACKEND` — 连接 Redis Result Backend
>
> 也可以先用 `export` 设置，后续启动不再重复传：
> ```bash
> export DATABASE_URL=postgresql://easyconvert:easyconvert_dev@localhost:5432/easyconvert
> export CELERY_BROKER_URL=redis://localhost:6379/0
> export CELERY_RESULT_BACKEND=redis://localhost:6379/1
> ```
> ⚠️ LibreOffice 转换（excel_to_pdf、ppt_to_pdf、word_to_pdf）需要系统安装 LibreOffice：`sudo apt install libreoffice-core`。

验证：
- 启动后看到 `celery@hostname ready` 和 `connected to redis://localhost:6379/0` 表示成功
- 通过 API 创建转换任务后，Worker 日志会显示任务执行过程

### 4. 启动前端（Next.js）

```bash
cd /mnt/d/workspace/easy-convert-ai/web

# 安装依赖（首次）
npm install

# 创建环境变量文件（可选，默认使用 localhost:8111）
echo "NEXT_PUBLIC_API_URL=http://localhost:8111" > .env.local

# 启动开发服务器
npm run dev
```

> 前端默认连接 `http://localhost:8111`，如果 API 端口修改了，需要同步更新 `.env.local` 中的 `NEXT_PUBLIC_API_URL`。
> 前端运行在 `http://localhost:3000`，Windows 浏览器直接访问即可。

### 启动顺序

正确的启动顺序：

```
1. PostgreSQL ──→ 2. Redis ──→ 3. API Server ──→ 4. Worker ──→ 5. Frontend
   (数据库)        (缓存/队列)    (FastAPI)        (转换任务)     (Next.js)
```

### cloudflared tunnel远程

cloudflared.exe tunnel --url http://localhost:3000
cloudflared.exe tunnel --url http://localhost:8111
$env:NEXT_PUBLIC_API_URL="https://happened-blanket-folks-patterns.trycloudflare.com"; npm run dev

### 调试技巧

**API 调试**：
- Swagger 文档：`http://localhost:8111/docs` — 在线调试所有接口
- 健康检查：`http://localhost:8111/health` — 查看数据库和 Redis 连接状态
- uvicorn 以 `--reload` 模式启动，修改 Python 代码后自动重启

**Worker 调试**：
- 增加 `--loglevel=debug` 查看更详细的任务执行日志
- 任务进度可通过 `GET /api/tasks/{id}/status` 查询
- 如果 Worker 无法连接 Redis，检查 Redis 是否运行：`redis-cli ping`

**前端调试**：
- Next.js 开发模式支持 HMR（热模块替换），修改代码即时生效
- 浏览器开发者工具 Network 面板查看 API 请求和响应
- 如果前端报 CORS 错误，检查 API 的 `allow_origins` 配置

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://easyconvert:easyconvert_dev@postgres:5432/easyconvert` |
| `REDIS_URL` | Redis 连接地址 | `redis://redis:6379/0` |
| `CELERY_BROKER_URL` | Celery Broker | `redis://redis:6379/0` |
| `CELERY_RESULT_BACKEND` | Celery Result Backend | `redis://redis:6379/1` |
| `JWT_SECRET` | **必填** JWT 签名密钥 | 无默认值，不设置则启动失败 |
| `JWT_ALGORITHM` | JWT 算法 | `HS256` |
| `JWT_EXPIRE_MINUTES` | Token 过期时间（分钟） | `1440`（24 小时） |
| `PADDLE_OCR_TOKEN` | PaddleOCR-VL 云服务认证 Token（OCR 功能必需） | 空（未设置时 OCR 转换会失败） |
| `DEBUG` | 调试模式 | `true` |

## API 接口

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录，返回 JWT |
| GET | `/api/auth/me` | 获取当前用户信息 |

### 文档

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/documents/upload` | 上传文件（multipart/form-data） |
| DELETE | `/api/documents/{id}` | 删除文档及关联任务记录（登录用户/游客均可） |
| GET | `/api/documents/history` | 转换历史（分页，需登录） |

### 任务

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/tasks/create` | 创建转换任务（单文档） |
| POST | `/api/tasks/create-merge` | 创建多图合并任务（2~20 张图片合并为 PDF） |
| GET | `/api/tasks/{id}/status` | 查询任务状态 |
| GET | `/api/tasks/{id}/download` | 下载转换结果 |

### 配额

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/quota/status` | 查询当前配额使用情况 |

### 支持的转换类型

| task_type | 输入 | 输出 |
|-----------|------|------|
| `pdf_to_word` | PDF | DOCX |
| `word_to_pdf` | DOCX | PDF |
| `excel_to_pdf` | XLSX | PDF |
| `ppt_to_pdf` | PPTX | PDF |
| `pdf_to_image` | PDF | PNG（多文件） |
| `images_to_pdf` | PNG/JPG/WebP | PDF |
| `ocr_to_word` | PNG/JPG/WebP | DOCX |

## 项目结构

```
easy-convert-ai/
├── web/                        # Next.js 前端
│   ├── src/
│   │   ├── app/               # 页面路由
│   │   │   ├── convert/       # 转换页面（支持 ?taskType 预选）
│   │   │   ├── merge-images/  # 多图合并转 PDF（独立操作界面）
│   │   │   ├── history/       # 历史记录（支持删除操作）
│   │   │   ├── login/         # 登录
│   │   │   └── register/      # 注册
│   │   └── lib/               # 工具库 (api client, auth context)
│   ├── public/fonts/          # 自定义字体（Luo-Regular.woff2）
│   ├── tailwind.config.ts     # Tailwind 配置（自定义字体族）
│   └── Dockerfile
├── api/                        # FastAPI 后端
│   ├── app/
│   │   ├── routers/           # 路由 (auth, documents, tasks, quota, history)
│   │   ├── models.py          # SQLAlchemy 模型 (User, Document, Task)
│   │   ├── config.py          # 配置（pydantic-settings）
│   │   ├── deps.py            # 依赖注入（get_current_user、get_optional_user）
│   │   └── auth.py            # JWT + 密码哈希
│   ├── alembic/               # 数据库迁移（001_create_tables）
│   └── Dockerfile
├── worker/                     # Celery Worker
│   ├── worker/
│   │   ├── converters/        # 7 个转换器实现
│   │   ├── tasks.py           # Celery 任务定义
│   │   ├── config.py          # 队列配置
│   │   └── celery_app.py      # Celery 应用实例
│   └── Dockerfile
├── docs/                       # 架构文档 & Issue 追踪
│   └── issues/                # 已知问题与改进方案
├── docker-compose.yml          # 5 容器编排
├── .env.example                # 环境变量模板
└── README.md
```

## 安全设计

- JWT 鉴权，token 通过 Authorization header 传递
- 文件下载路径白名单校验，防止路径穿越
- 游客 IP 限流（Redis），防止滥用
- 密码 bcrypt 哈希存储
- 文件上传格式 + 大小双重校验（20MB 上限）
- `JWT_SECRET` 无默认值，强制配置
- 文档删除鉴权：登录用户只能删除自己的文档，游客文档仅游客可删

## 已知限制

- 文件存储使用 Docker 共享卷，非持久化对象存储
- 暂无登录频率限制（计划集成 slowapi）
- OCR 依赖 PaddleOCR-VL 1.6 云 API，需配置 `PADDLE_OCR_TOKEN`，无本地 fallback
- 尚未实现微信 OAuth 登录
- 无生产级监控和日志聚合

## License

MIT