import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversation } from "@/lib/db/schema";
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

// GET /api/conversations —— 列出当前用户未删除的会话，按更新时间倒序
export async function GET() {
  const session = await requireAuth();

  const rows = await db
    .select({
      id: conversation.id,
      title: conversation.title,
      model: conversation.model,
      updatedAt: conversation.updatedAt,
    })
    .from(conversation)
    .where(
      and(
        eq(conversation.userId, session.user.id),
        isNull(conversation.deletedAt),
      ),
    )
    .orderBy(desc(conversation.updatedAt));

  return NextResponse.json(rows);
}

// POST /api/conversations —— 新建会话
export async function POST(req: Request) {
  const session = await requireAuth();

  let body: { title?: string; model?: string; systemPrompt?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("INVALID_BODY", "请求体不是合法的 JSON", 400);
  }

  // model 为必填项
  if (!body?.model || typeof body.model !== "string") {
    return errorResponse(
      "VALIDATION_ERROR",
      "缺少必填字段 model",
      400,
      { field: "model" },
    );
  }

  const [created] = await db
    .insert(conversation)
    .values({
      userId: session.user.id,
      title: body.title ?? null,
      model: body.model,
      systemPrompt: body.systemPrompt ?? null,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
