import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

// 双维度限流：
// - IP 维度：抵御匿名爆破 / 扫描（10 秒内 20 次）
// - 用户维度：约束已登录用户的突发请求（1 分钟内 30 次）
export const ipLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "10 s"),
  prefix: "ratelimit:ip",
});

export const userLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "ratelimit:user",
});

// 限流执行助手：命中限流时抛出标准 429 Response（含 Retry-After 头）。
// 调用方在路由中 try/catch 时若捕获到 Response 实例可直接返回。
export async function enforceRateLimit(
  limiter: Ratelimit,
  key: string,
): Promise<void> {
  const { success, limit, remaining, reset } = await limiter.limit(key);
  if (!success) {
    // reset 为毫秒时间戳，换算成 Retry-After 秒数
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((reset - Date.now()) / 1000),
    );
    throw new Response(
      JSON.stringify({
        error: {
          code: "RATE_LIMITED",
          message: "请求过于频繁，请稍后再试",
          details: { limit, remaining, reset },
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
        },
      },
    );
  }
}
