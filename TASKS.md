# PolyMind 多模型 AI 对话平台 — 任务清单

基于技术方案文档 v1.0 拆解的实现任务。Next.js 15 + Better Auth + Vercel AI SDK + Drizzle + PostgreSQL。

## 执行策略

主 agent 先搭建项目骨架与共享配置，随后并发派发 6 个子 agent，每个 agent 负责互不重叠的文件集合，避免写冲突。

---

## Task 0 — 项目骨架（主 agent）

- [x] `package.json` 依赖与脚本
- [x] `tsconfig.json` / `next.config.ts` / `postcss` / `tailwind`
- [x] `drizzle.config.ts`
- [x] `app/layout.tsx` / `app/globals.css`
- [x] `.env.example` / `.gitignore` / `README.md`

## Task A — 数据层（子 agent）

- [x] `lib/db/index.ts` — Drizzle + postgres 连接
- [x] `lib/db/schema.ts` — 业务表 conversation / message / usage_quota
- [x] `lib/db/auth-schema.ts` — Better Auth 管理表 user / session / account / verification
- [x] 索引定义（user.email、session.token、account 复合、conversation、message）

## Task B — 认证层（子 agent）

- [x] `lib/auth.ts` — Better Auth 配置（邮箱密码 + GitHub/Google + 插件）
- [x] `lib/auth-plugins/wechat.ts` — 微信扫码登录插件（unionid 关联）
- [x] `lib/auth-client.ts` — 前端 client
- [x] `lib/auth-middleware.ts` — requireAuth 鉴权
- [x] `app/api/auth/[...all]/route.ts` — Better Auth 路由挂载
- [x] `app/(auth)/sign-in/page.tsx` / `app/(auth)/sign-up/page.tsx`

## Task C — 模型抽象层（子 agent）

- [x] `lib/models/registry.ts` — MODEL_REGISTRY 注册表
- [x] `lib/models/pricing.ts` — 成本计算
- [x] `lib/models/middleware/fallback.ts` — 故障转移中间件
- [x] `app/api/chat/route.ts` — 流式对话端点
- [x] `app/api/models/route.ts` — 模型列表端点

## Task D — 配额 / 限流 / 会话 API（子 agent）

- [x] `lib/redis.ts` — Redis 连接
- [x] `lib/ratelimit.ts` — IP + 用户双维度限流
- [x] `lib/quota.ts` — 配额检查与用量记录
- [x] `app/api/conversations/route.ts` — 列表 / 新建
- [x] `app/api/conversations/[id]/route.ts` — 详情 / 删除
- [x] `app/api/usage/route.ts` — 用量查询

## Task E — 前端（子 agent）

- [x] `lib/utils.ts` — cn 等工具
- [x] `lib/store.ts` — Zustand
- [x] `components/ui/*` — shadcn 基础组件
- [x] `components/chat/*` — 消息列表 / 输入框 / 模型选择器 / 流式消息
- [x] `components/sidebar/*` — 会话列表 / 用户菜单
- [x] `app/(chat)/*` — 布局与会话页
- [x] `app/providers.tsx` — React Query Provider

## Task F — 部署（子 agent）

- [x] `Dockerfile` / `.dockerignore`
- [x] `docker-compose.yml`
- [x] `nginx.conf`
- [x] `scripts/backup.sh`
- [x] `DEPLOYMENT.md`
