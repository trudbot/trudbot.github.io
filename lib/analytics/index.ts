export {
  track,
  trackDisplay,
  trackExposure,
  trackClick,
  type TrackEventType,
  type TrackParams,
} from "./track";
// React 专属的 hook（如 usePageView）不从这里导出：本入口会被非 React 页面引用，
// 一旦 re-export 就可能把 react 运行时带进这些页面的产物。需要时直接从
// "@/lib/analytics/use-page-view" 引入。
export { getUid, ensureUid } from "./uid";
