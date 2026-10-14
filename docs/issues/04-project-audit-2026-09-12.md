# 全项目代码审查与严重问题整改记录

## 2026-10-14 提交前 P1 补充修复

- 未核对的 OCR 提交证据（`ERR_OCR_UNCERTAIN` 或不一致/未知恢复状态）现在阻止删除锚点文档；人工核对完成并写入已解决状态后，普通删除继续可用。
- 供应商明确拒绝提交（HTTP 400、401、403、413、415、422）不再被归类为未知收费作业：Worker 终止任务并退还应用配额；超时、断连、服务器错误及其他不明确响应仍按未知提交保留配额并要求人工核对。

### 本次执行证据

|范围|结果|证据边界|
|---|---|---|
|API / migration / Worker 生命周期|51/51 通过|一次性 PostgreSQL 16；含未解决 OCR 删除阻断、已解决后删除、任务归属拒绝、明确拒绝退款、未知提交不退款、锁与迁移回归|
|Worker 转换与 OCR 边界|24/24 通过|Worker 完整 unittest；明确拒绝使用本地 fixture，不调用收费 OCR|

本次没有运行真实微信、收费供应商、Docker 或 CloudBase 验收。其它尚未关闭的转换器表单/透明图片/像素预算问题及 Web 下载绝对超时，仍按相应审查记录处理。

## 2026-10-03 全量复审后的整改与验收

本节对应2026-10-02全项目审查后用户授权的修复；下方旧日期记录保留作为历史证据，不应把旧缺陷或旧测试数量当成当前结果。6个实现子agent分工，API↔OCR、Web流程↔页面互审，主审独立核查转换器、小程序、迁移，并执行真实集成与浏览器验收。未创建commit或push，保留用户既有CONTEXT.md改动。

### 本轮修复

- **API/资源边界**：004兼容SQL NULL和JSON null，并隔离非数组来源；multipart解析前累计21MiB请求体上限，单文件20MiB分块读，超长文件名在落盘前拒绝。已知写入失败清理文件，不确定commit保留可能已发布文件。密码上限为72 UTF-8字节，旧bcrypt和HS256 token保持兼容；python-jose替换为PyJWT。
- **转换器**：PDF栅格预算单页2500万、累计2亿像素，PNG输出最多50页/256MiB；PNG/JPEG/WebP共用受限图片解码；Office每次独立LibreOffice profile；PDF→Word保留矢量内容为栅格图，不保证原版式或可编辑矢量；水印布局收敛到页面内并适配旋转。
- **收费OCR**：005记录提交意图和供应商jobId。已知job恢复轮询/下载/构建而不再submit；提交未知时failed/ERR_OCR_UNCERTAIN，保留应用配额待人工核对，禁止自动重提/取消退款。三种格式均核对源页数/结果总数/顺序；DOCX缺图或图片处理失败不再静默成功。无显式page_index时只能依赖供应商顺序契约，不能证明其内容没有换页。
- **Web**：历史12类型预览下载，依/pages.ext分流TXT/PDF/DOCX/图片；下载及加载错误可见；fetch含body 30秒、XHR 120秒超时；仅明确401清凭据；8页取消/真实进度接通；轮询、迟到响应及Blob资源清理。5个PDF工具7语补齐，422字段错误可读，匿名OCR在上传前去登录，持久语言SSR hydration一致。
- **小程序**：upload/request/download统一401清理；history按total/page加载更多；图片按选中页懒下载；上传前校验参数边界，数值为JSON number。仅支持weapp，移除未验证H5入口。
- **交叉review新增修复**：005回退遗漏job-id-only记录、API取消对不一致OCR恢复事实保护、图片选择超20张的Blob泄漏、PDF.js跨域CDN worker wrapper泄漏。PDF worker改为同源构建产物，两次预览关闭后活Blob均为0。

### 实际执行证据

|范围|结果|证据边界|
|---|---|---|
|API/迁移/生命周期|47/47通过|新安装依赖，真实隔离PostgreSQL16；含004 JSON null、005恢复记录/回退保护、锁丢失、退款、上传及认证|
|Worker|23/23通过|当前完整unittest套件；另有11类非OCR真实转换smoke，Office实际并发输出内容核对|
|Web|38/38通过，生产构建16/16页面成功|Node20.20.2/Next15.5.25；PDF同源worker修复后再次生产构建与浏览器复验|
|小程序|8/8通过、tsc通过、weapp构建成功|隔离干净npm ci安装；实际TS/TSX控制流配Taro/React环境桩，另有真实本地HTTP客户端smoke；不等同微信真机|
|真实应用链路|通过|HTTP注册/鉴权→上传→PostgreSQL→dispatcher→Redis→Celery→WebP/PDF旋转结果下载；巨大PDF安全失败、waiting取消、越权拒绝、长密码/文件名拒绝和删除|
|OCR恢复smoke|通过|真实本地供应商HTTP fixture+PG+Worker；poll/image重试POST始终1次，断连接未知提交不退配额；三格式实际读取产物；未调用收费云OCR|
|真实浏览器|通过所列场景|注册422可读、匿名OCR零上传跳转、PDF/DOCX/双页图片预览、历史操作、waiting取消200回idle、移动端历史、持久英文工具页与hydration；PDF同源worker200，反复关闭无Blob残留|
|浏览器故障/状态注入|通过|受控TXT输出、503保token恢复、下载404提示、processing 42%条与2/5细节；不冒称供应商或长任务实测|

主审集成测试使用一次性数据库及隔离源/产物目录，未触碰业务数据库或外部付费服务。验收后已关闭浏览器、Web/API/dispatcher/Worker/Redis及隔离PostgreSQL，清理主审临时服务数据、夹具和脚本；保留隔离依赖安装及依赖审计证据供复核。HTTP实际下载字节及产物内容已核对；浏览器下载事件捕获工具超时，未将自动化保存落盘列为已证明。测试保留Pydantic/Starlette弃用及passlib的bcrypt版本探测警告，未通过抑制日志绕过问题。

### 依赖与剩余限制

- API/Worker联合requirements的pip-audit：整改前按公告alias去重36项，升级FastAPI0.142.2、Starlette1.7.0、multipart0.0.32、PyJWT2.15.1、Pillow12.3.0、dotenv1.2.4后无已知漏洞，pip check通过。Web生产npm audit为0。
- 小程序生产npm audit从13项降至4项critical，均为Swiper根告警及传播；esbuild0.25.12、lodash-es4.18.1已锁定修复。全依赖树另有55项，口径不同。Swiper6.8.0的GHSA-hmx5-qpq5-p643需升级到不兼容旧Taro H5接口的12.1.2+；没有强行覆写破坏H5依赖。实际weapp模块图104模块无Swiper/esbuild/lodash-es，不宣称依赖树清零，也不提供H5支持。
- 仓库miniprogram/node_modules安装曾遇WSL EACCES；可靠构建来自隔离干净安装，不能据此声称原地node_modules已修好。
- 真实微信登录/原生API/开发者工具视觉验收、真实PaddleOCR-VL质量与计费、Docker及CloudBase/CFS部署仍未验证。微信IDE端口不可用，未擅改安全配置。
- 历史规划中的文件过期/孤儿清理、认证限流、Web历史删除后的分页边界及完整可访问性仍不在本轮已验证范围；旧游客每日3次宣传与ADR0003不一致的文案未扩大修改。
- **上线前必须协调迁移005与API/Worker**：先停旧Worker/processor，备份并迁移，再启动同版本服务；旧活动OCR会被隔离，需人工核对；任一OCR状态或jobId存在即禁止丢证据downgrade。见DEPLOYMENT.md和ADR0004。

---

- 审查日期：2026-09-12
- 范围：当前工作区（包含审查前已有未提交修改），前端 38 个 TS/TSX 文件、后端/Worker/迁移/seed 共 42 个 Python 文件，以及 Docker、依赖与主要架构/部署文档。
- 方法：测试优先、API/Worker/前端并行只读审查，主审集成配置核查和隔离复现；覆盖正确性、可读性、架构、安全、性能。
- 原始结论：**Request changes**。权限、付费边界、状态/账务、内容完整性和部署链路阻断上线。
- 本文保留原始问题证据。下文整改状态是当前状态；附录的原始文件行号/未验证说明对应审查时版本，不代表修复后仍存在。

## 整改范围与状态

用户授权记录全量审查并修复严重问题；本轮不包含整体 UI 重写、游客非 OCR 限流或认证存储迁移。所有修改保留在工作区，不自动提交或推送。

|编号|严重问题|整改状态|
|---|---|---|
|C1|匿名跳过注册用户任务授权|已修复；验证见文末|
|C2|匿名调用付费 OCR|已修复；验证见文末|
|C3|Next/Sharp 等生产依赖安全公告|已修复；验证见文末|
|C4|Node20 PDF.js 预渲染导致构建失败|已修复；验证见文末|
|C5|Compose API构建地址与结果共享存储错误|代码/配置已修复；Docker待实测|
|C6|PDF压缩静默损坏图像|已修复；验证见文末|
|C7|Retry被吞、错误取消ID、终态重复执行及错误退款|已修复；验证见文末|
|C8|多页图片逗号路径溢出varchar512|已修复；验证见文末|
|R1|PDF→Word静默丢图|已修复；验证见文末|
|R2|中文搜索PDF丢字、OCR坏页静默跳过|已修复；验证见文末|
|R3|进度Redis无界等待阻塞转换|已修复；验证见文末|
|R4|HTTP204/非JSON上传响应处理失败|已修复；验证见文末|

其余问题见下方完整附录；未在完成验证表中明确关闭的项仍为待修复或待验证，不能把“严重项修复”解释为全项目已达到上线标准。

## 主审原始验证证据

|场景|整改前观察|证据边界|
|---|---|---|
|前端 `npm run test`|3/3通过，仅i18n|不覆盖任务工作流|
|Node20.19 `npm run build`|编译/类型阶段通过，watermark预渲染 Promise.withResolvers 失败|真实生产构建|
|npm生产audit（官方registry）|4个受影响包，1 critical/3 high|镜像源404后改官方源；非漏洞利用证明|
|Python AST|42个文件通过|非运行时验证|
|匿名访问他人task/pages|HTTP200|真实FastAPI HTTP路由+隔离会话，无真实私人文件|
|匿名OCR创建|waiting，分发调用1|假broker，不调用收费OCR|
|压缩纯红图PDF|中心RGB从(255,0,0)变(0,0,0)|真实PyMuPDF小文件|
|图文PDF→Word|DOCX word/media为空|真实转换|
|搜索PDF中文|“中文测试”提取为四个中点，搜索0命中|直接构建产物，不收费调用|
|9页PDF→PNG|result_path逗号串566字符，schema上限512|转换实测；PG错误恢复链为静态分析|
|Retry|已请求重试却failed并退款，控制异常未传播|真实Celery Retry+隔离会话|
|已取消任务重投|仍调用转换器，最终success|隔离会话|
|Redis不回应|TCP已连接，report_progress超过2秒仍未返回|本地假server+受控子进程|
|DELETE204|SyntaxError Unexpected end of JSON input|真实api.ts转译，替换transport|
|上传HTML413|事件抛SyntaxError，Promise仍pending|真实api.ts+假XHR|
|OCR JSONL中间坏行|3行返回2页，原第3页编号变2|假HTTP结果+真实解析|
|队列配置|consume_from为default和office|实际加载Celery配置，旧文档缺-Q即不消费的说法不成立|

