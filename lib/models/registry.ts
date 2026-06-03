import { createDeepSeek } from "@ai-sdk/deepseek";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";

// ============ 提供商工厂 ============
// 每个工厂通过环境变量注入密钥；部分提供商支持自建反向代理（baseURL），
// 用于在国内网络环境下加速 / 规避直连问题。

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // 可选：通过代理转发 Anthropic 请求（生产环境常用）
  baseURL: process.env.ANTHROPIC_PROXY_URL || undefined,
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  // 可选：Gemini 代理地址
  baseURL: process.env.GOOGLE_PROXY_URL || undefined,
});

// 通义千问（Qwen）走阿里云 DashScope 的 OpenAI 兼容端点
const qwen = createOpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

// ============ 模型注册表 ============
// 单一可信源：模型实例、展示名、档位、定价（$/1M tokens）、能力、上下文窗口。
// 使用 `as const` 以便从 key 推导出 ModelId 字面量联合类型。
export const MODEL_REGISTRY = {
  "deepseek-chat": {
    model: deepseek("deepseek-chat"),
    label: "DeepSeek V3",
    tier: "free",
    pricing: { input: 0.27, output: 1.1 },
    capabilities: ["text"],
    contextWindow: 64000,
  },
  "deepseek-reasoner": {
    model: deepseek("deepseek-reasoner"),
    label: "DeepSeek R1（推理）",
    tier: "pro",
    pricing: { input: 0.55, output: 2.19 },
    capabilities: ["text", "reasoning"],
    contextWindow: 64000,
  },
  "claude-opus-4-7": {
    model: anthropic("claude-opus-4-7"),
    label: "Claude Opus 4.7",
    tier: "premium",
    pricing: { input: 15, output: 75 },
    capabilities: ["text", "vision", "tools"],
    contextWindow: 200000,
  },
  "gemini-2.5-pro": {
    model: google("gemini-2.5-pro"),
    label: "Gemini 2.5 Pro",
    tier: "premium",
    pricing: { input: 1.25, output: 10 },
    capabilities: ["text", "vision", "audio"],
    contextWindow: 1000000,
  },
  "qwen3-max": {
    model: qwen("qwen3-max"),
    label: "通义千问 3 Max",
    tier: "pro",
    pricing: { input: 2.4, output: 9.6 },
    capabilities: ["text", "vision"],
    contextWindow: 32000,
  },
} as const;

// 从注册表 key 推导模型 ID 联合类型
export type ModelId = keyof typeof MODEL_REGISTRY;

// 对外公开的安全视图：仅暴露前端展示所需字段，
// 绝不泄露 `model` 实例或任何密钥信息。
export interface PublicModel {
  id: ModelId;
  label: string;
  tier: string;
  capabilities: readonly string[];
  contextWindow: number;
}

// 供 /api/models 端点使用：返回可序列化、无敏感信息的模型清单。
export function listPublicModels(): PublicModel[] {
  return (Object.keys(MODEL_REGISTRY) as ModelId[]).map((id) => {
    const entry = MODEL_REGISTRY[id];
    return {
      id,
      label: entry.label,
      tier: entry.tier,
      capabilities: entry.capabilities,
      contextWindow: entry.contextWindow,
    };
  });
}
