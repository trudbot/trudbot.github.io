# 项目技能与架构文档

## 技术栈

- **构建工具**: Vite Plus / Vite
- **渲染方式**: 自定义 SSG，多页面静态应用
- **语言**: TypeScript
- **UI**: React 19
- **样式**: Tailwind CSS v4
- **动画**: Framer Motion / tw-animate-css
- **组件基础**: Radix UI 风格组件
- **图标**: Lucide React

## 架构

```txt
app/                 # 页面组件和页面专属 CSS；app/**/page.tsx 自动成为路由
components/          # 共享组件
lib/                 # 共享逻辑和特效
src/generated/       # 自动生成的页面 entry 和 SSR 映射
src/entry-client.tsx # hydrate/createRoot 通用挂载逻辑
src/entry-server.tsx # SSG 服务端渲染入口
scripts/             # 路由发现、路由生成和静态生成脚本
miniapp/*/           # 小黑盒工坊小程序（pnpm workspace 包），独立 Vite 8 构建，不进入主站 SSG
```

## 小黑盒小程序（miniapp/）

- 每个子目录是一个独立的工坊小程序，配置在其 `package.json#heybox`，文档见 https://docs.xiaoheihe.cn/hb_sdk/llms.txt 。
- 产物只能有根 `dist/index.html` 一个 HTML；页面默认无网络权限，不要引入统计、外部图片/字体或 `fetch`。
- `@` 别名指向仓库根，可复用 `components/`、`lib/` 和 `app/globals.css`、`app/theme-tokens.css`。
- `@heybox/hb-sdk` 要求 Node `>=22.20.0`。常用命令：`pnpm --filter <包名> dev | build | deploy`；`dev` 与 `deploy` 需先 `hb-sdk login` 并 `hb-sdk remote create` / `bind`。

## 构建原则

- 项目是 MPA，不使用客户端 router 接管页面。
- 路由从 `app/**/page.tsx` 自动发现，`src/generated/` 不手写。
- 每个页面独立打包 JS/CSS。
- 页面专属 CSS 在页面组件中导入。
- 非首屏功能使用动态导入，必要时用 idle/hover 预加载。
- 保持 SSG HTML 可读，避免页面完全依赖客户端 JS 才能展示内容。
- chunk 命名在 `vite.config.ts` 中维护，产物应便于分析。

## 设计原则

- 优先使用 `app/colors/page.tsx` 中已有色彩。
- 避免通用 AI 式设计：过度渐变、模板化卡片、无意义阴影。
- 保持页面独立，功能相关样式使用页面前缀避免冲突。

## 常用命令

```bash
pnpm dev
pnpm build
pnpm preview
pnpm check
pnpm lint
```

## 相关文档

- [README](./README.md)
- [QUICKSTART](./QUICKSTART.md)
- [PAGES](./PAGES.md)
- [ROUTING_GUIDE](./ROUTING_GUIDE.md)