原审查未运行完整Docker、真实PG并发恢复、真实收费OCR和完整浏览器交互，未完成Python依赖漏洞审计。

## 部署与依赖补充发现

1. **Critical / C3**：Next 15.5.20受[Windows RCE公告](https://github.com/advisories/GHSA-p293-qw3h-jr36)影响（条件为Windows托管），以及[AVIF图片优化公告](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)（取决于输入可达性）。不把版本命中当作已成功利用；按修复release升级并核对锁文件。
2. **Critical / C5**：`docker-compose.yml`只设置运行时NEXT_PUBLIC_API_URL，未提供构建参数；构建使用localhost:8111但Compose API是8000。Worker `tempfile.mkdtemp(prefix="convert_")`产物目录未共享，API下载404。
3. **Required**：生产部署指南示例build context为根目录但Dockerfile从当前context取requirements.txt；端口8111映射与8000监听不符；卷/app/uploads与真实/tmp目录不符。快速示例引号heredoc中的shell表达式不求值。文档的R2/MiMo/CORS/健康状态等也与真实实现不一致。
4. **Required**：Compose发布Redis/Postgres到宿主机全部接口；Redis无配置认证。公网可达性受防火墙影响，本次未扫描真实公网。优先不发布内部端口。
5. **Required**：无.dockerignore会把本地node_modules/.venv/.env等带进构建上下文，污染Linux依赖或镜像秘密；使用可重复安装和按服务构建排除。

## 五维整体判断

- 正确性：主要缺口是授权、任务状态、配额和实际产物契约，而不是语法。
- 可读性：单文件规模可控（前端最大370行），但存在不可达游客限额分支、重复Office调用和各页面重复任务类型清单。
- 架构：保留三服务及CONVERTER_MAP；需要明确任务创建者/扣费事实、任务状态机和产物列表，不靠分散字符串分支维持不变量。
- 安全：已见可复现权限和付费边界问题；SQL参数化和JWT强制配置是可保留基础。第三方响应、单次资源预算和依赖需要持续治理。
- 性能：history已有分页及批量查询；风险集中在无界文件读取/像素分配、进度同步等待、重复预览挂载及Blob资源泄漏。

## 完整分模块原始审查记录


### API

**verdict**：REQUEST CHANGES

**scope**：只读检查 api/app 全部 6 个路由文件、auth/deps/config/database/redis_client/main/models、api/alembic/env.py 和 001–003 迁移、api/seed.py、ADR0001–0003；特别读取了当前 tasks.py 全文和未提交 diff。先定位测试并阅读现有 i18n 测试；项目自身未发现 API 测试（.venv 内第三方测试不计）。未编辑文件，未运行 build/lint/tests/formatter 或行为验证。

**architecture_summary**：- API 实际使用同步 SQLAlchemy Session/PostgreSQL，而非 CLAUDE 描述的 async SQLAlchemy。上传处理函数为 async，但文件落盘及 DB 操作仍同步。
- 认证为 bcrypt + JWT；受保护接口使用 get_current_user，可选认证使用 get_optional_user。Document.user_id 承担权限归属；游客没有独立 session/owner capability。Task 没有创建者/扣费主体，只通过主 Document 推导。
- 创建任务先消费配额（独立 commit），再创建 Task（独立 commit），最后向 Celery 分发；普通/Office 两个队列。PDF 工具免扣额度。多文件任务首文档为 anchor，source_document_ids 为输入列表，符合 ADR0001，但权限/扣费主体仍存在断裂。
- 任务状态/下载/分页预览由 Task + Document 实现；未提交代码添加 Redis 进度读取和 waiting 取消/退款。
- 数据库迁移 001–003 与 API 当前主要字段一致。history 有 page_size≤100 及批量 latest-task 查询，未见逐文档 N+1；过期字段只有写入没有执行策略。


#### findings

##### API-C1

**severity**：Critical

**dimension**：- Security
- Correctness

**locations**：- api/app/routers/tasks.py:89-103
- api/app/routers/tasks.py:160-162
- api/app/routers/tasks.py:202-204
- api/app/routers/tasks.py:260-261
- api/app/routers/tasks.py:315-317
- api/app/routers/tasks.py:363-365
- api/app/routers/tasks.py:392-394
- api/app/deps.py:36-40

**finding**：省略 Authorization 即绕过注册用户资源的所有权检查。各分支只有 current_user 存在时才比较 owner，匿名/无效 token 会令检查整个跳过。

**trigger_consequence**：只要取得某个注册用户的 document/task UUID（无需猜解 UUID），匿名可查看状态、下载全部页、创建引用其私有文件的新任务，并通过新增 cancel 取消其 waiting 任务。注册为另一个用户会 403，删除 token 反而成功。

**fix**：统一 owner 检查：Document.user_id 非空时必须登录且相等；游客使用明确的不可伪造会话/能力凭证或明确的资源 capability 策略。所有任务入口及多源文档逐个调用同一检查；已提供但无效的 token 不应静默降级。

**confidence**：确定，控制流直接可见；未运行复现。

##### API-C2

**severity**：Critical

**dimension**：- Security
- Correctness

**locations**：- api/app/routers/tasks.py:65-114
- api/app/routers/tasks.py:136-140
- api/app/routers/quota.py:69-76
- docs/adr/0003-guest-unrestricted-except-ocr.md:12

**finding**：OCR 登录门槛只存在于 ADR/前端意图，API 未实现。游客可使用 task_type=ocr_to_word，且游客 consume_quota 无条件返回。

**trigger_consequence**：匿名上传图片后直接 POST /api/tasks/create 可派发付费 PaddleOCR 工作，绕过明确的成本安全边界；非 OCR 不限流本身符合 ADR，不作为问题。

**fix**：创建任务前对 OCR 强制认证（并在任何扣额/持久化/分发前拒绝），保持非 OCR 游客策略不变。

**confidence**：确定；Worker 的 OCR converter 在有配置 token 时直接调用 service.ocr_file，未见下游认证拦截。

##### API-C3

**severity**：Critical

**dimension**：- Correctness
- Architecture

**locations**：- api/app/routers/tasks.py:130-140
- api/app/routers/tasks.py:206-224
- api/app/routers/tasks.py:285-289
- worker/worker/tasks.py:59-65

**finding**：新增 cancel 撤销的是数据库 Task UUID，但 send_task 三个分支均未设置 Celery task_id；实际消息 ID 是另一个 ID。任务标记取消/退款后仍会执行，并被 Worker 无条件改为 processing。

**trigger_consequence**：Worker 尚未消费时创建任务、调用 cancel、随后启动 Worker：API 返回取消成功，但消息仍在队列，Worker 会产生结果/消耗 OCR。即使补齐 ID，当前先读 waiting 再普通 UPDATE 的方式与 Worker 抢任务仍有竞态。

**fix**：持久化并使用真正 Celery 消息 ID（或明确设置 task_id）；更重要的是 API waiting→cancelled 与 Worker waiting→processing 使用条件 UPDATE/CAS/锁的互斥状态转换，只有成功取消者退款，Worker 不执行终态任务；取消和退款同事务且幂等。

**confidence**：确定 ID 不一致和 Worker 无状态保护；并发后果由现有读写顺序推导。

**coordination**：已告知 ReviewWorker；此取消分发问题由 API 侧报告，Worker 侧负责 retry/refund 其他问题。

##### API-R1

**severity**：Required / Important

**dimension**：- Correctness
- Architecture

**locations**：- api/app/routers/quota.py:41-52
- api/app/routers/tasks.py:113-140
- api/app/routers/tasks.py:268-289

**finding**：配额、Task 入库、Celery 分发是三个不具备失败补偿的提交边界。

**trigger_consequence**：配额 commit 后 Task 插入失败会丢额度；Task commit 后 broker 不可达/send_task 抛错会让用户收到 500，但 waiting Task 和扣额已持久化，且普通 create 的 active 检查将阻止后续任务。进程在 commit 与分发间崩溃也有同样结果。

**fix**：把扣额和 Task 创建放在一个 DB 事务，使用 transactional outbox 或可恢复派发状态可靠投递；分发失败必须有可重试/补偿且幂等的处理，不能仅在接口 catch 后假装成功。

##### API-R2

**severity**：Required / Important

**dimension**：- Correctness

**locations**：- api/app/routers/quota.py:31-38
- api/app/routers/quota.py:41-51
- api/app/routers/quota.py:55-63
- api/app/routers/tasks.py:206-224

**finding**：配额递增虽原子，但跨日重置和取消退款并不原子/幂等。

**trigger_consequence**：两个会话都读到昨日非零使用量：A 重置并扣一次后，B 仍把用量重置为 0，抹掉 A 新日消费；两个取消请求均读 waiting 可各退款一次；昨日任务今日取消会减掉今日额度。取消状态 commit 后退款失败则后续取消 409，不能补偿。

**fix**：用基于 quota date 的条件 SQL 原子重置/扣额，Task 记录实际扣费人、扣费日期及退款状态；状态转换与一次性退款同事务，不能只以 GREATEST(...,0) 防负数替代幂等。

**coordination**：Worker 也存在退款类型/日期/幂等问题，ReviewWorker 会汇报；可在总评合并为统一账务缺陷。

##### API-R3

**severity**：Required / Important

**dimension**：- Correctness
- Architecture

**locations**：- api/app/routers/tasks.py:102-114
- api/app/routers/tasks.py:219-224
- api/app/routers/tasks.py:259-277
- api/app/models.py:78-108
- docs/adr/0001-multi-file-task-document-id-anchor.md:12

**finding**：登录用户可用游客文档创建任务，扣额主体是 current_user，但任务权限、并发检查、退款主体均从 anchor Document.user_id 推导，导致主体丢失。

**trigger_consequence**：先匿名上传再登录转换（合理用户路径）：扣登录用户额度，Task 仍锚定 user_id=None 文档；历史/active 查询看不到，取消时不退款，下载按游客处理。多文件混合 owner/null 也触发。

**fix**：建立 Task 的明确创建者/扣费主体，不以源文件所有者代替；或在创建任务前显式、原子地认领所有游客输入并拒绝混合归属，确保历史、权限、退款统一。

##### API-R4

**severity**：Required / Important

**dimension**：- Correctness
- Security
- Performance

**locations**：- api/app/routers/tasks.py:31-41
- api/app/routers/tasks.py:73-114
- api/app/routers/tasks.py:119-121
- worker/worker/tasks.py:71-75
- worker/worker/converters/ocr_to_word.py:52-65

**finding**：任务输入没有按 task_type 校验：任意字符串 task_type、任意 params、任务与源格式组合均可在扣额后入队；pdf_merge 无数量上限/格式限制；单文件路径直接 uuid.UUID 不捕获非法输入。

**trigger_consequence**：正常注册用户提交 task_type=unknown 被扣额度并进入 Worker 不支持类型的早退（不退款）；OCR output_format 拼错会付费调用后静默生成 DOCX；params.pages=[] 等类型错误被送至 Worker；非法 UUID 返回服务器错误而非 4xx。

**fix**：用支持类型 Literal/Enum + 按类型参数模型（OCR 输出枚举、PDF 页码/旋转/水印参数等），UUID 类型参数，校验 source file_type、文件可用性以及合并输入数量/去重后的最小数量，所有校验在扣额前完成。

**scope_note**：合并多个具备不同实际后果的同一 API 边界缺陷，避免对每个弱校验单独刷问题。

##### API-R5

**severity**：Required / Important

**dimension**：- Correctness
- Performance

**locations**：- api/app/routers/tasks.py:105-111
- api/app/routers/tasks.py:229-289

**finding**：“每个用户只能有一个活动任务”的检查既可并发穿透，也完全缺失于 create-merge。

**trigger_consequence**：并发调用 create 时两个请求均在插入前看不到 active；已存在 processing 任务时调用 create-merge 仍可创建新任务。配额的 UPDATE 串行化发生在检查之后，不能保证活动任务约束。

**fix**：统一所有创建入口的用户级任务 admission，在同一个事务内锁定用户并检查/创建，或建立明确任务 owner 后使用数据库约束；游客免限流策略可单独保留。

##### API-R6

**severity**：Required / Important

**dimension**：- Correctness
- Security
- Performance

**locations**：- api/app/routers/documents.py:50-52
- api/app/routers/documents.py:67-85

**finding**：20MB 上传限制在 await file.read() 读取整个文件之后才执行；同步磁盘写入和 DB commit 位于 async 路由事件循环内。

**trigger_consequence**：单次超大 multipart 文件可以先耗尽磁盘 spool/内存，再被拒绝；合规 20MB 文件也会整体复制到内存。并发上传时同步写文件/SQL 可阻塞 API event loop。

**fix**：在入口/解析阶段限制请求体，按有界块读取累计计数，超过 20MB 即停止并清理临时文件；同步磁盘/DB 工作放线程或使用一致异步 I/O。该问题与 ADR 接受非 OCR 不限次数不同，属于单请求硬边界失效。

##### API-R7

**severity**：Required / Important

**dimension**：- Correctness
- Security

**locations**：- api/app/routers/documents.py:122-136
- api/app/routers/tasks.py:372
- api/app/routers/tasks.py:401
- README.md:17

**finding**：删除文档把逗号拼接的 result_path 当成一个文件名，导致多页产物全部残留；DB 记录已先删除，之后无法再从应用定位这些文件。

**trigger_consequence**：完成至少两页 pdf_to_image 后删除文档：os.path.exists('/tmp/.../a.png,/tmp/.../b.png') 为 false，返回 204 但两个真实文件仍在。

**fix**：按统一结果列表解析产物并去重/安全校验后清理，删除转换专属目录；删除失败应有持久化清理任务/重试，不要删掉唯一定位信息后直接忽略。

##### API-R8

**severity**：Required / Important

**dimension**：- Correctness
- Architecture

**locations**：- api/app/routers/documents.py:122-130
- api/app/models.py:108
- docs/adr/0001-multi-file-task-document-id-anchor.md:12-23

**finding**：删除只考虑 Task.document_id，不考虑 source_document_ids，也不保护 waiting/processing 任务。

**trigger_consequence**：合并任务引用 A+B、anchor=A；删除 B 会移除仍在队列中的必要输入但不会处理该 Task，执行时失败。删除正在执行的 anchor 会删除 Worker 正使用的 DB Task/输入，造成状态写入失败和产物孤儿。

**fix**：删除前检查全部多源引用与活动任务；活动引用应拒绝删除或通过可靠取消协议终止，完成任务的源文件/结果保留关系需明确；JSONB 方案也必须查询包含关系，不能只依赖 FK anchor。

##### API-R9

**severity**：Required / Important

**dimension**：- Correctness
- Security
- Performance

**locations**：- api/app/routers/documents.py:79-81
- api/app/routers/tasks.py:319-330
- api/app/routers/history.py:87-88
- api/app/models.py:63-66

**finding**：expires_at=上传后一天只写不读，file_status 始终 active；API/Worker 范围内未发现过期清理或过期访问限制。

**trigger_consequence**：超过一天文件仍可创建转换/下载，历史不会标记过期，输入和成功产物长期堆积。

**fix**：明确定义保留期限，提供计划清理任务及重试，同时创建/下载根据状态和 expires_at 拒绝过期文件，历史使用相同状态源。

**confidence**：API/Worker 静态确认无引用；请 Main 在其部署范围确认是否有仓库外运维清理，若有应调整结论。


#### optional

##### ReviewApi-optional-1

**severity**：Suggestion / Optional

**locations**：- api/app/routers/tasks.py:298-300

**finding**：路径 allowlist 使用字符串 startswith，/tmp/uploads-other 也会被接受。现有 result_path 是 Worker 生成，尚未找到普通 API 输入直接任意写该字段的路径，不升级为可利用路径穿越。

**recommendation**：使用路径组件/commonpath，并将 convert_<id> 父目录归属显式化。

##### ReviewApi-optional-2

**severity**：Suggestion / Optional

**locations**：- api/app/routers/quota.py:66-89
- docs/adr/0003-guest-unrestricted-except-ocr.md:12

**finding**：游客分支 return 之后遗留不可达 IP 限额代码，注释宣称只是测试放开，与已接受 ADR 相冲突。

**recommendation**：删除不可达旧策略与测试 TODO，文档说明当前正式策略，避免日后按误导注释“恢复”不被接受的限制。

##### ReviewApi-optional-3

**severity**：Suggestion / Optional

**locations**：- api/seed.py:18-35
- api/app/routers/auth.py:58

**finding**：seed 的密码哈希为 placeholder 非有效 bcrypt，sample.pdf Document 无物理路径；种子用户无法正常登录且种子文档不能转换。

**recommendation**：若 seed 用于可操作开发数据，应使用正常 hash_password 产生哈希并生成实际演示文件；若只是 schema fixture，应明确不用于 UI 演示并避免伪装 uploaded/active。

##### ReviewApi-optional-4

**severity**：Suggestion / Optional

**locations**：- api/app/routers/auth.py:39-47
- api/app/routers/auth.py:54-60

**finding**：注册“先查后插”未处理唯一约束竞争；认证接口也未见失败登录速率限制。前者会把同时注册同邮箱变成 500；后者是部署前需补的认证防护（ADR 只豁免非 OCR 转换，未豁免认证）。

**recommendation**：捕获唯一约束冲突返回 409，并在认证边界设计独立的帐号/IP 失败速率限制。

##### ReviewApi-optional-5

**severity**：Suggestion / Optional

**locations**：- api/alembic/env.py:15-19
- api/app/config.py:15-17

**finding**：应用通过 Pydantic 读取 .env，Alembic env.py 却直接读取 os.getenv 并使用独立默认 DSN；仅把 DATABASE_URL 配在 .env 的本地工作流中，迁移与应用可能连接不同数据库。

**recommendation**：共用同一 Settings 数据库 URL；本条适用环境依赖，请 Main 结合启动方式确认。

**tests_and_verification**：- **tests_reviewed**：先读了仓库唯一业务测试 web/src/lib/i18n.test.tsx；其仅覆盖国际化，与 API 合同无覆盖。api 中发现的测试路径均在 .venv 第三方依赖内。
- **build_verified**：False
- **commands_skipped**：按任务要求未运行 build/lint/tests/formatter/动态复现。
- **security_checked**：已逐路由追踪登录/匿名 owner、任务输入、付费 OCR gate、文件读取/删除、配额身份；未读取 .env 实际内容，配置/seed 展示做了凭据脱敏。
- **coverage_gaps**：- 匿名/用户A/用户B × 创建/多源创建/状态/页数/下载/取消/删除权限矩阵
- 匿名 OCR 拒绝，且拒绝前没有扣额/发消息
- 真实 Celery 消息 ID 与 cancel 状态互斥、双取消一次性退款
- 跨日配额 reset/consume 竞争、扣额/Task 入库/发送失败边界
- 非法 UUID/type/params/源格式拒绝且无账务副作用
- 多页结果和多源/活动任务删除、超期不可访问及物理清理
- 上传超过 20MB 的提前终止、合规大文件并发不阻塞

**minimal_safe_reproductions_for_main**：- {"finding": "API-C1", "steps": "隔离数据库/临时目录创建用户 A 的 success Task 和小结果文件；用 FastAPI 客户端不带 token 请求 status/download，另用用户 B token 对比；不用真实私人数据。取消可用 A 的 waiting Task 且替换 revoke 为记录调用的适配器。"}
- {"finding": "API-C2", "steps": "匿名创建自有测试 Document，替换 send_task 为只记录消息、不连接 Worker/付费云的适配器；请求 task_type=ocr_to_word，观察实际 201+派发（正确应 401/403）。绝不做真实 OCR 调用。"}
- {"finding": "API-C3", "steps": "先用记录 Celery task_id 的发布适配器确认 send_task 没有指定 id 而 cancel revoke 使用 DB UUID；若 Main 有隔离 Redis/Worker，再暂停消费、创建、取消、恢复消费小型 image_to_pdf，观察取消终态是否复活。"}
- {"finding": "API-R1", "steps": "隔离 DB 中令 send_task 抛连接异常，请求普通 create；检查响应错误后 Task 仍 waiting 且额度已减；下一次 create 是否 429。"}
- {"finding": "API-R2", "steps": "两个独立 DB Session 预读相同昨日非零 quota；A reset+consume，B 再 reset；检查 A 的今日消费被抹掉。双取消用同步屏障让两请求都读到 waiting 后继续，检查退款次数。"}
- {"finding": "API-R4", "steps": "隔离 DB、记录分发适配器提交 unknown task_type / 非法 UUID / 不合法 OCR output_format，验证是否在扣额前 4xx；不运行任何付费 converter。"}
- {"finding": "API-R7/API-R8", "steps": "临时目录存两张小结果文件并在 Task.result_path 逗号拼接；delete 后检查两个文件是否残留。另建 A+B 合并 waiting Task、删除 B，检查引用仍存在。"}
- {"finding": "API-R9", "steps": "隔离 DB 将 Document.expires_at 设为昨日并放小结果文件，测试下载/创建/历史；不需要等待真实 24h。"}

**whats_done_well**：- SQL 查询使用 SQLAlchemy 或参数化 text；没有在 API 检出拼接 SQL。
- JWT secret 无默认值，token decode 限定配置算法且校验过期；不向状态响应暴露 result_path。
- 同日普通额度递增的 UPDATE ... WHERE used<limit 正确使用数据库原子条件，这是可保留的基础。
- history 有明确分页上限并批量查最新任务，避免基本 N+1；逐页下载有负索引/越界检查。
- document delete 对注册用户资源明确要求登录且匹配 owner，说明可将其 fail-closed 语义统一到 tasks。
- 新增进度读取以非核心 enrichment 处理 Redis/格式失败，不将可选进度故障直接变成任务状态查询失败；不过 Redis 连接超时策略仍可后续加强。


### Worker

**verdict**：REQUEST CHANGES

**scope**：只读覆盖 worker/worker 下全部 Python 实现：任务编排、12 个转换器、转换器契约、PaddleVL OCR 服务、进度/Redis、Celery 配置、同步 DB 与模型；阅读 ADR 0001/0002/0003，并按需核对 API 任务/配额契约、结果字段迁移、Compose 与 Worker Dockerfile。包含未提交的三个逐页进度转换器及 tasks.py 变更。未修改文件，未执行任何构建/lint/tests/格式化或运行验证命令。

**architecture_summary**：- API 负责源文档选择与扣费，Worker 根据 Task.source_document_ids 优先解析输入（符合 ADR 0001），通过 CONVERTER_MAP 调度，生成临时产物并将路径与状态写回 PostgreSQL。
- OCR 保持 ocr_to_word 单任务类型，由 params.output_format 分流 DOCX/TXT/Searchable PDF（符合 ADR 0002）。
- 未提交进度修改仅接入 pdf_to_word/pdf_to_image/images_to_pdf，通过同步 Redis HSET+EXPIRE 写每页进度，DB 仍是任务最终状态的来源。
- ADR 0003 明确允许游客非 OCR 无限额，因此不把缺乏游客 rate limit 本身列作 Worker 问题；单任务内存/时间边界仍缺失。


#### critical

##### W1

**location**：worker/worker/converters/pdf_compress.py:33-39

**title**：压缩把 JPEG 文件字节当作已解码图像 stream，成功返回损坏的 PDF

**trigger**：对含普通 RGB 图像的 PDF 执行 pdf_compress。

**impact**：Pixmap.tobytes('jpeg') 产生 JPEG 文件编码；Document.update_stream 将其当原始 stream，并应用 /FlateDecode，而不是建立正确的 /DCTDecode 图像对象。输出标记成功但图片像素损坏，属于静默内容损坏。

**fix**：使用 PyMuPDF page.replace_image(xref, stream=jpeg_bytes) 之类同步更新图像对象字典和编码的方法，而非裸 update_stream；每个 xref 只处理一次，并明确处理 CMYK/透明通道。

**evidence**：Main 已实际复现：100x100 纯红 RGB 图片 PDF，输入中心像素 (255,0,0)，压缩输出中心像素 (0,0,0)，Filter 变为 /FlateDecode。

**minimal_repro**：保留 Main 的小型 RGB 图片 PDF 转换/重开渲染像素比较复现；另用两个页面复用同一 xref 检查不被重复转码。

##### W2

**location**：worker/worker/tasks.py:117-123,137-147

**title**：正常 Celery Retry 被通用异常捕获，重试尚未结束就标失败并退款

**trigger**：任一转换器抛非 ValueError 的暂时异常，例如 OCR 轮询超时、LibreOffice 临时失败。

**impact**：Celery 5.4 Task.retry 发布重试后抛 Retry；外层 except Exception 会吞掉此控制异常，写 failed 并扣减 daily_quota_used，而排入队列的重试仍会执行。用户先看到终态失败，随后任务可复活；每次暂时失败都可多退一次额度，Celery 当前执行还会表现为正常返回。传 exc=e 时重试用尽通常重抛原异常，专门的 MaxRetriesExceededError 分支并不能实现作者预期的最后一次退款。

**fix**：显式让 Retry 透传；把暂时失败状态和最终失败状态分开；依据 retries/max_retries 判定终止，并将最终状态与一次性退款原子提交。不要在通用异常处理里把 Celery 控制异常当业务失败。

**evidence**：静态高置信，已核对 Celery 5.4 官方 Task.retry 源码的 S.apply_async() 后 raise Retry 语义；本代理未运行复现。

**minimal_repro**：使用隔离假 DB/session 与真实 celery.exceptions.Retry：转换器第一次抛 RuntimeError，retry 方法抛 Retry；观察当前函数吞异常、任务 failed、退款被调用。修复后应向调用者透传 Retry 且不终结/退款；第二次成功只提交 success。

##### W3

**location**：worker/worker/tasks.py:128-144；worker/worker/models.py:45；api/alembic/versions/001_create_users_documents_tasks.py:79

**title**：多页图片路径列表超过 varchar(512) 后任务卡在 processing

**trigger**：默认 Linux 临时目录下执行约 9 页及以上（但不超过允许的 50 页）的 PDF→图片。

**impact**：每页路径约 62 字符，9 页逗号连接约 566 字符，超过 result_path varchar(512)。success 的 commit 失败；except 分支没有 rollback 就再次查询，同一 SQLAlchemy Session 处于失败事务状态，二次查询也失败。DB 留在先前提交的 processing，finally 删除全部刚生成产物。

**fix**：将多产物建模为 JSONB/独立产物表，或者生成一个明确的打包产物路径；同步迁移 API/Worker 模型及消费者。所有 DB 提交错误恢复前先 rollback，终态处理应使用有效事务。单纯放宽页面上限或截断路径不解决契约。

**evidence**：已核对 API/Worker 模型及实际迁移字段均为 String(512)，静态高置信；Main 已收到最小复现建议。

**minimal_repro**：生成 9 页普通 A4 空白 PDF，转换得到输出路径，先计算 join 长度；在临时 PostgreSQL schema/隔离事务写同样 varchar(512) 字段，确认字段溢出及未 rollback 的二次查询失败。


#### required

##### W4

**location**：worker/worker/converters/pdf_to_word.py:37-58

**title**：PDF→Word 的图片处理分支实际上收不到图片

**trigger**：含图片的普通 PDF 或只有扫描图片的 PDF 使用 pdf_to_word。

**impact**：get_text('dict', flags=TEXT_PRESERVE_WHITESPACE) 显式覆盖默认 flags，未包含 TEXT_PRESERVE_IMAGES。随后 type==1 的图片处理代码不可发挥作用；图文文档静默丢图，扫描 PDF 可输出空白 Word 并 success。

**fix**：采用 fitz.TEXTFLAGS_DICT 或显式包含 TEXT_PRESERVE_IMAGES 的所需 flags；保留图片失败时不应完全无提示的错误处理。

**evidence**：PyMuPDF 官方常量文档明确 TEXT_PRESERVE_IMAGES=4 决定图片块是否保存在 TextPage；当前只传空白保留标志。未执行转换。

**minimal_repro**：创建一页含短文本和小 RGB 图片的 PDF，转换后检查 docx ZIP 的 word/media 及文档图片关系；再验证扫描单页 PDF 不应空白。

##### W5

**location**：worker/worker/redis_client.py:11；worker/worker/progress.py:23-29；worker/worker/tasks.py:105-110

**title**：新增进度上报可以让本地转换永久阻塞

**trigger**：Redis TCP 连接建立但不响应，或读取连接挂起；默认 URL 没有另行设置超时。

**impact**：redis-py 5.1 默认 socket_timeout/socket_connect_timeout 为 None；每页在转换线程同步 hset/expire，try/except 只有抛异常后才生效。转换由不依赖 Redis 进度变为可能永远卡在 processing，所谓忽略上报故障并不成立。

**fix**：为进度专用 Redis 客户端配置短且有界的连接/读取超时及有界重试；故障立即降级。可把 HSET+EXPIRE 合并 pipeline，并限制高频上报，但超时是必需修复。

**evidence**：未提交进度功能新增的风险；已核对 redis-py v5.1.0 官方源码默认超时为 None。

**minimal_repro**：本机测试 TCP server accept 后不回应；子进程调用 report_progress，外部设置 2~3 秒 deadline 防止挂住主审查进程。修复后在短超时后返回，转换继续。

##### W6

**location**：worker/worker/tasks.py:65-93,114-116,181-191；api/app/routers/tasks.py:113-114

**title**：退款既遗漏真实扣费失败，也能退还根本没扣的额度

**trigger**：A) 已扣费任务源文件不存在、未知转换类型、超过 PDF→image 50 页限制或其他 ValueError；B) 登录用户已有用量，免费 PDF 工具抛一般运行异常；C) 跨日失败或重复执行同一失败任务。

