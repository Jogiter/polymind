# syntax=docker/dockerfile:1

# ============================================================================
# PolyMind 多阶段构建 Dockerfile
# Next.js 15 (output: "standalone") + Node 20 Alpine
# ============================================================================

# ---------------------------------------------------------------------------
# Stage 1: deps —— 仅安装生产 + 构建所需依赖（利用 layer 缓存）
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
# Next.js standalone 在 Alpine 上需要 libc6-compat
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 仅拷贝依赖清单，最大化利用构建缓存
COPY package.json package-lock.json* ./

# 有 lockfile 用 npm ci（可复现），否则回退到 npm install
RUN if [ -f package-lock.json ]; then \
      npm ci; \
    else \
      echo "WARN: package-lock.json 不存在，使用 npm install" && npm install; \
    fi

# ---------------------------------------------------------------------------
# Stage 2: builder —— 编译 Next.js，产出 .next/standalone
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# 关闭遥测，加速且避免外网请求（国内网络）
ENV NEXT_TELEMETRY_DISABLED=1

# 复用 deps 阶段的 node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: runner —— 最小运行时镜像，非 root 运行
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# public 静态资源
COPY --from=builder /app/public ./public

# standalone 输出（含精简后的 node_modules + server.js）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# .next/static 必须单独拷贝到 standalone 内部对应路径
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# standalone 模式入口为 server.js
CMD ["node", "server.js"]
