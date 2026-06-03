import type { LanguageModelMiddleware } from "ai";

// ============ 生产级故障转移中间件 ============
// 当主模型调用失败（如上游 429 限流、502 网关错误、临时不可用）时，
// 自动改用备用模型重试，从而提升对话服务的可用性与韧性。
// 注意：备用模型的定价 / 档位可能不同，计费应以最终生效的模型为准
// （上层可在 onFinish 中读取实际响应来源做修正）。
//
// AI SDK v5 的中间件类型为 LanguageModelV2Middleware，可与
// wrapLanguageModel({ model, middleware }) 配合使用。由于 v5 中各
// 内部类型仍可能微调，这里在必要处使用 any 以保证编译稳定，但严格保留契约。

interface FallbackOptions {
  // 备用模型实例（即 MODEL_REGISTRY 中某条目的 model）
  fallback: any;
}

export function fallbackMiddleware({
  fallback,
}: FallbackOptions): LanguageModelMiddleware {
  return {
    // 包装非流式生成
    wrapGenerate: async ({ doGenerate, params }: any) => {
      try {
        return await doGenerate();
      } catch (error) {
        // 主模型失败，降级到备用模型重试一次
        console.warn(
          "[fallbackMiddleware] 主模型生成失败，切换备用模型：",
          (error as Error)?.message,
        );
        return await fallback.doGenerate(params);
      }
    },

    // 包装流式生成
    wrapStream: async ({ doStream, params }: any) => {
      try {
        return await doStream();
      } catch (error) {
        // 流式建立阶段失败时降级（注意：已开始的流中途出错无法在此回滚）
        console.warn(
          "[fallbackMiddleware] 主模型流式失败，切换备用模型：",
          (error as Error)?.message,
        );
        return await fallback.doStream(params);
      }
    },
  };
}
