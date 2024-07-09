export function createTpl(content) {
  const el = document.createElement('template');
  el.innerHTML = content;
  return el;
}