# 页面开发指南

## 项目结构

```txt
app/
├── globals.css
├── (home)/
│   ├── page.tsx
│   └── home.css
├── json/
│   ├── page.tsx
│   └── styles.css
└── share/
    ├── page.tsx
    ├── styles.css
    └── r/
        ├── page.tsx
        └── receive-client.tsx
src/
├── generated/        # 自动生成的页面 entry 和 SSR 映射，不手写
├── entry-client.tsx  # 页面挂载逻辑
└── entry-server.tsx  # SSG 服务端渲染入口
scripts/
├── discover-pages.mjs
├── generate-routes.mjs
└── ssg.mjs
```

## 页面约定

只有 `app/**/page.tsx` 会被识别为路由。

路径映射规则：

- `app/(home)/page.tsx` → `/`
- `app/json/page.tsx` → `/json`
- `app/share/r/page.tsx` → `/share/r`

括号目录只用于组织代码，不影响 URL。

页面 CSS 由页面组件直接导入：

```tsx
import './styles.css'
```

页面 CSS 不放在全局入口中，避免所有页面加载所有样式。

## 新增页面

```bash
pnpm create-page your-page-name
```

脚本创建基础文件后，不需要手动注册路由。下一次运行 `pnpm dev` 或 `pnpm build` 时会自动生成：

- `src/generated/entries/<page>.tsx`
- `src/generated/pages.ts`
- `src/generated/route-manifest.json`

## 性能约定

- 非首屏功能使用动态导入。
- 大型依赖按页面或功能拆分 chunk。
- 构建产物命名通过 `vite.config.ts` 的 `manualChunks` 保持可读。
- 页面应该即使在 JS 加载前也具备可读的 SSG HTML。

## 当前路由

- `/` → `app/(home)/page.tsx`
- `/json` → `app/json/page.tsx`
- `/share` → `app/share/page.tsx`
- `/share/r` → `app/share/r/page.tsx`
- `/colors` → `app/colors/page.tsx`
- `/bluelink` → `app/bluelink/page.tsx`
