import hbSDK, {
  HbMiniProgramSDKError,
  type MiniProgramEnvironmentInfo,
  type MiniProgramSDKHandshakeState,
} from "@heybox/hb-sdk";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const COUNTER_KEY = "hello_counter";

// 按钮可用性必须由持久握手状态驱动：`ready` 事件不重放，晚挂载的组件会错过。
function useHandshakeState() {
  const [state, setState] = useState<MiniProgramSDKHandshakeState>(() =>
    hbSDK.getHandshakeState(),
  );
  useEffect(() => hbSDK.onHandshakeStateChange(setState), []);
  return state;
}

function useColorScheme() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      document.documentElement.classList.toggle("dark", media.matches);
      hbSDK.viewport
        .setNavigationBarStyle({ foregroundStyle: media.matches ? "light" : "dark" })
        .catch((error: unknown) => console.error("无法同步导航栏样式", error));
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
}

function describeError(error: unknown) {
  return error instanceof HbMiniProgramSDKError ? `${error.code}: ${error.message}` : String(error);
}

export default function App() {
  const handshake = useHandshakeState();
  const sdkReady = handshake.status === "ready";
  const [count, setCount] = useState<number>();
  const [environment, setEnvironment] = useState<MiniProgramEnvironmentInfo>();
  const [error, setError] = useState<string>();

  useColorScheme();

  useEffect(() => {
    hbSDK.environment.getInfo().then(setEnvironment, (reason) => setError(describeError(reason)));
    hbSDK.storage.getStorage<number>({ key: COUNTER_KEY }).then(
      ({ data }) => setCount(typeof data === "number" ? data : 0),
      (reason) => setError(describeError(reason)),
    );
  }, []);

  async function greet() {
    setError(undefined);
    try {
      await hbSDK.ui.showToast({ message: "你好，这里是 trudbot", status: "success" });
    } catch (reason) {
      setError(describeError(reason));
    }
  }

  async function increment() {
    const next = (count ?? 0) + 1;
    setCount(next);
    setError(undefined);
    try {
      await hbSDK.storage.setStorage({ key: COUNTER_KEY, data: next });
    } catch (reason) {
      setError(describeError(reason));
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 bg-background px-5 py-8 text-foreground">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">trudbot 示例小程序</h1>
        <p className="text-sm text-muted-foreground">
          SDK 状态：
          <span
            className={cn(
              "font-medium",
              handshake.status === "ready" && "text-primary",
              handshake.status === "failed" && "text-secondary",
            )}
          >
            {handshake.status}
          </span>
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-medium">Toast</h2>
        <button
          type="button"
          disabled={!sdkReady}
          onClick={greet}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        >
          打个招呼
        </button>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-medium">隔离存储计数器</h2>
        <p className="text-4xl font-semibold tabular-nums">{count ?? "–"}</p>
        <button
          type="button"
          disabled={!sdkReady || count === undefined}
          onClick={increment}
          className="rounded-md bg-accent px-4 py-2 text-accent-foreground disabled:opacity-50"
        >
          +1 并保存
        </button>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-sm">
        <h2 className="font-medium">环境信息</h2>
        {environment ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">运行模式</dt>
            <dd>{environment.runtime.mode}</dd>
            <dt className="text-muted-foreground">App 版本</dt>
            <dd>{environment.host.appVersion ?? "未知"}</dd>
            <dt className="text-muted-foreground">系统</dt>
            <dd>
              {environment.operatingSystem.name} {environment.operatingSystem.version ?? ""}
            </dd>
            <dt className="text-muted-foreground">SDK</dt>
            <dd>{environment.sdk.version}</dd>
          </dl>
        ) : (
          <p className="text-muted-foreground">读取中…</p>
        )}
      </section>

      {error && (
        <p role="status" aria-live="polite" className="text-sm text-secondary">
          {error}
        </p>
      )}
    </main>
  );
}
