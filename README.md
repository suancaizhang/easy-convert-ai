# Easy Convert AI

AI 驱动的文档转换平台。

## 技术栈

- **前端**: Next.js 15 + TypeScript + TailwindCSS + shadcn/ui
- **后端**: FastAPI + Python 3.11
- **任务队列**: Celery + Redis
- **数据库**: PostgreSQL 16
- **容器化**: Docker Compose

## 本地开发

### 前置条件

- Docker & Docker Compose
- Node.js 20+ (前端本地开发)
- Python 3.11+ (后端本地开发)

### 一键启动

```bash
# 复制环境变量
cp .env.example .env

# 启动所有服务
docker compose up --build
```

启动后访问：
- 前端: http://localhost:3000
- 后端 API: http://localhost:8000
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

### 单独启动前端开发

```bash
cd web
npm install
npm run dev
```

### 单独启动后端开发

```bash
cd api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## 项目结构

```
easy-convert-ai/
├── web/                # Next.js 前端
├── api/                # FastAPI 后端
├── worker/             # Celery Worker
├── docker-compose.yml  # 容器编排
├── .env.example        # 环境变量模板
└── README.md
```
