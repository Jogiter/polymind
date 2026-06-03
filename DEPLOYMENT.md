# PolyMind 部署与运维指南

面向 **中国大陆云**（阿里云 / 腾讯云）的生产部署文档。架构为 **Docker Compose + Nginx 反向代理**，应用以 Next.js 15 `output: "standalone"` 模式运行，监听 3000 端口，配套 PostgreSQL 16 与 Redis 7。

> 对应技术方案 v1.0 第 10.4 节「上线前置条件」与第 11 章「4 周路线图 · 第 4 周生产任务」。

---

## 1. 前置条件（务必先完成）

| # | 事项 | 说明 |
| --- | --- | --- |
| 1 | **ICP 备案** | 域名必须完成工信部 ICP 备案后才能解析到大陆服务器并开放 80/443，否则会被阻断。备案周期通常 7–20 个工作日，**请最早启动**。涉及交互信息服务的还需办理 **ICP 经营性许可证 / EDI**。 |
| 2 | **微信回调域名配置** | 在「微信开放平台 → 网站应用」中将 `授权回调域` 配置为生产域名（如 `polymind.example.com`，不带协议与路径）。该域名必须与 `BETTER_AUTH_URL` / `NEXT_PUBLIC_BASE_URL` 一致，否则扫码登录回调失败。 |
| 3 | **海外 API 代理** | Claude（Anthropic）与 Gemini（Google）在大陆**无法直连**。需自建/采购**海外网关**（香港或新加坡轻量服务器 + 反代），通过 `ANTHROPIC_PROXY_URL` / `GOOGLE_PROXY_URL` 注入 baseURL。DeepSeek、通义千问（DashScope）为境内服务可直连。 |
| 4 | **禁用 Vercel** | 不要部署到 Vercel —— 其边缘节点在大陆访问不稳定，且无法满足备案/合规要求。本项目按自托管 Docker 设计，CI 仅做构建与镜像推送。 |
| 5 | **UTC 时区统一** | 所有容器（app / db / redis）统一 `TZ=UTC`（见 `docker-compose.yml`），备份脚本亦使用 UTC 时间戳。避免账单结算、限流窗口、用量统计因跨时区产生偏差；展示层在前端按用户本地时区格式化。 |
| 6 | 内容安全 | 接入文本/图片**内容审核**（阿里云内容安全 / 腾讯云天御），对用户输入与模型输出做合规过滤，留存必要日志。 |

---

## 2. 基础设施清单

最小可用生产规模参考（可按量弹性扩缩）：

| 资源 | 规格 / 选型 | 用途 | 备注 |
| --- | --- | --- | --- |
| ECS | **2 核 4G × 2** | 应用层（app + nginx） | 双机 + SLB 负载均衡实现高可用；单机起步亦可 |
| RDS PostgreSQL | 2 核 4G，PG 16 | 主数据库 | **生产强烈建议用云 RDS** 替代自托管 `db` 容器（自动备份/高可用/只读副本） |
| Redis | 云数据库 Redis 1G | 会话 / 缓存 / 限流 | 替代自托管 `redis` 容器；开启持久化 |
| OSS / COS | 标准存储 | 用户上传图片、导出文件 | 配合 CDN 回源 |
| CDN | 全站加速 | 静态资源 `_next/static`、图片分发 | 需备案域名 |
| 海外网关 | 轻量 1 核 1G（HK/SG） | Claude / Gemini 代理出海 | 见前置条件 #3 |
| 域名 | 已 ICP 备案 | 主站 + 回调 | 微信回调域需一致 |
| SSL 证书 | Let's Encrypt 或云厂商证书 | TLS 终止 | 见第 6 节 |

> 若使用云 RDS / 云 Redis，则在 `.env` 中将 `DATABASE_URL` / `REDIS_URL` 指向云实例地址，并在 `docker-compose.yml` 中**移除或不启动** `db`、`redis` 服务。

---

## 3. 环境变量配置

```bash
# 复制模板并填入真实密钥
cp .env.example .env

# 生成 Better Auth 密钥（32 字节）
openssl rand -base64 32   # 填入 BETTER_AUTH_SECRET
```

关键变量核对：

- `DATABASE_URL`：自托管时 host 为服务名 `db`，如 `postgresql://polymind:<pwd>@db:5432/polymind`，并与 `POSTGRES_USER/PASSWORD/DB` **保持一致**。
- `REDIS_URL`：自托管时为 `redis://redis:6379`。
- `BETTER_AUTH_URL` / `NEXT_PUBLIC_BASE_URL`：生产域名 `https://polymind.example.com`，须与微信回调域一致。
- `ANTHROPIC_PROXY_URL` / `GOOGLE_PROXY_URL`：海外网关地址。
- `DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` / `DASHSCOPE_API_KEY`：各模型密钥。

