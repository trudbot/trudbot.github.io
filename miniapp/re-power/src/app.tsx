import { useEffect, useState } from "react";
import { setSound, sfx, unlockAudio } from "./audio";
import { Game } from "./game";
import { LevelList } from "./level-list";
import { LEVELS } from "./levels";
import { syncFirstClears } from "./ranking";
import { RankingScreen } from "./ranking-screen";
import { getSave, isUnlocked, loadSave, useSave } from "./save";
import { hbSDK, sdkReady } from "./sdk";

type Tab = "levels" | "ranking";

/**
 * Host insets reach the page through CSS variables. `env()` stays as the
 * fallback for plain browsers, where the SDK cannot measure the window.
 */
function useSafeArea() {
  useEffect(() => {
    let alive = true;
    const measure = async () => {
      if (!(await sdkReady)) return;
      try {
        const info = await hbSDK.viewport.getWindowInfo();
        if (!alive) return;
        const root = document.documentElement.style;
        root.setProperty("--rp-safe-t", `${info.safeArea.top}px`);
        root.setProperty("--rp-safe-r", `${info.windowWidth - info.safeArea.right}px`);
        root.setProperty("--rp-safe-b", `${info.windowHeight - info.safeArea.bottom}px`);
        root.setProperty("--rp-safe-l", `${info.safeArea.left}px`);
      } catch (error) {
        console.error("无法读取安全区域", error);
      }
    };
    void measure();
    // The page is always dark, so the Host chrome always needs a light foreground.
    void sdkReady.then((ok) => {
      if (ok) hbSDK.viewport.setNavigationBarStyle({ foregroundStyle: "light" }).catch(() => {});
    });
    window.addEventListener("resize", measure);
    return () => {
      alive = false;
      window.removeEventListener("resize", measure);
    };
  }, []);
}

function TabIcon({ tab }: { tab: Tab }) {
  return tab === "levels" ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x={3} y={3} width={7} height={7} />
      <rect x={14} y={3} width={7} height={7} />
      <rect x={3} y={14} width={7} height={7} />
      <path d="M17.5 13 L15 18 H18.5 L16.5 22" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 21 V13 H8 V21 M8 21 V8 H16 V21 M16 21 V11 H21 V21 Z" />
    </svg>
  );
}

export default function App() {
  const save = useSave();
  const [tab, setTab] = useState<Tab>("levels");
  // A fresh key per entry remounts the game, so "再玩一次" starts a clean run.
  const [playing, setPlaying] = useState<{ level: number; key: number } | null>(null);
  const [rankLevel, setRankLevel] = useState(0);

  useSafeArea();

  useEffect(() => {
    if (save) setSound(save.settings.sound);
  }, [save]);

  useEffect(() => {
    // Pending first clears go up as soon as the account can submit them.
    void loadSave.then(() => syncFirstClears());
    const offLogin = hbSDK.on("heybox_app_login_change", ({ isHeyboxAppLoggedIn }) => {
      if (isHeyboxAppLoggedIn) void syncFirstClears();
    });
    const offShow = hbSDK.on("show", () => {
      unlockAudio();
      void syncFirstClears();
    });
    return () => {
      offLogin();
      offShow();
    };
  }, []);

  useEffect(() => {
    // Default the board picker to the furthest level reached.
    if (!save) return;
    const reached = LEVELS.findLastIndex((_, i) => isUnlocked(save, i));
    setRankLevel(Math.max(0, reached));
    // Only once the save has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save === null]);

  if (!save) {
    return (
      <div className="rp-boot" aria-busy="true">
        <span className="rp-boot-bolt" />
        <p>正在接入配电系统…</p>
      </div>
    );
  }

  const play = (level: number) => {
    if (!isUnlocked(getSave(), level)) return;
    setPlaying({ level, key: Date.now() });
  };

  return (
    <div className="rp-app" onPointerDownCapture={unlockAudio}>
      <div className="rp-scanlines" aria-hidden="true" />
      {playing ? (
        <Game
          key={playing.key}
          level={LEVELS[playing.level]}
          onExit={() => setPlaying(null)}
          onPlay={play}
          onRanking={(i) => {
            setPlaying(null);
            setRankLevel(i);
            setTab("ranking");
          }}
        />
      ) : (
        <>
          <main className="rp-main">
            {tab === "levels" ? (
              <LevelList onPlay={play} />
            ) : (
              <RankingScreen level={rankLevel} onLevel={setRankLevel} />
            )}
          </main>
          <nav className="rp-tabbar" aria-label="主菜单">
            {(["levels", "ranking"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className="rp-tab"
                aria-current={tab === t ? "page" : undefined}
                onClick={() => {
                  if (tab !== t) sfx.tap();
                  setTab(t);
                }}
              >
                <TabIcon tab={t} />
                <span>{t === "levels" ? "关卡" : "排行榜"}</span>
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
