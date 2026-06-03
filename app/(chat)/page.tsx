"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { ModelSelector } from "@/components/chat/model-selector";
import { MessageInput } from "@/components/chat/message-input";
import { useUIStore } from "@/lib/store";

// 新会话落地页：居中的模型选择器 + 欢迎语 + 输入框。
// 首次发送会先创建会话，再跳转到 /c/[id]，并通过 sessionStorage 传递首条消息。
export default function NewChatPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const modelId = useUIStore((s) => s.modelId);
  const setModelId = useUIStore((s) => s.setModelId);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(text: string) {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId }),
      });
      if (!res.ok) throw new Error("创建会话失败");
      const conv: { id: string } = await res.json();

      // 把首条消息暂存，chat 页挂载后自动发送。
      sessionStorage.setItem(`polymind:pending:${conv.id}`, text);
      // 刷新侧边栏会话列表。
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      router.push(`/c/${conv.id}`);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <ModelSelector value={modelId} onChange={setModelId} />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            开始新的对话
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            在 DeepSeek、Claude、Gemini、Qwen 等模型之间自由切换，输入问题即可开始。
          </p>
          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
        </div>
      </div>

      <MessageInput onSend={handleSend} disabled={creating} />
    </div>
  );
}
