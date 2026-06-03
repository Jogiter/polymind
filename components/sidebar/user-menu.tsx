"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { BarChart3, LogOut, User } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

// 侧边栏底部用户菜单：展示头像 / 名称，下拉提供「用量」「退出登录」。
export function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 p-3">
        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const user = session?.user;
  const displayName = user?.name || user?.email || "未登录";
  const initial = (user?.name || user?.email || "?").slice(0, 1).toUpperCase();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30",
        )}
        aria-label="用户菜单"
      >
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={displayName}
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {initial}
          </span>
        )}
        <span className="truncate font-medium text-foreground">
          {displayName}
        </span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={6}
          className={cn(
            "z-50 min-w-[12rem] rounded-md border border-border bg-background p-1 text-foreground shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        >
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span className="truncate">{user?.email ?? displayName}</span>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />

          <DropdownMenu.Item asChild>
            <Link
              href="/usage"
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                "focus:bg-muted data-[highlighted]:bg-muted",
              )}
            >
              <BarChart3 className="h-4 w-4" />
              用量
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={(e) => {
              e.preventDefault();
              handleSignOut();
            }}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-red-600 outline-none",
              "focus:bg-muted data-[highlighted]:bg-muted",
            )}
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
