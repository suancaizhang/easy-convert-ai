# 微信云托管（CloudBase Run）部署指南

> 指南给出推荐架构与必填配置；控制台字段名/入口可能随平台迭代调整，**具体点击路径以云托管控制台实际界面为准**。架构与依赖关系（服务拆分、CFS 挂载共享、环境变量）以此文档为准。

将 api / dispatcher / worker 原样跑在微信云托管：免 ICP 备案，默认域名 `*.tcloudbase.com` 直接配置为小程序合法域名（官方默认域名标注“开发测试”用途，竞赛演示可接受；生产建议后续绑定备案自定义域名）。

架构：**4 个云托管服务 + 2 个共享卷**，全部走私有网络互访，只有 api 暴露公网。

| 服务 | 镜像/入口 | 公网 | 端口 | 数据 |
|---|---|---|---|---|
| api | 本仓 `deploy/cloudbase/Dockerfile`，`SERVICE_MODE=api` | 是（小程序调用） | 8000 | CFS 挂 `/tmp` |
| processor | 同镜像，`SERVICE_MODE=processor` | 否 | 8001（健康探针） | CFS 挂 `/tmp` |
| postgres | `postgres:16` 官方镜像 | 否 | 5432 | CFS 挂 `/var/lib/postgresql/data` |
| redis | `redis:7-alpine`（appendonly） | 否 | 6379 | CFS 挂 `/data` |

`processor` 一个容器内同时跑 durability dispatcher（`python -m app.dispatcher`）与 Celery worker（`-Q default,office`），配 `health_server.py` 提供 HTTP 探活。

## 1. 前置（你侧，10 分钟内）

1. 微信公众平台 → 小程序后台 → 「开发管理-开发设置」：复制 **AppID** 与 **AppSecret**。
2. 腾讯云开通「微信云开发/云托管」，绑定该小程序 AppID，创建环境（选基础版即可）。
3. 云托管控制台确认环境网络为「私有网络 VPC」创建或复用；记下 VPC/子网 ID。

## 2. 共享存储（CFS）

- 腾讯云 → 文件存储 → 创建 CFS（与云托管同地域、同 VPC/子网）→ 记下文件系统 ID 与挂载点 ID。
- 云托管控制台 → 每个服务 → 「存储挂载」：

| 服务 | 远程目录 | 容器挂载路径 | 说明 |
|---|---|---|---|
| api / processor | `<cfs-id>:/`（或 /shared） | `/tmp` | 源文件、guest、`/tmp/results` 全部落 CFS，两服务天然共享（满足 `RESULT_DIR` 同一物理存储的约束） |
| postgres | `<cfs-id2>:/pgdata` | `/var/lib/postgresql/data` | 数据库持久化 |

> 挂载 `/tmp` 会把镜像内 `/tmp` 内容遮住；本应用不依赖镜像内 `/tmp`，可接受。若想分离，挂 `/mnt/cfs` 并设 `RESULT_DIR=/mnt/cfs/results`、`TMPDIR`。CFS 为网络文件系统，低频小文件写入无压力；高频热数据应用层已避免。

## 3. 镜像构建与推送

命令行需要 Docker，且配置文件从仓库根构建：

```sh
docker build -f deploy/cloudbase/Dockerfile -t ccr.ccs.tencentcloud.com/<你的环境ID>/easy-convert:latest .
docker push ccr.ccs.tencentcloud.com/<你的环境ID>/easy-convert:latest
```

或云托管控制台「代码构建」直连 GitHub 仓库，Dockerfile 路径填 `deploy/cloudbase/Dockerfile`（推荐，免本机 Docker）。

## 4. 创建四个服务（控制台）

每个服务：选择镜像 → 设置环境变量 → 存储挂载 → 端口/健康检查 → 部署。

**环境变量（api 与 processor 完全一致）**

| 变量 | 值 |
|---|---|
| `DATABASE_URL` | `postgresql://easyconvert:<密码>@postgres:5432/easyconvert`（VPC 内服务名互访） |
| `REDIS_URL` / `CELERY_BROKER_URL` | `redis://redis:6379/0` |
| `CELERY_RESULT_BACKEND` | `redis://redis:6379/1` |
| `RESULT_DIR` | `/tmp/results` |
| `JWT_SECRET` | 随机长密钥 |
| `WECHAT_APPID` / `WECHAT_SECRET` | 第 1 步拿到的值 |
| `PADDLE_OCR_TOKEN` | PaddleOCR-VL 云服务凭据 |
| `SERVICE_MODE` | api 服务填 `api`；processor 填 `processor` |
| `PORT` | api 填 `8000`；processor 填 `8001` |

先建 postgres、redis、processor（无公网），再建 api（开启「公网访问」），api 首次启动自动执行 `alembic upgrade head`。

> 服务间互访依赖私有网络与服务名解析；若云托管当前不支持服务名 DNS，改用各服务的内网 IP，并同步改 `DATABASE_URL`/Redis 地址。

## 5. 小程序合法域名 → 提审上线

1. api 服务「公网访问」拿到域名：`https://xxx.sh.run.tcloudbase.com`（不要填控制台地址、不要带路径）。
2. 微信公众平台 → 「开发管理-开发设置-服务器域名」：
   - request 合法域名：`https://xxx.sh.run.tcloudbase.com`
   - uploadFile 合法域名：同上
   - downloadFile 合法域名：同上（或按云托管返回的对象存储下载域名，两者都要可用）
3. 小程序端重新构建注入正式地址：`TARO_APP_API_BASE=https://xxx.sh.run.tcloudbase.com npm run build:weapp`，微信开发者工具导入 `miniprogram/dist` → 上传体验版 → 真机全流程（登录/上传/转换/下载）。
4. 公众平台提交审核并**在 2026-10-17 前正式上线**；同时准备提报材料（AppID、小程序码、演示视频、作品说明：AI 文字识别 + 12 类文档转换）。

## 本地复现（可选）

```sh
docker compose -f deploy/cloudbase/docker-compose.cloudbase-ref.yml up --build
```

启动后 api 在 `http://127.0.0.1:8112`，与小程序本地联调（开发者工具关闭「不校验合法域名」即可）。它用 named volume 模拟 CFS，便于在正式推送镜像前自测。

## 成本与边界

- 基础套餐按量计费，单个小规格实例约 ¥几十/月量级；存储按 CFS 计费，<100MB 用量可忽略。
- 边界：默认域名频率限制（官方标注开发测试）；CFS 慢网络文件系统，不承担高频小文件；`/tmp` 被挂载后镜像内 `/tmp` 内容不可见（本应用无依赖）；LibreOffice 使镜像约 1.5GB，首次构建/拉取耗时属正常。
- API/Worker 同源镜像保证 `psycopg2`/`celery`/`sqlalchemy` 等共享依赖版本一致（两个 requirements 均为同一版本集），见 ADR0005。