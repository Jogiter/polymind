import { Redis } from "@upstash/redis";

// Redis 客户端（单例）——用于限流计数与配额每日计数器。
// 优先使用 Upstash REST（Serverless 友好，适配 Edge / Node 运行时）；
// 当未配置 Upstash 时，回退到标准 REDIS_URL 构造（本地开发场景）。
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedis(): Redis {
  // 已配置 Upstash REST：直接从环境变量读取 URL + TOKEN
  if (process.env.UPSTASH_REDIS_REST_URL) {
    return Redis.fromEnv();
  }

  // 回退：从 REDIS_URL 解析出 host / 凭证，走 Upstash REST 协议。
  // 注意：本地原生 redis:// 需配合兼容代理；此处保证类型与接口一致。
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "缺少 Redis 配置：请设置 UPSTASH_REDIS_REST_URL 或 REDIS_URL",
    );
  }
  return new Redis({
    url,
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  });
}

// 开发环境下缓存到 globalThis，避免热重载反复创建连接
export const redis = globalForRedis.redis ?? createRedis();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
