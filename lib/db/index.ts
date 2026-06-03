import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

// 合并业务表与认证表，统一传给 drizzle 以支持关系查询
const combinedSchema = { ...schema, ...authSchema };

// 连接字符串
const connectionString = process.env.DATABASE_URL!;

// 开发环境下使用 globalThis 缓存连接，避免 Next.js 热重载耗尽数据库连接
const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
};

const client =
  globalForDb.client ?? postgres(connectionString, { prepare: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
}

// drizzle 实例（单例）
export const db = drizzle(client, { schema: combinedSchema });

// 重新导出全部 schema，方便上层 `import { conversation } from "@/lib/db"`
export * from "./schema";
export * from "./auth-schema";
