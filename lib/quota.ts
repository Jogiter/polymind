import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { usageQuota } from "@/lib/db/schema";
import { redis } from "@/lib/redis";
import { MODEL_REGISTRY, type ModelId } from "@/lib/models/registry";

// ============ 类型与档位矩阵 ============

// 用户订阅档位
export type UserTier = "free" | "pro" | "enterprise";
// 模型档位（来自模型注册表）
export type ModelTier = "free" | "pro" | "premium";

// 每日请求次数限制：
//   number  -> 该 (用户档, 模型档) 组合的每日次数上限
//   "unlimited" -> 无限制（不计数）
//   "forbidden" -> 禁止访问（直接抛 QuotaError）
type QuotaRule = number | "unlimited" | "forbidden";

// 配额矩阵：用户档位 × 模型档位
// - 免费注册（free）：免费模型无限制；专业模型 20 次/天；高级模型禁止
// - 专业订阅（pro）：免费、专业模型无限制；高级模型 50 次/天
// - 企业版（enterprise）：全部无限制
const QUOTA_MATRIX: Record<UserTier, Record<ModelTier, QuotaRule>> = {
  free: {
    free: "unlimited",
    pro: 20,
    premium: "forbidden",
  },
  pro: {
    free: "unlimited",
    pro: "unlimited",
    premium: 50,
  },
  enterprise: {
    free: "unlimited",
    pro: "unlimited",
    premium: "unlimited",
  },
};

// ============ 配额错误 ============

// 超出配额时抛出：携带 429 状态码与下一次重置时间（UTC 次日零点）
export class QuotaError extends Error {
  readonly code = "QUOTA_EXCEEDED" as const;
  readonly status = 429;
  readonly resetAt: string;

  constructor(message: string, resetAt: string) {
    super(message);
    this.name = "QuotaError";
    this.resetAt = resetAt;
  }
}

// ============ 工具函数 ============

// 获取用户订阅档位。
// TODO: read from subscription table —— 当前默认全部视为免费档。
// 后续可在此查询订阅表 / 缓存，返回对应 UserTier。
export async function getUserTier(_userId: string): Promise<UserTier> {
  return "free";
}

// 当天 UTC 日期键，形如 2026-06-03
function utcDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

// 当月 UTC 月份起始日，形如 2026-06-01
function utcMonthStart(now: Date): string {
  return `${now.toISOString().slice(0, 7)}-01`;
}

// 下一个 UTC 零点（用于配额重置时间与计数器 TTL）
function nextUtcMidnight(now: Date): Date {
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
  return next;
}

// ============ 配额检查 ============

// 在发起模型调用前校验配额。
// - forbidden  -> 抛 QuotaError
// - unlimited  -> 直接放行
// - number     -> Redis INCR 计数；超限则 DECR 回滚并抛 QuotaError
export async function checkQuota(
  userId: string,
  modelTier: string,
): Promise<void> {
  const userTier = await getUserTier(userId);
  const tier = (modelTier as ModelTier) ?? "free";
  const rule = QUOTA_MATRIX[userTier]?.[tier] ?? "forbidden";

  const now = new Date();
  const resetAt = nextUtcMidnight(now).toISOString();

  // 禁止访问该档位模型
  if (rule === "forbidden") {
    throw new QuotaError(
      `当前订阅（${userTier}）无权使用 ${tier} 档位模型`,
      resetAt,
    );
  }

  // 无限制：无需计数
  if (rule === "unlimited") {
    return;
  }

  // 有限次数：用 Redis 计数器实现每日配额
  const key = `quota:${userId}:${tier}:${utcDayKey(now)}`;
  const count = await redis.incr(key);

  // 第一次创建该键时设置 TTL，使其在 UTC 次日零点自动过期
  if (count === 1) {
    const ttlSeconds = Math.max(
      1,
      Math.ceil((nextUtcMidnight(now).getTime() - now.getTime()) / 1000),
    );
    await redis.expire(key, ttlSeconds);
  }

  // 超出每日上限：回滚本次自增并抛错
  if (count > rule) {
    await redis.decr(key);
    throw new QuotaError(
      `已达到 ${tier} 档位模型的每日上限（${rule} 次/天）`,
      resetAt,
    );
  }
}

// ============ 用量记录 ============

interface RecordUsageInput {
  userId: string;
  modelId: string;
  tokensInput: number;
  tokensOutput: number;
  costCents: number;
}

// 记录一次调用的 token 用量，按「日 / 月」两个周期累加进 usage_quota 表。
// 该函数在流式响应的 onFinish 中调用 —— 绝不能抛出异常打断流，
// 因此内部捕获所有错误并仅记录日志。
export async function recordUsage({
  userId,
  modelId,
  tokensInput,
  tokensOutput,
  costCents: _costCents,
}: RecordUsageInput): Promise<void> {
  try {
    // 从注册表查模型档位以归类用量；未知模型回退到 free 档
    const entry = MODEL_REGISTRY[modelId as ModelId];
    const modelTier = (entry?.tier as ModelTier) ?? "free";

    const totalTokens = (tokensInput ?? 0) + (tokensOutput ?? 0);
    if (totalTokens <= 0) return;

    const now = new Date();
    const dayStart = utcDayKey(now);
    const monthStart = utcMonthStart(now);

    // 日 + 月两条记录：存在则累加 usedTokens，不存在则插入
    const rows = [
      {
        userId,
        period: "daily",
        periodStart: dayStart,
        modelTier,
        usedTokens: totalTokens,
        // limitTokens 由后续配额方案细化；此处用 0 占位（次数限制在 Redis 侧）
        limitTokens: 0,
      },
      {
        userId,
        period: "monthly",
        periodStart: monthStart,
        modelTier,
        usedTokens: totalTokens,
        limitTokens: 0,
      },
    ];

    for (const row of rows) {
      await db
        .insert(usageQuota)
        .values(row)
        .onConflictDoUpdate({
          target: [
            usageQuota.userId,
            usageQuota.period,
            usageQuota.periodStart,
            usageQuota.modelTier,
          ],
          set: {
            // 在已有值上累加本次 token
            usedTokens: sql`${usageQuota.usedTokens} + ${totalTokens}`,
          },
        });
    }
  } catch (err) {
    // 用量记录失败不应影响主流程（流式输出已结束），仅记录日志
    console.error("[recordUsage] 写入用量失败:", err);
  }
}