**impact**：A) 直接 _fail_task 后 return，无退款；B) _refund_quota 只看锚点 Document.user_id，不检查是否扣费，免费工具失败也递减用户用量；C) 没有扣费日期/退款标记，能冲减新一天或其他成功任务的额度。这些即便修复 W2 仍独立存在。

**fix**：记录 task 的实际 charge owner、计费窗口及已扣/已退状态；所有终态失败统一经一次性退款流程，仅退还实际扣费且对应的计费窗口。最小先补 task_type 扣费策略一致性，但不能替代幂等记账。

**evidence**：API 明确跳过 PDF_TOOL_TYPES 扣费，Worker 退款没有该分支；ValueError/源文件缺失各分支确实不退款。

**minimal_repro**：隔离用户用量=3：分别运行已扣费的 51 页 pdf_to_image 失败、未扣费 pdf_compress RuntimeError，观察前者不退、后者误退；同任务重复失败及跨日重置后失败各验证一次。

##### W7

**location**：worker/worker/tasks.py:56-62,128-135；worker/worker/config.py:9-10

**title**：acks_late 重投递没有执行幂等保护，会重跑已成功任务

**trigger**：Worker 已提交 success 后、消息确认前进程丢失；或队列重复投递同一 Task ID。

**impact**：启用 acks_late/task_reject_on_worker_lost，但读取任务后不检查状态就写 processing。可重复调用收费 OCR、覆盖成功结果路径并遗留原结果目录；并发重复投递会对同一任务相互覆盖状态。与 API cancel/revoke 的问题同源，但不只限于取消。

