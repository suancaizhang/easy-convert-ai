# Easy Convert AI

AI 驱动的在线文档转换平台，支持 PDF、Word、Excel、PPT、图片之间的格式互转，集成 OCR 文字识别。

## 功能特性

- **PDF ↔ Word**: PDF 提取文本转 Word，Word 转 PDF
- **Office → PDF**: Excel、PPT 一键转 PDF（LibreOffice 引擎）
- **PDF → 图片**: PDF 逐页渲染为 PNG（150 DPI）
- **图片 → PDF**: 多张图片合并为 PDF
- **OCR 识别**: PaddleOCR + DeepSeek AI 双引擎，支持中文识别
- **用户体系**: 注册登录、JWT 鉴权、游客免注册试用
- **配额管理**: 注册用户 8 次/天，游客 3 次/天（IP 限流），自动重置
- **异步处理**: Celery 双队列架构，Office 转换隔离，支持重试
- **转换历史**: 分页查看历史记录，过期文件标记

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 15 + React 19 + TypeScript + Tailwind CSS |
| 后端 API | FastAPI + SQLAlchemy 2.0 + Alembic |
| 任务队列 | Celery 5.4 + Redis（双队列: default / office） |
| 数据库 | PostgreSQL 16 |
| 转换引擎 | PyMuPDF、python-docx、LibreOffice Headless |
| OCR | PaddleOCR + DeepSeek API（fallback） |
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

**数据流**:
1. 用户上传文件 → API 存储到共享卷 → 返回 document_id
2. 用户创建转换任务 → API 扣配额 → Celery 派发到对应队列
3. Worker 执行转换 → 结果写入共享卷 → 更新任务状态
4. 前端轮询任务状态 → 完成后下载结果文件

## 快速开始

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

### 本地开发（前端）

```bash
cd web
npm install
npm run dev
```

### 本地开发（后端）

```bash
cd api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 需要本地 PostgreSQL 和 Redis，或者用 docker compose 只启动基础设施
docker compose up -d postgres redis

# 运行数据库迁移
alembic upgrade head

# 启动 API
uvicorn app.main:app --reload
```

### 本地开发（Worker）

```bash
cd worker
pip install -r requirements.txt

# Worker 需要 LibreOffice（office 转换）
# Ubuntu: apt install libreoffice-core
celery -A worker.celery_app worker --loglevel=info -Q default,office
```

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
| `DEEPSEEK_API_KEY` | DeepSeek OCR API Key（可选） | 空 |
| `API_DEBUG` | 调试模式 | `true` |

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
| GET | `/api/documents/history` | 转换历史（需登录） |

### 任务

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/tasks/create` | 创建转换任务 |
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
│   │   │   ├── convert/       # 转换页面
│   │   │   ├── history/       # 历史记录
│   │   │   ├── login/         # 登录
│   │   │   └── register/      # 注册
│   │   └── lib/               # 工具库 (api client, auth context)
│   └── Dockerfile
├── api/                        # FastAPI 后端
│   ├── app/
│   │   ├── routers/           # 路由 (auth, documents, tasks, quota, history)
│   │   ├── models.py          # SQLAlchemy 模型
│   │   ├── config.py          # 配置
│   │   ├── deps.py            # 依赖注入
│   │   └── auth.py            # JWT + 密码哈希
│   ├── alembic/               # 数据库迁移
│   └── Dockerfile
├── worker/                     # Celery Worker
│   ├── worker/
│   │   ├── converters/        # 7 个转换器实现
│   │   ├── tasks.py           # Celery 任务定义
│   │   ├── config.py          # 队列配置
│   │   └── celery_app.py      # Celery 应用实例
│   └── Dockerfile
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

## 已知限制

- 文件存储使用 Docker 共享卷，非持久化对象存储
- 暂无登录频率限制（计划集成 slowapi）
- OCR 依赖外部 DeepSeek API，无 key 时降级为纯 PaddleOCR
- 尚未实现微信 OAuth 登录
- 无生产级监控和日志聚合

## License

MIT
