# trudbot.github.io

个人静态站点，基于 Vite Plus + React 19 构建为多页面静态应用。

## 技术栈

- Vite Plus / Vite
- React 19
- TypeScript
- Tailwind CSS v4
- 自定义 SSG 脚本：`scripts/ssg.mjs`
- 文件目录式自动路由：`app/**/page.tsx`

## 常用命令

```bash
pnpm dev       # 生成路由并启动开发服务器
pnpm build     # 构建静态站点到 out/
pnpm preview   # 预览 out/ 静态产物
pnpm check     # Vite Plus 检查
pnpm lint      # Vite Plus lint
```

## 路由

路由自动从 `app/**/page.tsx` 生成：

- `app/(home)/page.tsx` → `/`
- `app/json/page.tsx` → `/json`
- `app/share/r/page.tsx` → `/share/r`

括号目录只用于组织代码，不会出现在 URL 中。

每个页面都有自动生成的独立 client entry，构建后按页面拆分 JS/CSS；服务端静态托管负责返回对应 HTML，不依赖客户端路由。
