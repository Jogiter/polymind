import { create } from "zustand";

// 客户端 UI 状态：当前选中的模型、侧边栏开关。
interface UIState {
  modelId: string;
  setModelId: (modelId: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  modelId: "deepseek-chat",
  setModelId: (modelId) => set({ modelId }),
  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
