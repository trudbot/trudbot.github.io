import { Director } from "./game/director.ts";
import { trackSafeArea } from "./sdk.ts";
import "./styles/base.css";
import "./styles/hud.css";
import "./styles/panels.css";

trackSafeArea();

const root = document.getElementById("omh-root")!;
const canvas = document.getElementById("omh-canvas") as HTMLCanvasElement;
const ui = document.getElementById("omh-ui")!;

try {
  void new Director(root, canvas, ui).boot();
} catch (error) {
  // Without WebGL there is no game; say so instead of leaving a black screen.
  console.error("启动失败", error);
  ui.innerHTML = `<div class="omh-fatal">无法启动 3D 渲染，请确认设备支持 WebGL。</div>`;
}
