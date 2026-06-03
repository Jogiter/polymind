import { ConversationList } from "@/components/sidebar/conversation-list";
import { UserMenu } from "@/components/sidebar/user-menu";

// 对话区布局：左侧固定宽度的侧边栏（会话列表 + 用户菜单），右侧渲染页面内容。
export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-muted/30">
        <div className="border-b border-border px-3 py-3">
          <span className="text-sm font-semibold tracking-tight">PolyMind</span>
        </div>

        <div className="min-h-0 flex-1">
          <ConversationList />
        </div>

        <div className="border-t border-border p-1">
          <UserMenu />
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
