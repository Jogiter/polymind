import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
  date,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

// ============ 业务表 ============

// 会话（对话）表
export const conversation = pgTable(
  "conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title"),
    model: text("model").notNull(),
    systemPrompt: text("system_prompt"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // 软删除：非空表示已删除
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  // 按用户 + 最近更新时间倒序，用于侧边栏会话列表
  (t) => [
    index("conversation_user_updated_idx").on(
      t.userId,
      t.updatedAt.desc(),
    ),
  ],
);

// 消息表
export const message = pgTable(
  "message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    // 角色：'user' | 'assistant' | 'system'
    role: text("role").notNull(),
    // 多模态内容结构（文本、图片、文件等）
    content: jsonb("content").notNull(),
    model: text("model"),
    tokensInput: integer("tokens_input"),
    tokensOutput: integer("tokens_output"),
    costCents: integer("cost_cents"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // 按会话 + 创建时间，用于按序加载消息
  (t) => [
    index("message_conversation_created_idx").on(
      t.conversationId,
      t.createdAt,
    ),
  ],
);

// 用量配额表（按周期 + 模型档位计量）
export const usageQuota = pgTable(
  "usage_quota",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // 周期：'daily' | 'monthly'
    period: text("period").notNull(),
    periodStart: date("period_start").notNull(),
    // 模型档位：'free' | 'pro' | 'premium'
    modelTier: text("model_tier").notNull(),
    usedTokens: integer("used_tokens").notNull().default(0),
    limitTokens: integer("limit_tokens").notNull(),
  },
  // 复合主键：唯一确定一条配额记录
  (t) => [
    primaryKey({
      columns: [t.userId, t.period, t.periodStart, t.modelTier],
    }),
  ],
);

// ============ 推断类型 ============

export type Conversation = typeof conversation.$inferSelect;
export type NewConversation = typeof conversation.$inferInsert;

export type Message = typeof message.$inferSelect;
export type NewMessage = typeof message.$inferInsert;

export type UsageQuota = typeof usageQuota.$inferSelect;
export type NewUsageQuota = typeof usageQuota.$inferInsert;
