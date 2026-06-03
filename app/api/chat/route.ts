import { streamText, convertToModelMessages } from "ai";
import { MODEL_REGISTRY, type ModelId } from "@/lib/models/registry";
import { requireAuth } from "@/lib/auth-middleware";
import { checkQuota, recordUsage } from "@/lib/quota";
import { calculateCost } from "@/lib/models/pricing";

// 流式聊天端点需运行在 Node 运行时（依赖数据库 / postgres-js 等）
export const runtime = "nodejs";
// 允许最长 60s 的流式响应（Vercel 函数超时上限）
export const maxDuration = 60;

export async function POST(req: Request) {
  // 1. 鉴权
  const session = await requireAuth();
  const userId = session.user.id;

  // 2. 解析请求体（messages 为前端 UI 消息格式）
  const { messages, modelId, conversationId } = await req.json();

  // 3. 校验模型 ID 是否在注册表中
  const entry = MODEL_REGISTRY[modelId as ModelId];
  if (!entry) {
    return Response.json(
      { error: { code: "UNKNOWN_MODEL", message: `未知模型：${modelId}` } },
      { status: 400 },
    );
  }

  // 4. 配额检查（按模型档位）；超额时返回 429
  try {
    await checkQuota(userId, entry.tier);
  } catch (error) {
    return Response.json(
      {
        error: {
          code: "QUOTA_EXCEEDED",
          message: (error as Error)?.message ?? "配额已用尽",
        },
      },
      { status: 429 },
    );
  }

  // 5. 启动流式生成
  const result = streamText({
    model: entry.model,
    // 将前端 UI 消息转换为模型消息格式（v5）
    messages: convertToModelMessages(messages),
    // 完成时记录用量与成本（异步，不阻塞流）
    onFinish: async ({ usage }) => {
      await recordUsage({
        userId,
        modelId,
        tokensInput: usage.inputTokens ?? 0,
        tokensOutput: usage.outputTokens ?? 0,
        costCents: calculateCost(modelId as ModelId, usage),
      });
    },
  });

  // 6. 返回 SSE 响应。
  // AI SDK v5 使用 toUIMessageStreamResponse()；v4 中等价别名为 toDataStreamResponse()。
  return result.toUIMessageStreamResponse();
}
