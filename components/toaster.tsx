"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { ToasterProps } from "sonner";

/*
 * sonner（约 35KB）对首屏并非必需——只有用户触发 toast 时才需要。
 * 这里把 sonner 的加载与 Toaster 的挂载都延后：
 *   - <Toaster /> 在 hydration 后的空闲时段（requestIdleCallback）再动态加载并挂载；
 *   - toast()/toast.success() 等调用会在需要时立即触发加载，并等 Toaster 真正挂载、
 *     订阅到 store 之后再派发，避免「先 toast 后挂载」导致丢失。
 * sonner 的 toast store 是模块单例，动态 import 得到的是同一实例，因此二者共享状态。
 */

type ToastModule = typeof import("sonner");

let modulePromise: Promise<ToastModule> | null = null;
function loadSonner() {
  return (modulePromise ??= import("sonner"));
}

// 已挂载的 <Toaster /> 注册在此，toast() 调用时通知它们立即加载。
const mountRequests = new Set<() => void>();
function requestMount() {
  for (const request of mountRequests) request();
}

// 在真正的 Toaster 挂载并订阅 store 之前，toast 调用先在此等待。
let markReady: () => void = () => {};
const toasterReady = new Promise<void>((resolve) => {
  markReady = resolve;
});

async function run<T>(call: (toastApi: ToastModule["toast"]) => T): Promise<T> {
  requestMount();
  await toasterReady;
  const mod = await loadSonner();
  return call(mod.toast);
}

// 延迟版 toast：API 与 sonner 的 toast 一致，但按需加载。
export const toast = Object.assign(
  (...args: Parameters<ToastModule["toast"]>) => run((t) => t(...args)),
  {
    success: (...args: Parameters<ToastModule["toast"]["success"]>) =>
      run((t) => t.success(...args)),
    error: (...args: Parameters<ToastModule["toast"]["error"]>) => run((t) => t.error(...args)),
    info: (...args: Parameters<ToastModule["toast"]["info"]>) => run((t) => t.info(...args)),
    warning: (...args: Parameters<ToastModule["toast"]["warning"]>) =>
      run((t) => t.warning(...args)),
    message: (...args: Parameters<ToastModule["toast"]["message"]>) =>
      run((t) => t.message(...args)),
    loading: (...args: Parameters<ToastModule["toast"]["loading"]>) =>
      run((t) => t.loading(...args)),
    dismiss: (...args: Parameters<ToastModule["toast"]["dismiss"]>) =>
      run((t) => t.dismiss(...args)),
  },
);

export function Toaster(props: ToasterProps) {
  const [SonnerToaster, setSonnerToaster] = useState<ComponentType<ToasterProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      loadSonner().then((mod) => {
        if (!cancelled) setSonnerToaster(() => mod.Toaster);
      });
    };

    mountRequests.add(load);
    const idle =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(load)
        : window.setTimeout(load, 200);

    return () => {
      cancelled = true;
      mountRequests.delete(load);
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idle as number);
      } else {
        window.clearTimeout(idle as number);
      }
    };
  }, []);

  // 子组件（真正的 Toaster）挂载后其订阅 effect 已运行，此时放行等待中的 toast。
  useEffect(() => {
    if (SonnerToaster) markReady();
  }, [SonnerToaster]);

  if (!SonnerToaster) return null;

  return (
    <SonnerToaster
      theme="system"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