**fix**：使用原子状态转移/执行租约来领取可运行的任务，终态任务直接返回；防止并发领取，并针对 worker_lost 的 processing 状态设计可恢复租约。产物与实际供应商 job 标识按稳定任务/执行标识管理。

**evidence**：静态高置信；API cancellation 的 Celery ID 错配及终态复活由 ReviewApi 单独报告，本项请与其合并去重。

**minimal_repro**：先成功执行一个隔离任务，再以同一 DB Task ID 重投递，统计转换器调用次数和原结果路径。并发领取时只应有一个实际转换执行。

##### W8

**location**：worker/worker/converters/ocr_to_word.py:122-151

**title**：Searchable PDF 隐形层不能正确承载中文等非 Latin 文本

**trigger**：OCR 返回中文/泰文等非默认 Helvetica 字体可编码字符；或一页只有少量较长文本行。

**impact**：insert_text 未选择 Unicode 字体，默认 fontname='helv'；非 Latin 文本会丢字/替换，视觉保持原扫描图因此容易误以为成功，但搜索/复制失败。另外按整页高度除行数生成字号，无页面宽度/真实文本 bbox 校验，少量长行会超出页面，文字与原内容的选区明显失配。

**fix**：使用涵盖目标语言并带正确 Unicode 映射的嵌入字体，并按供应商真实 OCR bbox/源页坐标放置文字；至少根据文字宽度约束字号/区域，不把行数当位置。

