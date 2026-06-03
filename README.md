# PolyMind · 多模型 AI 对话平台

面向 C 端的多模型 AI 对话平台。用户可在 **DeepSeek / Claude / Gemini / Qwen** 之间自由切换，支持 **微信扫码 / 邮箱密码 / GitHub** 等多种登录方式，全链路 SSE 流式输出。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端框架 | Next.js 15（App Router / RSC） |
| UI | Tailwind CSS 4 + shadcn/ui |
| 状态管理 | Zustand + TanStack Query |
| AI SDK | Vercel AI SDK 5 |
| 认证 | Better Auth 1.x |
| 数据库 | PostgreSQL 16 + Drizzle ORM |
| 缓存/限流 | Redis 7 + Upstash Ratelimit |
| 部署 | Docker + Nginx |

## 快速开始

```bash
cp .env.example .env.local   # 填入各项密钥
pnpm install                 # 或 npm install
pnpm db:push                 # 推送 schema 到数据库
pnpm dev                     # http://localhost:3000
```

## 目录结构

```
app/            页面与 API 路由（App Router）
  (auth)/       登录注册页
  (chat)/       主应用
  api/          REST + SSE 端点
components/     UI / chat / sidebar 组件
lib/            auth / db / models / quota 等核心逻辑
```

详见 `TASKS.md`（任务拆解）与 `DEPLOYMENT.md`（部署）。
