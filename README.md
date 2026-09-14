# Easy Convert AI

AI 驱动的在线文档转换平台，支持 PDF、Office 文件与图片转换，以及 PaddleOCR-VL 1.6 云 OCR。

## 文档入口与当前状态

- [全项目审查、整改状态与验证证据](docs/issues/04-project-audit-2026-09-12.md)：严重问题修复、回归结果和未关闭风险。
- [部署、迁移与故障恢复](DEPLOYMENT.md)：Docker/WSL 配置、六服务启动、004 迁移及回退要求。
- [任务归属、持久化投递与产物列表](docs/adr/0004-task-ownership-delivery-and-artifacts.md)：权限、计费、派发和恢复契约。
- [多文件主文档决策](docs/adr/0001-multi-file-task-document-id-anchor.md)、[OCR 输出格式决策](docs/adr/0002-ocr-single-task-type-with-output-format-param.md)、[游客使用策略](docs/adr/0003-guest-unrestricted-except-ocr.md)。

2026-09-12 整改验证：API/Worker生命周期与迁移20项、转换完整性10项、前端15项测试通过；Node20.19生产构建通过；npm生产依赖审计未报告漏洞。真实分进程转换与桌面/移动浏览器预览已验证。**完整Docker部署、收费云OCR和Python依赖漏洞审计尚未完成，不代表已获上线批准。** 详细环境与证据边界以审查记录为准。

## 功能与限制

- PDF→Word 提取文字及内嵌图片；不承诺完整保留原版式。
- Word、Excel、PPT→PDF 使用 LibreOffice；PDF→PNG 按页输出（150 DPI）。
- 多图合并页面支持2～20张图片；PDF工具包括合并、拆分、压缩、旋转和水印。
- OCR 使用 PaddleOCR-VL 1.6，输入可为图片或PDF，输出 DOCX、TXT 或可搜索PDF。没有 MiMo、DeepSeek 或本地 fallback。
- 注册用户使用 JWT；免费用户计费转换8次/UTC日，PDF工具免扣配额。注册用户同时只允许一个 waiting/processing 任务。
- 游客非OCR不限次数；OCR必须登录。私有来源与任务均校验权限，提供无效认证不能降级为游客绕过检查。
- 历史页支持分页和删除，但部分工具类型识别、OCR格式预览及分页边界仍待修复。
- 删除成功返回204；活动任务引用的文档返回409。删除主文档会删除其任务记录并尝试清理源文件及产物；物理清理失败不会回滚数据库，也没有自动过期清理。

## 技术栈与架构

|层|技术|
|---|---|
|前端|Next.js15、React19、TypeScript、Tailwind CSS|
|API|FastAPI、同步SQLAlchemy2.0 Session、Alembic|
|执行|Celery5.4，default/office双队列；Office转换路由至office|
|存储|PostgreSQL16、Redis、本地共享文件目录|
|转换|PyMuPDF、python-docx、Pillow、LibreOffice Headless|
|部署|Docker Compose：web、api、dispatcher、worker、postgres、redis|

```text
浏览器 → FastAPI → PostgreSQL（同事务扣额并创建waiting任务）
                      ↓ dispatcher读取未派发意图
                    Redis → Celery Worker
                                ├─ 写入共享RESULT_DIR
                                └─ 更新PostgreSQL状态与result_paths
浏览器 → FastAPI → 查询状态 / 从共享目录下载结果
```

- `Task.user_id` 显式记录新任务创建者，不借主文档推断计费主体。
- dispatcher 使用任务UUID投递，发送成功后记录 `dispatched_at`；重复投递由Worker锁与终态保护处理。
- 状态为 `waiting → processing → success/failed`。仅waiting可取消，取消结果为 `failed` / `ERR_CANCELLED`；暂时失败可重试。
- 最终失败/取消按实际扣费记录一次性退款，不冲减其他UTC账期。DB故障重排；不确定的成功提交保留可能已发布的产物。
- `result_paths` 是有序JSONB数组；普通下载取首个产物，分页接口读取其他产物，没有打包下载契约。
- API/Worker共享 `RESULT_DIR`，默认 `/tmp/results`。数据库迁移不负责搬运旧容器中的文件。

