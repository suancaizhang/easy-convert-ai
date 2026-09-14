# Easy Convert AI 部署与升级

本指南对应当前仓库实现：Next.js 前端、FastAPI API、数据库待派发任务 dispatcher、Celery Worker、PostgreSQL 和 Redis。文件位于本地共享卷；没有 R2 存储适配器，也没有 MiMo OCR fallback。

上线前阅读 [全项目审查及整改记录](docs/issues/04-project-audit-2026-09-12.md)。严重项修复不等于未关闭问题已被接受。

## Docker Compose 新部署

### 1. 配置

复制 `.env.example` 为 `.env`，在编辑器中配置：

- `JWT_SECRET`：独立随机密钥，不使用示例占位值，不打印到终端日志。
- `POSTGRES_PASSWORD`：随机数据库密码，同时更新 `DATABASE_URL`。URL 中特殊字符需要百分号编码；不要沿用开发密码。
- `DATABASE_URL`：Docker 网络内主机为 `postgres`，端口 5432。
- `REDIS_URL` / `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND`：Docker 网络内主机为 `redis`。
- `NEXT_PUBLIC_API_URL`：**用户浏览器**能访问的 API 地址，例如本机使用 `http://localhost:8000`，生产使用自己的 HTTPS API 域名；不能填写容器服务名 `api`。
- `PADDLE_OCR_TOKEN`：需要 OCR 时填写 PaddleOCR-VL 云服务凭据。匿名请求不能创建 OCR 任务。

`NEXT_PUBLIC_API_URL` 经 Compose build args 传入 Next 构建；修改后必须重新构建 web。容器运行时覆盖不会改变已生成浏览器代码。

Compose 固定 API/Worker 的 `RESULT_DIR=/tmp/results` 与共享卷一致。单独运行进程时，API、Worker 必须配置相同的绝对结果目录。

### 2. 启动

```sh
docker compose up -d --build
```

API 启动脚本先执行 `alembic upgrade head`。API 健康检查同时确认 PostgreSQL 与 Redis 可用，之后启动 dispatcher、Worker 和前端。

|服务|用途|宿主机入口|
|---|---|---|
|web|浏览器应用|127.0.0.1:3000|
|api|HTTP API、数据库迁移|127.0.0.1:8000|
|dispatcher|读取数据库未派发任务并投递|无|
|worker|转换执行，消费 default/office|无|
|postgres|数据与任务状态|不发布5432|
|redis|broker与进度|不发布6379|

Redis 开启 AOF。应用服务自动重启；这不是备份方案。

### 3. 共享数据

|卷|API/Worker内路径|内容|
|---|---|---|
|upload_data|/tmp/uploads|注册用户源文件|
|guest_data|/tmp/guest|游客源文件|
|result_data|/tmp/results|全部新转换产物|

不要把容器可写层中的 `/tmp/convert_*` 当作共享存储。浏览器收到的任务状态不包含磁盘路径。

### 4. 反向代理和外部访问

默认 web/API 只绑定宿主机回环地址，生产通过宿主机反向代理提供 HTTPS。Redis/PostgreSQL 仅在 Compose 网络内使用，不需要为浏览器开放。

同一主机 Nginx 的 API upstream 为 `http://127.0.0.1:8000`，web upstream 为 `http://127.0.0.1:3000`。若 Nginx 也运行在容器中，应接入同一网络并使用 `api:8000`、`web:3000`，不能使用容器自己的 localhost。

至少设置入口请求体上限（业务文件上限20MiB，multipart有额外开销）、请求超时和 TLS。当前应用的过期清理、部分资源预算等未关闭项见审查记录；不要用代理配置替代应用层整改。

## 从旧版本升级

此次任务 schema 与旧 Worker 不兼容，必须协调部署 API、dispatcher 和 Worker，不能滚动混跑新旧代码。