**evidence**：已核对 PyMuPDF 1.24.0 insert_text 默认 fontname='helv'；当前实现丢弃供应商定位信息，只以行号均分页面。未执行输出。

**minimal_repro**：不调用付费 OCR：构造 OcrResult(markdown_text='中文测试 ABC')，对本地空白/图片 PDF 调 _build_searchable_pdf，再 get_text/search_for；加入一页一长行，验证全文仍能检索且 bbox 在页内。

##### W9

**location**：worker/worker/services/paddle_vl.py:200-219；worker/worker/converters/ocr_to_word.py:58-59,122-126

**title**：OCR 结果解析跳过坏行，缺页仍会成功且文字层错页

**trigger**：供应商 JSONL 结果含至少一条有效页及一条非法 JSON/缺少 result 的页。

**impact**：解析异常只 warning+continue；total_pages 被重算为成功解析的页数，converter 仅拒绝完全空结果。DOCX/TXT 静默缺页；Searchable PDF 将剩余页按 enumerate 从第 1 页叠加，缺失中间页时后续文字还会加到错误原页。

**fix**：对任意不可解析页使结果失败，或显式形成用户可见的部分失败结果；保留真实 page index，并用供应商完成时 declared/extracted 页数校验完整性，不靠成功解析列表长度冒充总页数。

**evidence**：确定控制流行为，未真实请求供应商。

**minimal_repro**：本地 mock HTTP 返回 valid_page1 + malformed_line + valid_page3，调用 _fetch_result；当前返回成功的 2 页。修复后应明确拒绝，或精确保留 1/3 页及可见缺页状态。

##### W10

**location**：worker/worker/converters/pdf_to_image.py:29-39；worker/worker/config.py:1-20

**title**：只限页数、不限渲染像素，极小单页 PDF 可耗尽 Worker 内存

**trigger**：上传单页但 MediaBox 尺寸异常大的 PDF，触发 150 DPI 全页 get_pixmap。

**impact**：页数<=50 和上传字节大小不能约束解码后的像素数。单页渲染即可申请 GB 级内存；无 Celery task time limit/resource boundary，配合 worker_lost 自动重投递可形成反复杀死 Worker 的毒任务。游客无限额是 ADR 明确决定，但并不意味着允许一个任务无界内存。

**fix**：在分配 pixmap 前依据 page.rect*DPI 校验宽高、单页及累计像素/输出预算，拒绝超限输入；对转换执行设置隔离的内存/时间边界，防止不可恢复任务无限 requeue。

**evidence**：静态高置信；本代理未生成危险大分配。

**minimal_repro**：安全复现只创建大 MediaBox 小 PDF 并计算预计 width*height*3，不实际渲染大图；或在严格内存限制的子进程中用受控中等尺寸验证边界。


#### optional

##### ReviewWorker-optional-1

**location**：worker/worker/converters/word_to_pdf.py:26-39；excel_to_pdf.py:26-39；ppt_to_pdf.py:26-39

**description**：三个 Office 实现完全重复，且未给 -env:UserInstallation= 独立目录；同一容器 concurrency=2 可共享 LibreOffice 用户 profile，存在并发代理/锁竞争风险 [INFERENCE，需真实 LibreOffice 并发验证]。建议 Main 以两个不同小文档并发检查产物后，再决定每任务独立 profile 与复用统一 Office 调用模块。

##### ReviewWorker-optional-2

**location**：worker/worker/services/paddle_vl.py:75-79,188；worker/worker/converters/ocr_to_word.py:253-264

**description**：OCR job_id 仅保存在局部变量，轮询或结果下载临时失败后的 Celery 重试会重新提交付费 job；建议持久化 job ID 并恢复轮询。供应商返回下载 URL 无 host/scheme/响应大小限制，可加供应商域名与私网地址策略/流式大小限制；未证实用户可直接控制该 URL，因此不按可利用 SSRF 高危报告。

##### ReviewWorker-optional-3

**location**：worker/worker/converters/__init__.py:30-33；worker/worker/tasks.py:98-113

**description**：进度能力用 task_type 字符串集合另行维护，基类签名未表达 progress_callback；新增转换器可能漏接进度。当前三个实现签名匹配，没有即时 TypeError。后续可把可选回调统一为转换器接口参数，避免编排层再维护能力清单。

##### ReviewWorker-optional-4

**location**：worker/worker/converters/pdf_split.py:9-23；worker/worker/converters/pdf_rotate.py:29-36

**description**：页码解析静默裁剪越界范围；rotate 对完全越界页码返回原文件并标成功。是否应拒绝部分/全部越界应确认产品规则，建议至少拒绝完全空选区，不让用户以为指定页已旋转。

**integration_notes**：- 共享结果问题已向 Main 交接且 Main 已确认：worker/tasks.py:95 的 /tmp/convert_* 不在 Compose API/Worker 共同挂载卷。请只报一次。
- 不报告旧 CLAUDE 的“缺 -Q 导致不消费”：config.py 实际声明了 default/office task_queues，Main 已实测 app.amqp.queues.consume_from 包含两者。
- 不把“多页只能访问第一页”笼统当新发现：API 现有 /pages 和 /pages/{index} 路径可逐页访问；普通 download 仍取首图，由 ReviewApi/Main 判断产品契约。
- API 取消 revoke ID 与任务队列 ID 不一致、访客权限/OCR 登录边界由 ReviewApi 报告，不在本输出重复列主项。

**tests_and_verification**：- **tests_reviewed**：按要求先定位测试；全仓 Python test*.py / *test*.py / tests 目录匹配未找到 API/Worker 测试，唯一匹配是前端 i18n.test.tsx，与本 Worker 范围无关。
- **build_verified**：False
- **commands_run**：仅只读 git diff -- worker/ 用于查看未提交修改；未执行验证命令。
- **security_checked**：检查了输入解析、渲染资源分配、供应商 URL/错误路径、quota/idempotency 和 Worker 与 API 的职责边界。未读取 .env 或回显实际凭据。
- **proof**：W1 压缩内容损坏由 Main 的实际小文件实验确认；其他结论为源码及官方库契约的静态高置信结论，提供最小安全复现，需由 Main 集中执行。
- **coverage_gaps**：- 暂时失败→retry→success 与最终失败→一次退款状态机
- 有/无实际扣费及跨日/重复消息的配额记账
- 多页产物在真实 PostgreSQL 字段限制下的持久化
- 图文 PDF→Word 保图、压缩输出像素正确性、Unicode searchable PDF 检索
- OCR JSONL 缺页/畸形结构与供应商 job 恢复
- 进度 Redis 接收连接但不响应时的降级和巨大页面的分配前拒绝

**whats_done_well**：- CONVERTER_MAP 将任务选择与格式实现分离；12 种转换器都有统一结果对象，便于独立审查和复现。
- 多输入解析保持 source_document_ids 的原始顺序，符合 ADR 0001 权威输入列表约定。
- 大多数转换失败路径通过 finally 删除本次临时目录，Office 子进程使用参数列表而非 shell 拼接且有 120 秒 timeout。
- OCR 输入支持 PDF/图片，DOCX/TXT/Searchable PDF 分支集中在同一转换器，符合 ADR 0002，未引入重复的 OCR 队列类型。
- 进度非必需依赖的意图正确，已有异常降级与 TTL；修复短超时后可避免进度故障侵入主转换链路。

**sources**：- https://docs.celeryq.dev/en/v5.4.0/_modules/celery/app/task.html
- https://pymupdf.readthedocs.io/en/latest/document.html#Document.update_stream
- https://pymupdf.readthedocs.io/en/latest/vars.html#text-extraction-flags
- https://raw.githubusercontent.com/pymupdf/PyMuPDF/1.24.0/src/utils.py
- https://raw.githubusercontent.com/redis/redis-py/v5.1.0/redis/client.py


### 前端

**verdict**：REQUEST CHANGES

**overview**：已按测试优先方式完成 web/src 全量只读审查，包含当前未提交源码。前端主流程有明确的删除响应契约、OCR 预览格式、异步生命周期及可访问性缺陷；Main 已报告的 Node 20 生产构建失败也已沿真实依赖链定位。未执行任何构建、lint、测试、格式化或文件修改。

**coverage**：- **tests**：先读 web/src/lib/i18n.test.tsx：3 个测试覆盖支持语言、非法/缺失存储回退、客户端恢复与切换语言；随后读 src/test/setup.ts、vitest.config.ts。测试没有覆盖 SSR hydration 或任何转换工作流。
- **pages**：已阅读首页、登录、注册、转换、历史、merge-images 重定向，以及 tools 下 merge/split/compress/rotate/watermark/ocr/images-to-pdf 全部页面。
- **components**：已阅读 ToolPageLayout，以及 preview 下 FilePreview、PreviewModal、PdfPreview、ImagePreview、DocxPreview 和 barrel exports。
- **libraries**：已阅读 api、auth、i18n、useToolPage、fetchTaskFile、utils 全部实现。
- **localization**：已阅读 TranslationKeys、index 及 zh-CN/en/id/vi/th/fil/ms 七套完整字典。键均有显式 TranslationKeys 类型约束；没有凭非母语判断宣称翻译错误。
- **configuration**：已阅读 package.json、Next/TypeScript/Tailwind/PostCSS/Vitest 配置、Dockerfile、components.json、next-env.d.ts、globals.css。依赖安全审计及部署配置由 Main 负责。
- **cross_module_contracts**：核实 API 创建任务/合并、状态/取消、下载/分页产物、文档删除、历史与 CORS；只读 OCR worker 的实际 txt/pdf/docx 输出分支。
- **architecture**：页面负责文件/参数选择，useToolPage 顺序上传→createTask→自调度轮询→下载，ToolPageLayout 控制阶段 UI，FilePreview 按 taskType 分派预览器。当前公共结果类型缺少真实产物格式，公共 hook 新增的进度/取消能力未接到任何页面。


#### critical

##### WEB-C1

**locations**：- web/src/components/preview/PdfPreview.tsx:4
- web/src/components/preview/FilePreview.tsx:7
- web/src/components/ToolPageLayout.tsx:6
- web/src/components/preview/index.ts:1-3
- web/Dockerfile:1-11

**title**：静态导入 PDF 预览依赖导致 Node 20 生产预渲染失败

**trigger**：按 Dockerfile 的 Node 20 环境执行生产构建；不需要用户打开预览。

**effect**：Main 已实际观察 watermark prerender 抛出 Promise.withResolvers is not a function，生产构建不能完成。

