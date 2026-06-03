"use client";

import { useEffect, useRef } from "react";

import { StreamingMessage } from "./streaming-message";

interface UIMessage {
  id?: string;
  role: "user" | "assistant" | "system" | "data";
  parts?: { type: string; text?: string }[];
  content?: string;
}

interface MessageListProps {
  messages: UIMessage[];
  streaming?: boolean;
}

export function MessageList({ messages, streaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 新内容到达时自动滚动到底部。
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      {messages.map((m, i) => (
        <StreamingMessage key={m.id ?? i} message={m} />
      ))}

      {streaming && (
        <div className="flex justify-start" aria-label="正在输入">
          <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
