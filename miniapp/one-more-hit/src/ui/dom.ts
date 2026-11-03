/** Tiny DOM helpers: the UI is a handful of static panels, not worth a framework. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", kids: (Node | string)[] | string = []): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (typeof kids === "string") el.textContent = kids;
  else el.append(...kids);
  return el;
}

export function button(label: string, cls: string, onClick: () => void, hint?: string) {
  const b = h("button", `omh-btn ${cls}`, hint ? [h("span", "", label), h("kbd", "omh-kbd", hint)] : label);
  b.type = "button";
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    // Keyboard focus would let Space re-click the button instead of swinging.
    b.blur();
    onClick();
  });
  return b;
}

/** Restarts a CSS animation by re-adding its class. */
export function replay(el: Element, cls: string) {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}

export const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
