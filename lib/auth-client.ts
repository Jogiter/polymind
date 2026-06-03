// 客户端认证实例 —— 供 React 组件调用（signIn / signUp / useSession 等）。
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
});
