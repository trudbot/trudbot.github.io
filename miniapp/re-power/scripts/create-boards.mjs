// Creates the ranked board. The platform caps a mini-program at three boards,
// so every level's first clears share one board (see src/ranking.ts). The
// runtime cannot create boards, so this must run once per mini-program after
// `hb-sdk login` and `hb-sdk remote bind`.
//
//   pnpm boards          print the command
//   pnpm boards --run    run it
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
// Must match BOARD in src/ranking.ts. Descending: more levels cleared ranks higher.
const args = ["remote", "cloud", "leaderboard", "create", "clears", "--order", "desc", "--rank-limit", "0"];

if (!process.argv.includes("--run")) {
  console.log(`pnpm hb-sdk ${args.join(" ")}`);
} else {
  // The local bin directly: pnpm itself may only be reachable through corepack.
  const res = spawnSync(path.join(root, "node_modules/.bin/hb-sdk"), args, { cwd: root, stdio: "inherit" });
  if (res.status !== 0) {
    console.error("创建排行榜失败", res.error ?? "");
    process.exit(res.status ?? 1);
  }
}