> `.env` 含密钥，已在 `.dockerignore` / `.gitignore` 中排除，**切勿提交或打入镜像**，仅在运行时注入。

---

## 4. 构建与启动

```bash
# 构建镜像并后台启动全部服务
docker compose up -d --build

# 查看状态与日志
docker compose ps
docker compose logs -f app
docker compose logs -f nginx
```

服务拓扑：`nginx (80/443)` → `app (3000)` → `db (5432)` / `redis (6379)`，由 `nginx.conf` 完成 TLS 终止与 SSE 透传（`/api/chat` 关闭缓冲，token 级实时流）。

---

## 5. 数据库迁移

首次启动及每次发版后执行 schema 迁移（Drizzle）：

```bash
# 推荐：应用已生成的迁移文件
docker compose exec app npm run db:migrate

# 或开发/快速场景：直接推送 schema（无迁移历史）
docker compose exec app npm run db:push
```

> 使用云 RDS 时，迁移在 app 容器内执行即可（连接串指向 RDS）。建议先在预发环境验证迁移再上生产。

---

## 6. 申请 Let's Encrypt 证书

Nginx 期望证书位于 `./certs/`（容器内 `/etc/nginx/certs`，只读挂载）：

```bash
mkdir -p certs

# 方式一：webroot（不中断 nginx，依赖 nginx.conf 已放行 /.well-known/acme-challenge/）
docker run --rm \
  -v "$PWD/certs:/etc/letsencrypt" \
  -v "$PWD/certbot-www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d polymind.example.com --email admin@example.com --agree-tos -n

# 方式二：临时停 nginx 用 standalone 模式
docker compose stop nginx
docker run --rm -p 80:80 -v "$PWD/certs:/etc/letsencrypt" \
  certbot/certbot certonly --standalone -d polymind.example.com \
  --email admin@example.com --agree-tos -n
docker compose start nginx
```

将签发的 `fullchain.pem` / `privkey.pem` 软链或拷贝到 `./certs/` 根目录（`nginx.conf` 引用 `/etc/nginx/certs/fullchain.pem`、`privkey.pem`），随后 `docker compose exec nginx nginx -s reload` 生效。

> 大陆合规场景也可改用**云厂商 SSL 证书**（阿里云/腾讯云免费 DV 证书），下载 Nginx 格式后放入 `./certs/` 即可。证书续期建议加入 cron（Let's Encrypt 90 天有效期）。

---

## 7. 备份与运维

```bash
# 手动备份（pg_dump → 带时间戳 gzip，保留 7 天）
./scripts/backup.sh

# 容器内直连备份（自托管 db）
docker compose exec -T db pg_dump -U polymind polymind | gzip > backups/manual.sql.gz

# cron：每日 03:00（UTC）自动备份
0 3 * * * cd /opt/polymind && ./scripts/backup.sh >> /var/log/polymind-backup.log 2>&1
```

- 使用云 RDS 时优先依赖其**自动备份 + 时间点恢复**，本脚本作为离站冗余。
- 监控：接入 `SENTRY_DSN` 做错误追踪；可对接云监控对 ECS/RDS/Redis 做指标告警。

---

## 8. 上线检查清单（路线图 · 第 4 周）

第 4 周聚焦「**生产化与上线**」，按序完成：

- [ ] ICP 备案通过，域名解析到 ECS / SLB
- [ ] `.env` 全部密钥就位，`BETTER_AUTH_URL` 与微信回调域一致
- [ ] 海外网关（Claude / Gemini 代理）连通性验证
- [ ] `docker compose up -d --build` 全服务健康（`docker compose ps`）
- [ ] `db:migrate` 迁移执行成功，表结构与索引就绪
- [ ] Let's Encrypt / 云证书签发，HTTPS 正常，HTTP 自动 301
- [ ] SSE 流式验证：`/api/chat` token 级实时输出无缓冲卡顿
- [ ] 四模型（DeepSeek / Claude / Gemini / Qwen）联调通过
- [ ] 限流 / 配额生效（IP + 用户双维度）
- [ ] 内容审核接入，图片上传与多模态链路验证
- [ ] 备份 cron 落地，Sentry 告警接入
- [ ] 压测与回滚预案，灰度上线

---

## 9. 常用运维命令

```bash
docker compose up -d --build        # 发版（重建并滚动启动）
docker compose restart app          # 重启应用
docker compose logs -f --tail=200 app
docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload  # 校验并热加载 nginx
docker compose down                 # 停止（保留数据卷 / pgdata）
```