**evidence**：确认链为页面→ToolPageLayout→preview/index→FilePreview→PdfPreview→react-pdf。已安装 react-pdf/dist/esm/index.js:1 顶层导入 pdfjs-dist；pdfjs-dist/build/pdf.mjs:5762-5763 在 isNodeJS 分支顶层调用 Promise.withResolvers。use client 不阻止服务端预渲染时评估静态 import。

**fix**：把浏览器 PDF 预览依赖放到真正客户端-only 的动态导入边界（例如 client component 中 dynamic(...,{ssr:false})），避免 barrel 导出再次引入静态链；同时统一声明并验证 Node/PDF.js 运行时兼容版本。

**verification**：仅采用 Main 已执行的构建结果并静态核实依赖链，没有重跑。


#### required

##### WEB-R1

**locations**：- web/src/lib/api.ts:33
- web/src/app/history/page.tsx:74-83
- web/src/app/convert/page.tsx:204-213
- api/app/routers/documents.py:96-140

**title**：成功的 DELETE 204 被 JSON 解析当作删除失败

**trigger**：在转换结果页或历史页确认删除一个自有文档；API 成功删除并返回无 body 的 204。

**effect**：request 无条件 res.json() 抛出 SyntaxError；历史行不会移除，转换页不会 reset。用户会看到失败提示或继续看到已被永久删除的文件，再点删除得到 404。

**fix**：让 API 客户端显式支持 void/204 响应，不对空响应解析 JSON；两个删除调用按成功结果更新 UI。

**safe_repro**：临时浏览器拦截 DELETE 返回 new Response(null,{status:204})，观察是否正常移除行/reset；不要用用户真实文件做删除验证。

##### WEB-R2

**locations**：- web/src/app/tools/ocr/page.tsx:47-57
- web/src/app/tools/ocr/page.tsx:120-124
- web/src/components/preview/FilePreview.tsx:19-35,102-103
- worker/worker/converters/ocr_to_word.py:52-65,90-107,152-153

**title**：OCR 的 TXT 和 searchable PDF 结果必然被交给 DOCX 解析器

**trigger**：OCR 选择纯文本或可搜索 PDF，转换成功后点击预览。

**effect**：页面始终传 taskType=ocr_to_word；FilePreview 一律映射为 docx，而 worker 确实生成 .txt/.pdf，docx-preview 无法把这些产物当 DOCX 解压/显示。历史页也只有 taskType，没有产物格式，问题同样存在。

**fix**：在任务/历史结果契约提供实际 output format 或 MIME，并由预览层据此分派；PDF 使用 PdfPreview，TXT 使用安全文本呈现或明确不提供预览；不要把 output format 偷换成任务类型。

**safe_repro**：用本地 TXT 和最小 PDF fixture 拦截同一个 ocr_to_word 任务的成功下载，分别点预览，不必真实调用收费 OCR。

##### WEB-R3

**locations**：- web/src/lib/api.ts:58-65

**title**：非 JSON 上传响应会使上传 Promise 永远不结算

**trigger**：上传经过网关返回 HTML 413/502/504，或 2xx 返回无法解析的内容。

**effect**：JSON.parse 在 XHR onload 事件回调内直接抛出，不进入 Promise 构造器同步异常处理；既不 resolve 也不 reject。useToolPage 永久停在 uploading，页面无重试/取消出口。

**fix**：在事件回调内捕获解析错误并 reject ApiError；非 JSON 错误响应使用状态码和本地化兜底信息。为 XHR 明确处理 timeout/abort，确保每条结束路径都结算。

**safe_repro**：浏览器拦截上传返回 status=413、Content-Type=text/html、body=<html>too large</html>；观察错误状态而非永久转圈。

##### WEB-R4

**locations**：- web/src/lib/i18n.tsx:27-30,80-81
- web/src/app/layout.tsx:17-20
- web/src/lib/i18n.test.tsx:42-62

**title**：持久化的非中文语言与 SSR 初始输出不一致，触发 hydration mismatch

**trigger**：localStorage.locale=en（或其他非默认语言），硬刷新任一包含翻译文本的页面。

**effect**：服务端 readStoredLocale 返回 zh-CN，客户端首次 useState 初始化立刻读取 en，首次 hydration 的文本/选择值不一致。body 的 suppressHydrationWarning 不会修复深层翻译内容的不匹配。

**fix**：用 cookie/服务端初始 locale 保证首屏一致，或统一首帧默认 locale、挂载后恢复存储；不要继续用 suppressHydrationWarning 隐藏问题。测试应覆盖 server render→hydrate，而不只 client render。

**safe_repro**：在能启动的浏览器运行环境设置 locale=en 后硬刷新首页，观察 hydration console；当前测试 render 不能触发该场景。

##### WEB-R5

**locations**：- web/src/app/convert/page.tsx:293-305
- web/src/app/tools/images-to-pdf/page.tsx:220-231
- web/src/app/tools/ocr/page.tsx:143-154
- web/src/app/tools/compress/page.tsx:86-96

**title**：所有上传入口都是不可聚焦 div 加 display:none 文件输入，键盘用户无法开始核心流程

**trigger**：只使用 Tab/Enter/Space 操作任意转换/工具页面。

**effect**：点击区域无 button/label 语义、无 tabIndex/key handler；文件 input 被 hidden 移出可访问树。无法聚焦并打开文件选择器，后续开始按钮又因无文件禁用。其他 PDF 工具同型实现。

**fix**：保留拖拽增强，但提供真实可聚焦按钮调用 file input，或使用正确关联且可访问的原生文件输入；给控件明确可访问名称。

**safe_repro**：以纯键盘进入 /convert 和 /tools/images-to-pdf，遍历 Tab 并尝试选择文件。

##### WEB-R6

**locations**：- web/src/lib/useToolPage.ts:52-71,76-130,133-159
- web/src/components/ToolPageLayout.tsx:84-87

**title**：上传/创建/轮询没有卸载清理，离开页面后仍继续执行任务链

**trigger**：文件正在上传或任务仍 waiting/processing 时点击始终存在的“返回首页”。

**effect**：hook 没有 useEffect cleanup。上传结束后依旧 createTask，旧轮询继续请求直至终态/最大次数；重新进入会创建另一套状态，游客尤其无法从历史恢复离开时创建的任务。仅 clearTimeout 也不能拦截已经在飞行的 poll 在完成后重新 setTimeout。

**fix**：为每次运行建立存活/请求代际标识并在卸载/reset/cancel 时作废，abort XHR/fetch、清理 timer；在每个 await 后验证仍属于当前运行。是否取消服务器任务应使用显式业务策略，而不是把清理本地 polling 等同于后台取消。

**safe_repro**：拦截并延迟上传/状态请求，导航回首页后再放行，检查是否仍创建任务/持续请求；只使用临时任务。

##### WEB-R7

**locations**：- web/src/components/ToolPageLayout.tsx:52-58,114-145
- web/src/lib/useToolPage.ts:81-88,166-181
- web/src/app/convert/page.tsx:261-291
- web/src/app/tools/images-to-pdf/page.tsx:196-218

**title**：进度条和排队取消虽然已实现，但没有任何页面传入相关 props

**trigger**：API 状态返回 progress/current/total，或任务处于 waiting 可取消状态。

**effect**：全 web/src/app 对 canCancel、onCancel、conversionProgress、progressDetail 无任何引用。Layout 默认 conversionProgress=0/canCancel=false，因此所有工具始终无进度条、无取消按钮；翻译字典中的进度/取消字段同样未被消费。

**fix**：在所有 ToolPageLayout 调用处传入 hook 的四个状态/回调及对应翻译，或让统一 layout 接受一个明确的 workflow 状态契约，避免每页漏接。

**safe_repro**：浏览器 fixture 状态依次返回 waiting→processing(progress=50,current=5,total=10)，观察取消按钮及百分比。

##### WEB-R8

**locations**：- web/src/lib/useToolPage.ts:212-217
- web/src/components/ToolPageLayout.tsx:92-98,148-180
- web/src/app/convert/page.tsx:207-213

**title**：成功页的下载/删除错误不会渲染，用户点击失败后没有反馈

**trigger**：任务已 done，下载返回 404（过期）、500 或断网；或转换页删除失败。

**effect**：download 只 setError，不改 stage；Layout 仅在 idle/error 阶段显示 error，done 阶段完全不读 error。因此页面仍显示处理完成，没有下载文件，也没有失败原因。

**fix**：将动作错误放在 done 阶段可见的位置，并保留已完成 taskId/重试下载能力；删除错误同理。不要为显示错误把已成功转换误标为转换失败。

**safe_repro**：对已完成的临时任务拦截 download 返回 404，确认页面出现可见错误并仍可重试。

##### WEB-R9

**locations**：- web/src/components/preview/PreviewModal.tsx:38-65

**title**：响应式预览容器把同一个预览子树挂载两次，隐藏分支仍执行全部工作

**trigger**：打开任意文件预览，不论桌面还是移动端。

**effect**：children 同时插入 mobile 和 desktop 容器，CSS hidden 只隐藏显示，不阻止组件 mount。DOCX 会两次请求并 renderAsync，图片会两次请求 pages 和每一页；PDF 会挂载两个 Document/Page 解析渲染器。对于多页图片，N 页变成 2N 次图片下载。

**fix**：用一个响应式容器承载唯一 children，通过 CSS 改变固定/内嵌布局；或确保断点分支只挂载一个预览实例，而不是只隐藏另一份。

**safe_repro**：打开 2 页图片任务预览，Network 应只出现一次 /pages 和各页一次 /download/i；当前代码会出现两套。

##### WEB-R10

**locations**：- web/src/components/preview/FilePreview.tsx:55-75
- web/src/components/preview/ImagePreview.tsx:28-54
- web/src/app/tools/images-to-pdf/page.tsx:130-147,185-192

**title**：预览 Blob URL 清理捕获旧 state，正常关闭和部分失败都会泄漏产物

**trigger**：正常打开/关闭 PDF 或图片预览，或多页加载一部分后失败/关闭；图片选择超过上限或直接导航离开。

**effect**：FilePreview effect 首次闭包捕获 pdfFile=null，cleanup 不会 revoke 后来创建的 URL；ImagePreview 首次 cleanup 捕获空 imageUrls，也不会释放该批 urls，部分失败时局部 urls 更无人释放。图片选择页超出 20 个时已创建的 URL 被 slice 丢弃，导航卸载无清理。重复大文件预览会保留无用 Blob。

**fix**：由 effect 本地变量/资源集合拥有本次创建的 URL，在完成、失败、中断、卸载时统一释放；不要用启动 effect 时捕获的 state 做资源清理。限制数量后再创建 thumbnail URL，并补选择页卸载回收。

**safe_repro**：临时记录 URL.createObjectURL/revokeObjectURL 的 URL 集合，进行打开关闭、半途失败和选超过上限三种操作，检查未释放集合而不是仅断言调用次数。

##### WEB-R11

