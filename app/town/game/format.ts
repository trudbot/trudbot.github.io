export function formatTenths(t: number) {
  return `${Math.floor(t / 10)}.${t % 10} 秒`;
}
