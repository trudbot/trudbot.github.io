# 多页面静态路由指南

本项目不是 SPA 路由，也不依赖客户端 router。路由由 `app/**/page.tsx` 自动发现，静态托管服务根据 `out/` 目录里的 HTML 文件返回页面。

## 构建方式

`pnpm build` 执行 `scripts/ssg.mjs`：

1. 扫描 `app/**/page.tsx`。
2. 生成 `src/generated/entries/*` 和 `src/generated/pages.ts`。
3. Vite 构建每个页面的客户端 entry。
4. Vite 构建 SSR entry。
5. SSR entry 按自动发现的路由渲染 HTML。
6. SSG 脚本为每个路由写入：
   - `out/<route>/index.html`
   - `out/<route>.html`

这样 `/share` 和 `/share/` 都能命中同一个页面内容。

## 路由规则

- 只有 `page.tsx` 会成为路由。
- 括号目录会从 URL 中剥离。
- 嵌套目录会成为嵌套路由。

示例：

```txt
app/(home)/page.tsx  -> /
app/json/page.tsx    -> /json
app/share/r/page.tsx -> /share/r
```

## 新增路由

以 `/about` 为例：

```bash
pnpm create-page about
pnpm dev
```

无需修改 Vite 配置、SSR 映射或路由列表。

## 页面资源拆分

- 每个页面 entry 自动生成。
- 页面 CSS 由页面组件导入，只随该页面加载。
- 共享依赖通过 `manualChunks` 命名，方便分析产物。

## 验证

```bash
pnpm build
pnpm preview
```

检查目标路由是否返回对应 SSR HTML，并确认 HTML 中只注入该页面需要的资源。