**locations**：- web/src/app/history/page.tsx:24-42,179-204
- api/app/routers/history.py:16-25,82-92

**title**：历史页没有接入五种 PDF 工具产物，离开结果页后没有再次取回入口

**trigger**：登录用户完成 pdf_merge/split/compress/rotate/watermark，离开工具页后从历史记录寻找输出。

**effect**：历史只列出旧七种转换类型的预览白名单，五种 PDF 工具没有预览按钮；整个历史列表也没有 download 操作。它们只显示原始任务枚举和删除按钮，成功产物无法从 UI 再次获取。

**fix**：统一完整任务类型展示契约，为所有成功且未过期任务提供下载；按真实结果格式提供预览，避免页面各自维护遗漏的字符串白名单。

**safe_repro**：历史 API fixture 返回一个 pdf_compress success item，确认该行具备可用下载/预览操作。

##### WEB-R12

**locations**：- web/src/components/preview/DocxPreview.tsx:17-25,38-55
- web/src/components/preview/ImagePreview.tsx:19-43,66-71
- web/src/components/preview/FilePreview.tsx:47-53,79-85

**title**：切换任务不会清除预览错误，单次失败可污染后续正常文件

**trigger**：历史页预览一个已过期/加载失败的 DOCX 或图片任务，不关闭面板直接点击另一个成功的同类型任务；或 PDF 失败后切到图片/DOCX。

**effect**：同类型子组件被复用，但 effect 没重置 error/loading。DocxPreview 错误分支还移除了 containerRef 节点，下一请求返回后因 ref=null 直接 return。FilePreview 的 error 仅在 PDF 加载分支重置，切换非 PDF 仍被旧 error 遮住。

**fix**：让加载状态和错误按 taskId/产物 key 重置，并为过期结果/旧请求加代际防护；可选择按 taskId+format 对预览实例设 key，同时正确回收旧实例资源。

**safe_repro**：A 文档下载返回 404，B 同类型文档返回有效 fixture；不关面板从 A 切 B，应可显示 B。

##### WEB-R13

**locations**：- web/src/app/tools/compress/page.tsx:9-12,66-84
- web/src/app/tools/merge/page.tsx:91-109
- web/src/app/tools/split/page.tsx:65-83
- web/src/app/tools/rotate/page.tsx:68-86
- web/src/app/tools/watermark/page.tsx:76-94
- web/src/lib/useToolPage.ts:96-103,123,162,216

**title**：国际化只覆盖首页入口，整个 PDF 工具箱与公共错误仍硬编码中文

**trigger**：首页切换 English/其他六种语言，再进入任意 PDF 工具或遭遇上传/轮询/下载错误。

**effect**：五种 PDF 工具没有使用 useI18n，标题、参数、操作、验证文本均中文；useToolPage 也绕过字典中已存在的错误翻译。images-to-pdf 还漏传 back/upload/status 标签而落回中文默认值。

**fix**：为所有 PDF 工具文本补入现有 TranslationKeys 七语言契约；公共 hook 返回可翻译错误码或消费现有翻译函数，Layout 默认标签同样从现有 provider 获取。

**safe_repro**：设置 locale=en 后逐个进入 PDF toolkit 页面，检查标题、参数、上传状态与失败信息，不要求母语质量评判。

##### WEB-R14

**locations**：- web/src/lib/auth.tsx:37-45

**title**：任何临时 /auth/me 失败都会永久删除仍有效的登录 token

**trigger**：已有有效登录 token，硬刷新时 /api/auth/me 因网络离线、网关 502 或 API 503 失败。

**effect**：catch 不区分鉴权失败和临时网络错误，直接 removeItem(token)，网络恢复后也不能恢复登录；历史页被当游客跳转，之后上传可能错误落为游客文件。

**fix**：只在明确无效凭据（例如 401）时清除 token；网络/5xx 保留凭据并暴露可重试会话加载状态。为并发 fetchUser/logout 增加过期请求保护，避免旧响应再写回 user。

**safe_repro**：用临时 token 和 me=503 fixture 加载页面，网络恢复返回成功后应该恢复会话，而不是要求再次输入凭据。


#### optional

##### WEB-O1

**locations**：- web/src/lib/useToolPage.ts:199-207
- api/app/main.py:12-18

**title**：跨域下载读不到 Content-Disposition，原文件名会丢失

**trigger**：默认 web:3000 与 API:8111/8000 跨源访问。

**effect**：API 没 expose_headers=[Content-Disposition]，浏览器对脚本隐藏该头，客户端命名总回退 converted_file；是否自动补扩展名取决于浏览器/MIME，不能断言所有浏览器均无扩展名。

**fix**：API 显式暴露 Content-Disposition，或同源代理；前端提供基于真实格式的稳健兜底。已通知 Main 合并为跨模块问题。

##### WEB-O2

**locations**：- web/src/app/history/page.tsx:103-115

**title**：历史请求没有错误态或过期响应保护

**trigger**：初次请求失败；或快速翻页后旧请求晚于新请求返回。

**effect**：拒绝 Promise 没 catch，finally 后可显示“暂无记录”而非加载失败；旧响应也可以覆盖当前 page 的 items/total。

**fix**：增加显式加载错误/重试与请求代际或 AbortController；只允许当前 user/page 对应请求提交状态。

**safe_repro**：fixture 让 page=2 延迟、page=3 先返回；检查最终列表属于第三页；首次 503 不应显示空历史。

##### WEB-O3

**locations**：- web/src/app/history/page.tsx:76-77,211-225

**title**：修复 204 删除后，删除最后一页唯一记录会把用户困在空页

**trigger**：有 21 条历史，处于 page=2，成功删除唯一一条。该路径目前先被 WEB-R1 遮住。

**effect**：total 降为 20 但 page 仍为 2，items 为空，total>20 条件使上一页按钮消失，剩余 20 条记录只能通过刷新/重新进入找回。

**fix**：删除后重新拉取并把 page 夹到有效页码，或删除当前页最后项时退一页；空的非首页仍保留返回上一页入口。

##### WEB-O4

**locations**：- web/src/app/tools/merge/page.tsx:65-72,93,134-145

**title**：PDF 合并宣称可拖拽排序，但实际只支持上移箭头

**trigger**：按副标题/列表文案拖动已选择的文件行。

**effect**：列表没有 draggable 或 DnD handlers，拖拽不会改变顺序；上移按钮本身能排序，上传顺序也正确保留，故不是产物顺序算法错误。

**fix**：复用项目已有 dnd-kit 排序模式，或把说明改成与上移操作一致。

##### WEB-O5

**locations**：- web/src/components/preview/PdfPreview.tsx:9-10
- web/src/lib/auth.tsx:59
- web/next.config.ts:3-5

**title**：浏览器安全与可用性加固建议，不宣称已发现 XSS

**trigger**：当前 PDF worker 运行时依赖 unpkg；会话 token 对同源 JavaScript 可读。

**effect**：阻断 CDN 会影响 PDF 预览；如果未来出现同源脚本注入/供应链失陷，localStorage token 暴露面较大。这是条件风险，不是已验证漏洞利用。

**fix**：优先随应用发布匹配版本的 pdf.js worker；结合 API 认证设计评估 HttpOnly cookie/BFF 与明确 CSP。认证迁移需端到端设计，不能只改前端存储。

**testing_gaps**：- 客户端 HTTP 契约：204 空响应、非 JSON 上传错误、下载失败可见性。
- SSR→hydrate 的持久化非默认 locale，以及每种工具页实际消费 i18n。
- 上传/创建/轮询在导航、reset、取消、飞行请求完成时的生命周期。
- OCR 三种实际产物格式与历史恢复下载。
- 预览只挂载一次、切换失败任务后的恢复、Blob URL 资源释放。
- 进度/取消 API 响应到真实按钮和进度 UI 的端到端行为。
- 键盘打开文件选择器、图片拖拽/键盘排序后上传顺序。
- 历史分页乱序响应、失败状态、最后页删除。

**positives**：- 文件多选顺序在前端 items/files→顺序上传 documentIds→create 请求中保持一致；图片页使用稳定 id 与 dnd-kit 的键盘排序坐标策略，而不是通过异步完成顺序决定合并顺序。
- 七语言共用显式 TranslationKeys；现有测试检查真实语言切换、持久化和 html lang，而不只断言函数被调用。
- 认证请求通过 Authorization header 发送 token，没有把凭据放到下载 URL；文件名和一般错误通过 React 文本节点呈现，未看到业务源码直接拼入 dangerouslySetInnerHTML。
- PDF 预览只渲染当前页，任务轮询使用串行自调度而不是重叠 setInterval；这些方向合理，但仍需补齐容器重复挂载和卸载生命周期。

**verification_story**：- **tests_reviewed**：True
- **own_commands_run**：无；严格遵守只读及跳过全部验证命令。
- **main_reported_tests**：Main 报告 npm test 的 3/3 用例通过；未把这解释为工作流正确性证据。
- **main_reported_build**：Main 报告 Node20.19 npm build 编译/类型阶段通过，watermark prerender 因 Promise.withResolvers 失败；已静态定位准确依赖链，不重跑。
- **browser_verified**：False
- **security_checked**：已静态检查认证存储/传输、请求与预览边界、React 输出方式、第三方 worker 依赖；依赖漏洞审计和服务端权限由 Main/ReviewApi 汇总。没有读取或回显 .env 密钥。
- **reproduction_status**：除 Main 已报告构建结果外，以上 safe_repro 均为建议 Main 执行的最小场景，不宣称已实测。


## 整改后验证与未关闭风险

### 本轮整改结论

上表 C1–C8 已完成代码/配置修复，并修复 R1–R4 与预览重复挂载、跨域文件名响应头等关联问题。**这不是全项目上线批准**：下方未关闭风险及原始附录中未明确关闭的 Required/Optional 仍然保留。没有自动提交、推送或部署到生产。

主要改动：

- API 集中处理身份、全部源文档权限、输入类型/参数与任务创建；扣额、UTC账期和任务入库同事务。任务显式记录创建用户，不再借游客主文档绕过任务归属。
- `004_task_ownership_delivery_artifacts.py` 增加任务归属、扣费事实、派发标志及 JSONB 产物列表。历史任务按全部来源的唯一非空 owner 回填；多 owner 或缺失来源标记 `ERR_ACCESS` 隔离，禁止普通读取/删除，需人工核对。历史扣费不伪造。
- 增加独立 `python -m app.dispatcher` 进程：数据库待派发记录是权威意图，消息使用任务 UUID；发送后才标记，重复消息由 Worker 执行锁和终态保护处理。
- Worker 使用绑定实际数据库连接的 PostgreSQL advisory lock。正常 Retry 透传；重试发布失败恢复数据库待派发意图；数据库故障重排原消息，下一次执行重新取锁。不会在失锁后重连结算，也不会因成功提交响应丢失而删除已发布产物。
- PDF 压缩使用完整图片替换而不是错误重写原始流；保留透明/特殊色彩图像。PDF→Word 恢复图片；搜索 PDF 保留中文；OCR JSONL 坏行/缺页不再被静默跳过。
- Next/eslint-config-next 升至 15.5.25、Sharp 0.35.4、PostCSS 8.5.28；锁文件由 npm 生成。PDF.js 从 SSR 链路移除而非禁用预览；响应式预览仅挂载一个内容树。
- Compose 传递构建期 API URL，共享 `/tmp/results`，增加 dispatcher，关闭数据库/Redis 宿主机端口发布；增加各服务 `.dockerignore`，修正文档中的实际服务、卷、启动和升级流程。