1. 停止接受新请求，等待活动任务结束；确认队列和任务状态。不要直接删除旧容器或卷。
2. 备份 PostgreSQL 及三个文件存储目录。旧版本成功结果在 Worker 容器 `/tmp/convert_*` 时，先从旧容器复制保全；删除容器会丢掉它们。
3. 停止旧 Worker、API；部署新代码，执行迁移。迁移将旧逗号分隔 `result_path` 转为 `result_paths` JSONB，依据全部来源的唯一非空 owner 回填任务归属；冲突 owner 或缺失来源的历史任务标记 `ERR_ACCESS`，普通读取/删除均被拒绝，需人工核对。迁移不会搬运磁盘文件，也不能从仅游客来源的旧记录恢复真实创建者。
4. 如需保留旧结果下载，把旧目录复制到共享结果存储，并在受控迁移中同步更新 `result_paths` 中的绝对路径。不能只搬文件不改路径，也不能假定数据库迁移能读取旧 Worker 容器。
5. 新字段无法从历史任务推断真实扣费事实：迁移不伪造 `quota_date`。旧任务不会被自动补扣/补退；历史账务如需调整，应基于实际记录单独处理。
6. 启动全部服务，验证新任务的创建、派发、完成、下载、取消及失败退款。重新构建 web，确认浏览器请求正确 API 地址。

### 回退

优先恢复协调备份并部署同一版本的一组服务。不要在有新任务时直接运行旧 Worker。

`result_paths` 可以超过旧 `varchar(512)` 容量；migration downgrade 不能无损地把任意新产物压回512字符。具体回退限制以迁移实现为准，先在备份副本执行。不要通过截断结果列表“回退”。

## WSL / 本地开发

Windows 上建议 API、dispatcher、Worker、PostgreSQL、Redis 运行在同一 WSL Linux 环境，避免跨系统文件路径不一致。前端可以在 Windows Node20 运行。

为每个 Python 服务安装各自 requirements；本地数据库/Redis URL 使用 localhost，而非 Docker 名称。API 的 Pydantic 配置读取当前工作目录 `.env`，Worker 使用环境变量并在本地加载项目根目录 `.env`；因此必须保证相关进程环境一致。

在 API 目录执行迁移与 API（环境变量提前设置，避免命令历史包含凭据）：

```sh
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8111
```

另一个终端，在 API 目录启动持久化派发器：

```sh
.venv/bin/python -m app.dispatcher
```

在 Worker 目录启动转换服务：

```sh
.venv/bin/celery -A worker.celery_app worker --loglevel=info --concurrency=2 -Q default,office
```

两个队列已在 Worker 配置声明；显式 `-Q` 是便于运维核对，不是修复默认漏消费的必要条件。

Windows PowerShell 前端：

```powershell
Set-Location web
npm ci --ignore-scripts
$env:NEXT_PUBLIC_API_URL = 'http://localhost:8111'
npm run dev
```

未运行 dispatcher 时，API 接受的任务会留在 waiting，**不要把重发创建请求当作恢复措施**。启动 dispatcher 后恢复派发。

## 故障恢复语义

- **broker暂时不可用**：任务与扣额已在同一数据库事务提交，未投递标志保持；dispatcher 重试，不丢任务。
- **发送成功但标记前崩溃**：可能重复发送同一个任务 ID；Worker 执行互斥，终态任务直接返回。
- **转换暂时失败**：Celery retry，不提前标终态或退款。Retry发布失败则恢复数据库待派发意图。
- **数据库故障/失锁**：重排原消息，恢复后重新获取执行锁；不在失锁后重连结算。成功提交响应丢失时保留可能已被引用的产物；不能直接清空这些目录，需先核对数据库引用。
- **最终失败/排队取消**：以任务实际扣费记录一次性退款；不冲减另一计费日期。
- **Worker进程丢失**：PostgreSQL执行锁随连接释放，Celery未确认消息按broker重投递规则恢复；恢复不是立即发生的时延保证。
- **进度Redis不可用**：短超时降级，不让进度依赖无限阻塞转换。

dispatcher/Worker 日志用于诊断，避免把数据库连接串、JWT 或 OCR 凭据复制进公开日志。

## 验证与运维

```sh
docker compose ps
docker compose logs --tail=100 api dispatcher worker
```

