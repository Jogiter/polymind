import { listPublicModels } from "@/lib/models/registry";
import { requireAuth } from "@/lib/auth-middleware";

export const runtime = "nodejs";

// GET /api/models —— 返回当前可用模型清单（无密钥、无模型实例）。
// `locked` 字段预留给前端 / 配额层做档位门禁，这里统一置为 false，
// 真正的解锁逻辑由配额 agent 与前端根据用户档位决定。
export async function GET() {
  await requireAuth();

  const models = listPublicModels().map((m) => ({
    ...m,
    locked: false,
  }));

  return Response.json({ models });
}
