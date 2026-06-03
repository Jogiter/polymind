// Better Auth 配置 —— 全应用认证的唯一真实来源（single source of truth）。
// 这里统一配置：数据库适配器、会话策略、邮箱密码登录、社交登录、以及自研微信扫码插件。

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import { wechatPlugin } from "@/lib/auth-plugins/wechat";

export const auth = betterAuth({
  // 应用密钥与基础 URL（来自环境变量）
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  // 使用 Drizzle 适配器，底层为 PostgreSQL
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  // 会话策略：30 天过期，每天滚动续期；并启用 5 分钟的 Cookie 缓存以减少 DB 查询
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 天
    updateAge: 60 * 60 * 24, // 1 天（活跃时滚动续期）
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 分钟
    },
  },

  // 邮箱 + 密码登录，要求邮箱验证
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  // 社交登录：GitHub 与 Google，凭证从环境变量读取
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  // 自研插件：微信扫码登录（不遵循标准 OAuth，需单独处理）
  plugins: [
    wechatPlugin({
      appId: process.env.WECHAT_APP_ID!,
      appSecret: process.env.WECHAT_APP_SECRET!,
    }),
  ],
});

// 导出会话类型，供中间件 / 服务端组件做类型推断
export type Session = typeof auth.$Infer.Session;
