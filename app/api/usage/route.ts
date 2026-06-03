import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { usageQuota } from "@/lib/db/schema";
import { redis } from "@/lib/redis";
import { requireAuth } from "@/lib/auth-middleware";
import { getUserTier } from "@/lib/quota";

// 模型档位枚举（与配额矩阵保持一致）
const MODEL_TIERS = ["free", "pro", "premium"] as const;

// UTC 当日 / 当月起始日期键
function utcDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}
function utcMonthStart(now: Date): string {
  return `${now.toISOString().slice(0, 7)}-01`;
}

// GET /api/usage —— 返回当前用户的每日 / 每月用量与限额
export async function GET() {
  const session = await requireAuth();
  const userId = session.user.id;
  const userTier = await getUserTier(userId);

  const now = new Date();
  const dayStart = utcDayKey(now);
  const monthStart = utcMonthStart(now);

  // 从 usage_quota 表读取本用户当日 + 当月的所有档位 token 用量
  const [dailyRows, monthlyRows] = await Promise.all([
    db
      .select()
      .from(usageQuota)
      .where(
        and(
          eq(usageQuota.userId, userId),
          eq(usageQuota.period, "daily"),
          eq(usageQuota.periodStart, dayStart),
        ),
      ),
    db
      .select()
      .from(usageQuota)
      .where(
        and(
          eq(usageQuota.userId, userId),
          eq(usageQuota.period, "monthly"),
          eq(usageQuota.periodStart, monthStart),
        ),
      ),
  ]);

  // 将每档位的 token 用量聚合成对象：{ free, pro, premium }
  const toTierMap = (
    rows: { modelTier: string; usedTokens: number; limitTokens: number }[],
  ) => {
    const map: Record<
      string,
      { usedTokens: number; limitTokens: number }
    > = {};
    for (const tier of MODEL_TIERS) {
      map[tier] = { usedTokens: 0, limitTokens: 0 };
    }
    for (const r of rows) {
      map[r.modelTier] = {
        usedTokens: r.usedTokens,
        limitTokens: r.limitTokens,
      };
    }
    return map;
  };

  // 读取 Redis 中各档位「每日请求次数」计数器（次数限额配额）
  const requestKeys = MODEL_TIERS.map(
    (tier) => `quota:${userId}:${tier}:${dayStart}`,
  );
  const requestCounts = await redis.mget<(number | null)[]>(...requestKeys);
  const dailyRequests: Record<string, number> = {};
  MODEL_TIERS.forEach((tier, i) => {
    dailyRequests[tier] = Number(requestCounts?.[i] ?? 0);
  });

  return NextResponse.json({
    userTier,
    daily: {
      periodStart: dayStart,
      tokens: toTierMap(dailyRows),
      requests: dailyRequests,
    },
    monthly: {
      periodStart: monthStart,
      tokens: toTierMap(monthlyRows),
    },
  });
}
