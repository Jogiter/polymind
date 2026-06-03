import { MODEL_REGISTRY, type ModelId } from "@/lib/models/registry";

// AI SDK 在不同版本中 usage 字段命名不一致：
// - v5：inputTokens / outputTokens
// - v4 及更早：promptTokens / completionTokens
// 这里同时兼容两套命名，避免计费在升级时静默归零。
export interface UsageLike {
  promptTokens?: number;
  completionTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * 计算单次调用成本（单位：分 / cents，整数）。
 * 定价取自 MODEL_REGISTRY，单位为 $ / 1M tokens。
 * 公式：(inputTokens/1e6)*input + (outputTokens/1e6)*output → 美元 → 分。
 */
export function calculateCost(modelId: ModelId, usage: UsageLike): number {
  const entry = MODEL_REGISTRY[modelId];
  if (!entry) return 0;

  const { input, output } = entry.pricing;

  // 兼容 v5（inputTokens）与 v4（promptTokens）两种字段名
  const inputTokens = usage.inputTokens ?? usage.promptTokens ?? 0;
  const outputTokens = usage.outputTokens ?? usage.completionTokens ?? 0;

  const dollars =
    (inputTokens / 1_000_000) * input + (outputTokens / 1_000_000) * output;

  // 美元转分，四舍五入为整数（数据库 cost_cents 为 integer）
  return Math.round(dollars * 100);
}
