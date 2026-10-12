import { useSyncExternalStore } from "react";
import { hbSDK } from "./sdk";

// The Host reports backgrounding through its own lifecycle events, which do
// not always surface as a page visibility change, so both are tracked.
let hostHidden = false;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

hbSDK.on("hide", () => {
  hostHidden = true;
  emit();
});
hbSDK.on("show", () => {
  hostHidden = false;
  emit();
});
document.addEventListener("visibilitychange", emit);

const isVisible = () => !hostHidden && document.visibilityState !== "hidden";

export function useVisible(): boolean {
  return useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, isVisible);
}