## Docker 快速启动

需要 Docker 与 Docker Compose v2。

```sh
cp .env.example .env
# 在编辑器中配置JWT_SECRET、POSTGRES_PASSWORD、匹配的DATABASE_URL，
# 以及用户浏览器能访问的NEXT_PUBLIC_API_URL；不要沿用示例凭据。
docker compose up --build
```

|入口|本机地址|
|---|---|
|前端|http://localhost:3000|
|API|http://localhost:8000|
|Swagger|http://localhost:8000/docs|
|健康检查|http://localhost:8000/health|

默认web/API仅绑定宿主机回环地址，PostgreSQL/Redis不发布宿主机端口。生产通过反向代理提供HTTPS。`/health` 需要检查JSON中的 `status=healthy`，只看到HTTP200不代表数据库与Redis正常。

`NEXT_PUBLIC_API_URL` 在构建时写入前端，修改后必须重建web。旧版本升级必须先备份数据库及源文件、保全旧Worker的 `/tmp/convert_*`，再协调部署004迁移与新API/dispatcher/Worker，不能新旧混跑。具体操作见[部署指南](DEPLOYMENT.md)。

## 本地开发

建议API、dispatcher、Worker、PostgreSQL和Redis运行在同一WSL Linux环境；前端可在Windows运行。后端需要Python3.11+，前端本轮验证版本为Node20.19.0。

先安装并启动PostgreSQL/Redis，配置匹配的本地地址与凭据。**根目录 `.env` 不会被所有进程以相同方式自动加载**：API读取当前工作目录 `.env`；Worker本地加载项目根目录 `.env`。应在各终端配置一致的环境变量，或为API工作目录提供配置；不要在命令中粘贴真实密钥。

分别在对应目录执行以下命令，不将各代码块串成同一个进程：

### API（`api/`）

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8111
```

### dispatcher（另一个终端，`api/`）

```sh
.venv/bin/python -m app.dispatcher
```

缺少dispatcher时任务保持waiting；不要通过重复创建请求恢复。

### Worker（`worker/`）

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/celery -A worker.celery_app worker --loglevel=info --concurrency=2 -Q default,office
```

Office转换还需要系统LibreOffice。两个队列已在Worker配置声明，显式 `-Q` 便于核对消费范围。

### 前端（Windows PowerShell，`web/`）

```powershell
npm ci --ignore-scripts
$env:NEXT_PUBLIC_API_URL = 'http://localhost:8111'
npm run dev
```

修改API端口时更新前端环境变量，不修改代码默认值。开发模式重启服务，生产模式重新构建。

## 关键配置

完整模板见 `.env.example`；WSL用localhost，Docker用内部服务名。不要把数据库连接串或Token复制进公开日志。

|变量|用途|
|---|---|
|`DATABASE_URL`|API、dispatcher、Worker连接同一PostgreSQL；密码特殊字符需URL编码|
|`POSTGRES_PASSWORD`|Compose数据库密码，须与连接串匹配|
|`REDIS_URL`|API健康检查及进度读取|
|`CELERY_BROKER_URL`|dispatcher/Worker消息broker；Worker进度也使用此地址，应与API指向同一Redis库|
|`CELERY_RESULT_BACKEND`|Celery结果后端|
|`JWT_SECRET`|API/dispatcher配置必填的签名密钥|
|`PADDLE_OCR_TOKEN`|Worker云OCR凭据|
|`RESULT_DIR`|API/Worker共同可访问的绝对结果目录；默认 `/tmp/results`|
|`NEXT_PUBLIC_API_URL`|浏览器可访问的API地址；代码默认localhost:8111，Compose示例localhost:8000|

## API 概览

准确请求模型见运行中API的 `/docs`。认证通过 `Authorization: Bearer …`，不把Token放进下载URL。

