import { NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversation, message } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-middleware";

// 统一错误响应格式
function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json(
    { error: { code, message, details } },
    { status },
  );
}

// Next.js 15：动态路由 params 为 Promise，需 await 解构
type RouteContext = { params: Promise<{ id: string }> };

// GET /api/conversations/[id] —— 返回会话详情及其全部消息（按时间升序）
export async function GET(_req: Request, { params }: RouteContext) {
  const session = await requireAuth();
  const { id } = await params;

  // 校验归属：必须属于当前用户且未被软删除
  const [conv] = await db
    .select()
    .from(conversation)
    .where(
      and(
        eq(conversation.id, id),
        eq(conversation.userId, session.user.id),
        isNull(conversation.deletedAt),
      ),
    )
    .limit(1);

  if (!conv) {
    return errorResponse("NOT_FOUND", "会话不存在或无权访问", 404);
  }

  const messages = await db
    .select()
    .from(message)
    .where(eq(message.conversationId, id))
    .orderBy(asc(message.createdAt));

  return NextResponse.json({ ...conv, messages });
}

// DELETE /api/conversations/[id] —— 软删除（置 deletedAt = now）
export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await requireAuth();
  const { id } = await params;

  // 仅当会话属于当前用户且尚未删除时才更新；返回受影响行用于判断 404
  const updated = await db
    .update(conversation)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(conversation.id, id),
        eq(conversation.userId, session.user.id),
        isNull(conversation.deletedAt),
      ),
    )
    .returning({ id: conversation.id });

  if (updated.length === 0) {
    return errorResponse("NOT_FOUND", "会话不存在或无权访问", 404);
  }

  return NextResponse.json({ ok: true });
}
