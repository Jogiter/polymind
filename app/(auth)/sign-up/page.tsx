"use client";

// 注册页 —— 邮箱密码注册（注册成功后需邮箱验证才能登录）。
import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await authClient.signUp.email({ name, email, password });
    if (error) setError(error.message ?? "注册失败");
    else setDone(true);
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
          注册 PolyMind
        </h1>
        <p className="mb-6 text-center text-sm text-gray-500">
          创建一个新账号
        </p>

        {done ? (
          <p className="text-center text-sm text-gray-700">
            注册成功！请前往邮箱完成验证后登录。
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="text"
              placeholder="昵称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
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
              {loading ? "注册中…" : "注册"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          已有账号？{" "}
          <Link href="/sign-in" className="font-medium text-gray-900 underline">
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