### 独立复审补充与处理

两个只读复审分别检查 API/部署安全和 Worker/迁移恢复语义，发现以下四项；主审已修补并验证：

|复审发现|修补与证据|
|---|---|
|游客 anchor + 私有 secondary 的历史任务仍可能匿名访问|003→004 真实迁移覆盖来源 owner 回填/冲突隔离；匿名与他人 status/pages/download 被拒绝；额外运行旧归属记录的 HTTP 回归|
|PG 已提交成功但客户端收到异常，清理会删掉成功产物|注入真实 commit 后的 OperationalError，保留 success 与9份产物，重放不再执行|
|DB故障可能确认丢失消息，失锁后可能无锁重写状态|连接建立失败转 Reject(requeue=True)；实际终止 PG backend 后先完成另一投递，旧执行不能覆盖成功结果或退款|
|百分号编码的数据库密码触发 Alembic 插值错误|仅在 ConfigParser 层将 `%` 转义为 `%%`；含编码字符的隔离 DSN 实际连接并报告004 head。测试数据库使用trust认证，不宣称验证了密码认证策略|

故障测试中 PostgreSQL 的默认终止调用只确认已发信号，曾造成锁释放时序不稳定；改用带超时的 `pg_terminate_backend(pid, 5000)` 等待退出后，最终整套回归通过。未通过延长应用重试或放宽业务断言掩盖该测试时序问题。

### 实际验证结果

后端使用隔离 PostgreSQL16、Redis 与新建临时 Python3.12 venv，安装仓库 API/Worker requirements 的精确版本；没有使用真实用户数据库或调用收费 OCR。

|验证|最终观察|边界|
|---|---|---|
|API/Worker/迁移回归|`api/tests` **20/20通过**|真实PG；包括并发准入、退款账期、取消、旧权限、派发、实际Celery Retry发布失败、DB断连与丢失commit响应|
|转换完整性回归|`worker/tests/test_conversion_integrity.py` **10/10通过**|真实PyMuPDF/Pillow/DOCX；OCR HTTP返回为本地fixture，不是云服务实测|
|前端回归|Vitest **15/15通过**，3个测试文件|包含204、非JSON错误/上传终止、预览单挂载、既有i18n|
|生产构建|Node **20.19.0**、Next **15.5.25**；16个静态页面生成完成|包含此前失败的watermark；另以隔离API地址构建并启动production server验证构建期配置|
|生产依赖审计|官方npm registry，`npm audit --omit=dev`：**0个已报告漏洞**|仅此次npm生产依赖审计，不等于无未知漏洞或Python依赖已审计|
|003→004、受限回退|多来源归属、缺失/冲突隔离、路径顺序正确；超过512字符拒绝downgrade且保留004及数据；短列表可回退|真实PostgreSQL事务，不是SQLite模拟|
|真实分进程端到端|FastAPI→dispatcher→Redis→Celery→PG→下载通过；9张PNG各不相同且保留红色像素；压缩PDF9页像素正确；DOCX含9个内嵌图片及9页文字|不是eager模式或假broker；文件位于同一临时结果目录，不是Docker volume实测|
|真实取消/退款|停Worker后排队、取消、再投递：取消仍为ERR_CANCELLED且无产物；另一已计费任务的源文件消失后最终失败并退款，额度回到原先1次|只操作临时生成用户/文件；没有撤销或清理用户原有任务|
|真实浏览器|production页面登录、上传、压缩成功；桌面1280与移动390宽PDF可见，翻到第2/9页；仅1个PDF Document/Canvas；关闭为0、重新打开仍为1，重开无pageerror|真实压缩产物与CDN PDF worker；另观察到DOCX图文预览；不是全站可访问性/生命周期验收|
|浏览器DELETE204|历史记录实际DELETE返回204，界面记录数5→4，无JSON解析失败|临时生成记录，保留原生确认流程|
|不响应的Redis TCP端|Worker进度调用 **0.503秒** 返回，API Redis **0.501秒** 超时|验证单次调用有界；不是所有网络故障的统一耗时保证|
|部署结构检查|6个服务、构建context、API build arg、结果卷、dispatcher依赖及内部端口配置一致|环境无Docker CLI，**未执行镜像构建/Compose启动**|

Python运行中仍有上游Pydantic/Starlette/passlib/python-jose弃用提示；没有将其抑制成“无警告”。最终回归中的预期故障日志来自故障注入，不是未解释的失败。

### 2026-09-14 微信小程序改造（ADR0005）审查与验证补充

范围：`miniprogram/` 新客户端、`POST /api/auth/wechat/login` 登录链路、CloudBase 部署脚手架。完整发现见当日代码评审；以下为实际验证。

|验证|最终观察|边界|
|---|---|---|
|小程序静态检查|`tsc --noEmit` **0错误**（修复前5个：未定义`POLL_MS`、`extensionType`无效字段、h5 `esbuild`无效配置、定时器类型）|仅weapp目标；H5端未验证|
|小程序构建|`npm run build:weapp` Webpack编译成功（修复后复验通过）|未在微信开发者工具/真机执行|
|API回归|`api/tests` **24/24通过**（隔离PG16 `easyconvert_test`，先`alembic upgrade head`）；其中`test_wechat_auth` 4项连跑3轮全绿|真实PG；jscode2session为mock，未调用微信服务|
|OCR登录约束冒烟|模拟小程序全链路：登录→上传PNG→`ocr_to_word`（`params.output_format=searchable_pdf`）201→任务归属微信用户、`ocr_mode=NULL`、配额扣1→非法`output_format` 422→游客OCR 401|一次性脚本执行后已删除，未调用收费云OCR|
|测试稳定性修复|`test_existing_openid_reuses_same_account`原断言整个JWT payload相等，`exp`秒级精度跨秒时偶发失败（实跑复现1214 vs 1215）；改为仅比较`sub`|意图是同一openid复用同一账号，DB count断言保留|
|小程序参数契约|12类任务的params与`PARAMETER_MODELS`逐项核对一致；水印补`opacity` select（0.1/0.3/0.6，API默认0.3），tsc+weapp构建复验通过|`extra=forbid`下未声明字段会被422，客户端只传已声明key|
|rotate角度类型缺陷|实测发现并修复：`RotateParameters.angle: Literal[90,180,270]`在Pydantic lax下拒绝字符串`"90"`（literal_error），小程序`start()`统一`String(v)`使旋转必然422；`ParamDef`新增`numeric`标记，angle与opacity均提交为JSON number，API侧实测`{'angle': 90}`通过；避免依赖Pydantic对不同数值类型的字符串强转差异|Web端发JSON number不受影响，仅小程序端需要此修复|
|部署上下文|新增根`.dockerignore`与`.gitattributes`（`*.sh`/`*.py`锁LF）；`.gitignore`补`.scratch/`、`.superpowers/`、`miniprogram/.swc/`|tar模拟context仅~110KB（api子集）；未执行真实docker build|

修复的Critical缺陷：结果页轮询引用未定义`POLL_MS`（整页不可用）、`chooseMessageFile`扩展名过滤字段名错误（类型检查失败且过滤静默失效）、`failed`终态不停轮询。未验证边界：微信真实登录、真机预览、云托管实际部署、`renderImages`多页串行下载的性能。

### 回归运行方式

**以下API测试会TRUNCATE应用表并执行迁移回退；只能在新建、隔离且已迁移的测试数据库运行。数据库名必须以 `_test` 或 `_audit` 结尾。不能只把生产数据库改名后运行。**

在临时验证venv中安装 `api/requirements.txt` 和 `worker/requirements.txt`；生产两个服务仍各自安装。提前在环境设置隔离的 `TEST_DATABASE_URL`、`DATABASE_URL`、`JWT_SECRET`、Redis/broker地址，以及包含 `api/` 与 `worker/` 的 `PYTHONPATH`。不要把真实凭据粘贴进命令历史。

```sh
# API目录；测试前停止连接此测试库的dispatcher/Worker
alembic upgrade head
python -m unittest discover -s tests -v

# Worker目录
python -m unittest discover -s tests -p test_conversion_integrity.py -v

# web目录
npm run test
npm run build
npm audit --omit=dev --registry=https://registry.npmjs.org

# miniprogram目录（tsc检查 + weapp构建；不需要隔离数据库）
npx tsc --noEmit
npm run build:weapp
```

### 未关闭风险与上线门禁

1. **部署升级必须协调**：备份旧Worker容器里的结果，迁移004，统一部署API/dispatcher/Worker并共享结果目录；旧文件搬运及路径更新不是SQL迁移自动完成。见[部署指南](../../DEPLOYMENT.md)。本轮未对真实数据库或容器执行升级。
2. **完整Docker、Python3.11镜像、LibreOffice实际转换、收费Paddle云OCR**没有实测；Python依赖漏洞审计尚未完成。不能拿WSL/Python3.12与npm结果代替这些验证。
3. **OCR外部作业恢复/计费幂等**未解决：供应商提交结果未知时仍可能产生重复外部请求；系统只承诺内部at-least-once恢复与账务保护，不承诺跨供应商exactly-once。
4. **资源与文件生命周期**仍有缺口：入口完整资源预算、文件魔数/解码上限、过期/孤儿文件清理等见原始附录。对未知DB提交结果保留目录是避免数据丢失的安全选择，可能留下需对账清理的孤儿目录。
5. **前端剩余契约**：完整工具历史识别、OCR txt/searchable_pdf格式预览、取消/导航竞态、Blob释放、部分下载失败显示、全站i18n/键盘可访问性、分页删除等未全面修复。历史页对pdf_compress仍显示原始类型且无预览按钮；本轮PDF浏览器验证走真实压缩工具页，不冒称历史工具预览已修复。
6. **游客与认证策略**：非OCR游客不限次数仍按ADR0003保留；只有游客来源的历史任务无法可靠恢复旧创建者，仍按原UUID能力访问策略处理。localStorage/CSP/CDN worker等条件性风险保留。
7. **小程序端（ADR0005）未验证边界**：微信真实登录（jscode2session）、开发者工具/真机全流程、云托管实际部署未执行；`/api/auth/wechat/login` 无频率限制；结果页多页产物为串行下载，大PDF体验待真机评估；`TARO_APP_API_BASE` 与 `appid` 在提审前必须替换为真实值。

审查前已有未提交改动未被回滚；修改停留在工作区，未创建commit或push。临时验证服务与数据在验证后清理，不作为项目运行依赖。
