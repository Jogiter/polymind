import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // better-auth 内置打包了 kysely-adapter（我们用的是 Drizzle 适配器，
  // 运行时并不需要 kysely），让 Node 原生解析这些包以避免 webpack 解析其内部导出失败。
  serverExternalPackages: ["postgres", "@better-auth/kysely-adapter", "kysely"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
