// Better Auth 的 catch-all 路由处理器 —— 挂载所有认证相关端点（含微信插件端点）。
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
