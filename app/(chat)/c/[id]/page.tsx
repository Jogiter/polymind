"use client";

import { use, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import { ModelSelector } from "@/components/chat/model-selector";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { useUIStore } from "@/lib/store";

// 已持久化消息的最简形态：content 为 JSONB，可能是字符串或 parts 数组。
interface StoredMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: unknown;
}

interface ConversationDetail {
  id: string;
  title: string | null;
  model: string;
  messages: StoredMessage[];
}

// 将后端存储的消息转换为 AI SDK v5 的 UI 消息（parts 结构）。
function toUIMessage(m: StoredMessage) {
  let text = "";
  if (typeof m.content === "string") {
    text = m.content;
  } else if (Array.isArray(m.content)) {
    text = (m.content as { type?: string; text?: string }[])
      .filter((p) => p?.type === "text" && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
  } else if (
    m.content &&
    typeof m.content === "object" &&
    "text" in (m.content as Record<string, unknown>)
  ) {
    text = String((m.content as { text?: unknown }).text ?? "");
  }
  return {
    id: m.id,
    role: m.role,
    parts: [{ type: "text" as const, text }],
  };
}

async function fetchConversation(id: string): Promise<ConversationDetail> {
  const res = await fetch(`/api/conversations/${id}`);
  if (!res.ok) throw new Error("加载会话失败");
  return res.json();
}

export default function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Next.js 15：params 为 Promise，用 React.use 解包。
  const { id } = use(params);

  const modelId = useUIStore((s) => s.modelId);
  const setModelId = useUIStore((s) => s.setModelId);

  // 加载历史消息以填充初始对话。
  const { data: conversation } = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => fetchConversation(id),
  });

  const initialMessages = useMemo(
    () => (conversation?.messages ?? []).map(toUIMessage),
    [conversation],
  );

  // NOTE: AI SDK v5 (@ai-sdk/react v2) 的 useChat 通过 transport 配置请求，
  // 返回 { messages, sendMessage, status, setMessages }。请根据实际安装版本核对
  // DefaultChatTransport 的导入来源（"ai"）与字段命名。
  const { messages, sendMessage, status, setMessages } = useChat({
    id,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { modelId, conversationId: id },
    }),
  });

  // 历史消息加载完成后注入（仅当当前为空，避免覆盖进行中的对话）。
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (initialMessages.length > 0) {
      setMessages(initialMessages as never);
      hydratedRef.current = true;
    }
  }, [initialMessages, setMessages]);

  // 从落地页跳转携带的首条消息：自动发送一次。
  const pendingSentRef = useRef(false);
  useEffect(() => {
    if (pendingSentRef.current) return;
    const key = `polymind:pending:${id}`;
    const pending = sessionStorage.getItem(key);
    if (pending) {
      pendingSentRef.current = true;
      sessionStorage.removeItem(key);
      sendMessage({ text: pending });
    }
  }, [id, sendMessage]);

  const isStreaming = status === "streaming" || status === "submitted";

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <ModelSelector value={modelId} onChange={setModelId} />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl">
          <MessageList messages={messages} streaming={isStreaming} />
        </div>
      </div>

      <MessageInput
        onSend={(text) => sendMessage({ text })}
        disabled={status !== "ready"}
      />
    </div>
  );
}
