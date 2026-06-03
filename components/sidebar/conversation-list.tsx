"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Conversation {
  id: string;
  title: string | null;
  model: string;
  updatedAt: string;
}

async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch("/api/conversations");
  if (!res.ok) throw new Error("加载会话列表失败");
  return res.json();
}

export function ConversationList() {
  const pathname = usePathname();
  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="p-2">
        <Button asChild variant="outline" className="w-full justify-start">
          <Link href="/">
            <Plus />
            新建会话
          </Link>
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2 pb-2">
        {isLoading && (
          <p className="px-2 py-4 text-xs text-muted-foreground">加载中…</p>
        )}

        {!isLoading && (conversations?.length ?? 0) === 0 && (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            还没有会话，开始新对话吧。
          </p>
        )}

        <ul className="flex flex-col gap-0.5">
          {(conversations ?? []).map((c) => {
            const active = pathname === `/c/${c.id}`;
            return (
              <li key={c.id}>
                <Link
                  href={`/c/${c.id}`}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="truncate">{c.title || "新会话"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
}
