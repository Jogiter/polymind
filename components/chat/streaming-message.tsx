"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

import { cn } from "@/lib/utils";

// AI SDK v5 的 UI 消息为 parts 数组结构；同时兼容 v4 的 content 字符串。
interface UIMessagePart {
  type: string;
  text?: string;
}

interface UIMessage {
  id?: string;
  role: "user" | "assistant" | "system" | "data";
  parts?: UIMessagePart[];
  content?: string;
}

// 从消息中提取纯文本（拼接所有 text part）。
function extractText(message: UIMessage): string {
  if (message.parts && message.parts.length > 0) {
    return message.parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
  }
  return message.content ?? "";
}

export function StreamingMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = extractText(message);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div
        className={cn(
          "max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-sm text-foreground",
          "prose prose-sm dark:prose-invert max-w-none",
          "prose-pre:bg-background prose-pre:border prose-pre:border-border prose-pre:rounded-md",
          "prose-code:before:content-none prose-code:after:content-none",
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
        >
          {text}
        </ReactMarkdown>
      </div>
    </div>
  );
}