|方法|路径|契约|
|---|---|---|
|POST|`/api/auth/register`、`/api/auth/login`|注册/登录，返回JWT|
|GET|`/api/auth/me`|当前用户|
|POST|`/api/documents/upload`|multipart文件上传；当前按声明MIME和20MiB限制检查，非完整内容验证|
|DELETE|`/api/documents/{id}`|按文档及关联任务权限删除；成功204、活动引用409；隔离历史任务拒绝普通删除|
|GET|`/api/documents/history`|登录用户分页历史|
|POST|`/api/tasks/create`|单来源，或通过有序 `source_document_ids` 创建多来源任务；首项为主文档|
|POST|`/api/tasks/create-merge`|2～20个不同图片文档，固定images_to_pdf|
|GET|`/api/tasks/{id}/status`|任务状态与可用进度，不返回物理路径|
|POST|`/api/tasks/{id}/cancel`|仅取消waiting任务；已处理或结束返回409|
|GET|`/api/tasks/{id}/download`|下载首个产物；`preview=true` 使用inline响应|
|GET|`/api/tasks/{id}/pages`|返回 `total` 与 `ext`|
|GET|`/api/tasks/{id}/download/{page_index}`|零基索引下载单个产物|
|GET|`/api/quota/status`|当前UTC账期配额，需登录|

所有来源都校验权限。游客文档不是“仅游客可删”：无归属文档遵循现有UUID能力策略，但关联的私有任务仍要求匹配用户，`ERR_ACCESS` 历史任务需人工核对。

### 转换类型与参数

|task_type|输入 → 输出|params|
|---|---|---|
|`pdf_to_word`|PDF → DOCX|无|
|`word_to_pdf`|DOCX → PDF|无|
|`excel_to_pdf`|XLSX → PDF|无|
|`ppt_to_pdf`|PPTX → PDF|无|
|`pdf_to_image`|PDF → 多张PNG|无|
|`images_to_pdf`|图片 → PDF|无；通用create允许1～20个来源，多图页面与create-merge要求至少2个|
|`ocr_to_word`|图片/PDF → DOCX、TXT、可搜索PDF|`output_format`: `docx`（默认）、`txt`、`searchable_pdf`|
|`pdf_merge`|2～20个PDF/图片 → PDF|无|
|`pdf_split`|PDF → PDF|必填 `pages`，例如 `1-3,5`|
|`pdf_compress`|PDF → PDF|`quality`: `low`、`medium`（默认）、`high`|
|`pdf_rotate`|PDF → PDF|`angle`: 90/180/270；`pages` 默认 `all`|
|`pdf_watermark`|PDF → PDF|必填 `text`；`opacity` 0.05～1；`position` 为center或四角|

图片类型为PNG、JPEG、WebP。`ocr_mode` 不选择其他引擎；现有Worker只使用PaddleOCR-VL。未声明参数会被拒绝；完整长度、枚举与格式约束见Swagger。

## 代码与验证入口

- `web/src/app/`：转换、历史、认证及 `/tools/*` 页面；`/merge-images` 重定向至图片工具。
- `web/src/lib/`、`web/src/components/preview/`：请求、身份、i18n、任务状态和预览。
- `api/app/task_service.py`、`dispatcher.py`、`routers/`：任务准入、持久化派发及HTTP边界。
- `api/alembic/versions/`：001～004迁移；共享模型在API和Worker两侧维护。
- `worker/worker/tasks.py`、`converters/`、`services/paddle_vl.py`：任务生命周期、12种转换和云OCR。

前端在 `web/` 执行 `npm run test`、`npm run build`；生产依赖检查使用 `npm audit --omit=dev --registry=https://registry.npmjs.org`。

**后端集成测试会清空应用表并执行迁移回退，只能使用隔离测试库。** 安装与运行方式见[审查记录的回归说明](docs/issues/04-project-audit-2026-09-12.md#回归运行方式)，不要指向真实用户数据库。

未关闭事项包括文件过期/孤儿清理、上传资源预算、认证限流、OCR外部作业幂等、部分前端生命周期与可访问性。当前没有R2存储适配器、微信OAuth或生产级监控；以审查记录为准，不依据历史方案推断已实现功能。

## License

MIT