`GET /health` JSON 的 `status` 必须为 `healthy`；只判断 HTTP 200 不够，因为降级状态也可能返回200。

新建一次不收费的小文件转换，确认：

1. 上传成功、任务进入 waiting。
2. dispatcher 实际派发，Worker进入processing并成功。
3. API容器从共享结果卷下载到可打开文件。
4. 私有任务匿名和其他用户请求被拒绝。
5. 匿名OCR在创建前被拒绝。
6. 排队取消后没有执行，失败/取消不重复退款。

前端验证：`npm run test`、`npm run build`、`npm audit --omit=dev --registry=https://registry.npmjs.org`。后端独立数据库测试及实际本轮结果见审查报告。不要对真实用户数据库运行集成测试。

## 当前仍需关注

- 游客非OCR不限次数是ADR0003的产品策略，不是临时测试开关。
- 文件保留期限、完整可访问性/国际化、预览资源生命周期和真实云OCR完整链路仍须按审查记录逐项关闭。
- Redis无公网端口不等于完全可信；生产仍应按网络边界和组织要求配置访问控制。
- Python依赖漏洞审计与完整Docker部署是否已经实测，以审查报告的验证表为准。

## 微信小程序端（2026 大赛参赛版）

`miniprogram/` 是独立安装根（Taro 3 + React），构建产物 `miniprogram/dist/` 由微信开发者工具导入。小程序只做客户端，全部业务逻辑与配额仍由 API/Worker 执行，部署依赖与上文的 Compose 栈一致。

### 1. 配置与构建

- API 新增 `WECHAT_APPID`、`WECHAT_SECRET`（小程序 AppID 与 AppSecret），未配置时微信登录返回 503。
- 小程序后端地址通过构建期环境变量注入：`TARO_APP_API_BASE=https://你的api域名`，`npm run build:weapp`。运行时改 env 无效，与 web 的 `NEXT_PUBLIC_API_URL` 同理。
- `miniprogram/project.config.json` 已配置本项目参赛 AppID；其他主体复用仓库时必须替换为自己的 AppID。联调期可在开发者工具勾选「不校验合法域名」。
- 合并镜像以仓库根为构建 context（`deploy/cloudbase/Dockerfile`），根 `.dockerignore` 负责排除 `.venv`、`node_modules` 与 `.env` 等本地产物；`entrypoint.sh` 必须保持 LF 换行（仓库根 `.gitattributes` 已锁定），否则容器启动会报 `no such file or directory`。
- 本地复现云托管拓扑：`docker compose -f deploy/cloudbase/docker-compose.cloudbase-ref.yml up --build`，api 在 `127.0.0.1:8112`。

### 2. 上线域名（选定：微信云托管，免 ICP 备案）

完整操作步骤见 **[deploy/cloudbase/README.md](deploy/cloudbase/README.md)**：4 个云托管服务（api 公网 + processor/postgres/redis 私网）、CFS 挂载共享 `/tmp`（满足 `RESULT_DIR` 同一物理存储）、合并镜像构建、合法域名配置。要点：

- 默认域名 `*.tcloudbase.com` 可直接配置为 request/uploadFile/downloadFile 合法域名，无需备案；官方标注默认域名偏开发测试，竞赛演示可接受，生产后续可绑定备案自定义域名。
- 云托管第一课：api 首次启动自动 `alembic upgrade head`；先部署 postgres/redis/processor，最后部署 api 并开公网。
- 不在小程序端做任何业务逻辑；配额与 OCR 登录约束仍由 API 强制。

### 3. 提审与上线（大赛硬性要求）

- 小程序须在 **2026-07-17 ~ 2026-10-17** 之间通过微信公众平台审核并正式上线，提报截止 **10-17**；预留审核与类目资质（隐私保护指引、AI 能力说明、收集用户信息声明）时间，不要卡点提交。
- 提交材料：真实 AppID、小程序码、演示视频/截图、作品说明（AI 能力：PaddleOCR-VL 文字识别 + 12 类文档转换）。已上线超过比赛窗口的 Web 版不参评，仅作为后端设施复用（ADR0005）。
