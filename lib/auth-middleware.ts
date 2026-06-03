// 服务端认证中间件 —— 在 Route Handler / Server Action 中校验登录态。
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// 强制要求登录：无会话时直接抛出 401 Response（可被 Next.js 直接返回给前端）。
// 返回的 session 中可通过 session.user.id 读取当前用户 ID。
export async function requireAuth() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return session;
}

// 非抛出版本：返回会话或 null，供「可选登录」场景使用。
export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}
