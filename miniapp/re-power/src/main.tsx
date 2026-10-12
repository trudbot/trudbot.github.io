import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import "./styles.css";
import "./controls.css";
import "./level-list.css";
import "./level-status.css";
import "./game.css";
import "./panel.css";
import "./board.css";
import "./board-fx.css";
import "./win.css";
import "./ranking.css";
import "./ranking-rows.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
