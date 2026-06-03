"use client";

// 登录页 —— 支持微信扫码、GitHub、邮箱密码三种方式。
import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 微信扫码登录：插件方法默认未进入 authClient 类型，故 cast 为 any。
  const handleWechat = () => {
    (authClient as any).signIn.wechat();
  };

  // GitHub 社交登录
  const handleGithub = () => {
    authClient.signIn.social({ provider: "github" });
  };

  // 邮箱密码登录
  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) setError(error.message ?? "登录失败");
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div
        className={cn(
          "w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm",
          "border border-gray-100",
        )}
      >
        <h1 className="mb-1 text-center text-2xl font-semibold text-gray-900">
          登录 PolyMind
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          选择一种方式继续
        </p>

        {/* 邮箱密码表单 */}
        <form onSubmit={handleEmail} className="space-y-3">
          <Input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "登录中…" : "邮箱登录"}
          </Button>
        </form>

        {/* 分隔线 */}
        <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          或
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        {/* 第三方登录 */}
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleWechat}
          >
            微信扫码登录
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGithub}
          >
            GitHub 登录
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          还没有账号？{" "}
          <Link href="/sign-up" className="font-medium text-gray-900 underline">
            注册
          </Link>
        </p>
      </div>
    </div>
  );
}
