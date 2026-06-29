# 快速开始

本项目是 Vite Plus + React 的多页面静态应用。路由自动从 `app/**/page.tsx` 发现，构建时由 `scripts/ssg.mjs` 预渲染成静态 HTML。

## 当前页面

- `/` - 首页
- `/json` - JSON 编辑器
- `/share` - 文本/链接分享
- `/share/r` - 分享接收页
- `/colors` - 颜色收藏
- `/bluelink` - 蓝链生成工具

## 开发

```bash
pnpm dev
```

`pnpm dev` 会先生成 `src/generated/` 路由入口，再启动开发服务器。

## 构建与预览

```bash
pnpm build
pnpm preview
```

构建产物输出到 `out/`，可以部署到任意静态托管服务。

## 新增页面

```bash
pnpm create-page your-page-name
```

脚本会生成：

- `app/your-page-name/page.tsx`
- `app/your-page-name/styles.css`

无需手动注册路由；下一次 `pnpm dev` 或 `pnpm build` 会自动发现页面。
