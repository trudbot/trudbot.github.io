// framer-motion 的动画实现（features）体积远大于 `m` 组件本身，且首帧内容由 SSG
// 输出、不依赖它。页面用 <LazyMotion features={loadMotionFeatures}> 包裹，
// 首屏只带 `m` 与 LazyMotion，features 在 hydration 后异步加载。
//
// 统一加载 domMax：用到 `layout` 动画的页面需要它，按页面区分 domAnimation 省下的
// 体积不值得多维护一个变体。
export const loadMotionFeatures = () =>
  import("./motion-features-max").then((module) => module.default);
