"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles, Zap, Crown } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Tier = "free" | "pro" | "premium";

interface ModelInfo {
  id: string;
  label: string;
  tier: Tier;
  capabilities: string[];
  contextWindow: number;
  locked: boolean;
}

// 档位 → 图标
function TierIcon({ tier }: { tier: Tier }) {
  if (tier === "premium")
    return <Crown className="h-4 w-4 text-amber-500" aria-hidden />;
  if (tier === "pro")
    return <Zap className="h-4 w-4 text-violet-500" aria-hidden />;
  return <Sparkles className="h-4 w-4 text-emerald-500" aria-hidden />;
}

async function fetchModels(): Promise<ModelInfo[]> {
  const res = await fetch("/api/models");
  if (!res.ok) throw new Error("加载模型列表失败");
  const data = await res.json();
  // /api/models 返回 { models: [...] }
  return data.models ?? data;
}

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const { data: models, isLoading } = useQuery({
    queryKey: ["models"],
    queryFn: fetchModels,
  });

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[240px]" aria-label="选择模型">
        <SelectValue placeholder={isLoading ? "加载中…" : "选择模型"} />
      </SelectTrigger>
      <SelectContent>
        {(models ?? []).map((m) => (
          <SelectItem key={m.id} value={m.id} disabled={m.locked}>
            <span className="flex items-center gap-2">
              <TierIcon tier={m.tier} />
              <span>{m.label}</span>
              {m.locked && (
                <Badge variant="secondary" className="ml-1">
                  升级解锁
                </Badge>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
