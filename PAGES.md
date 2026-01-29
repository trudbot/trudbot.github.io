# 页面开发指南

## 📁 项目结构

本项目采用 Next.js App Router 的文件式路由系统，每个页面都是独立的，拥有自己的样式和资源。

```
app/
├── layout.tsx          # 全局布局（包含字体、Analytics等）
├── globals.css         # 全局样式（CSS变量、Tailwind等）
├── (home)/            # 首页路由组
│   ├── page.tsx       # 首页内容
│   ├── layout.tsx     # 首页布局
│   └── home.css       # 首页专属样式
├── demo/              # 示例页面 (/demo)
│   ├── page.tsx
│   ├── layout.tsx
│   └── demo.css
└── [your-page]/       # 你的新页面
    ├── page.tsx
    ├── layout.tsx
    └── styles.css
```

## 🚀 快速创建新页面

### 方法一：手动创建（推荐理解结构）

1. **创建页面目录**
   ```bash
   mkdir app/your-page-name
   ```

2. **创建页面文件** `app/your-page-name/page.tsx`
   ```tsx
   import type { Metadata } from "next"

   export const metadata: Metadata = {
     title: "你的页面标题",
     description: "页面描述",
   }

   export default function YourPage() {
     return (
       <div className="your-container">
         <h1>你的页面内容</h1>
       </div>
     )
   }
   ```

3. **创建布局文件** `app/your-page-name/layout.tsx`
   ```tsx
   import type React from "react"
   import "./styles.css"

   export default function YourPageLayout({
     children,
   }: {
     children: React.ReactNode
   }) {
     return <>{children}</>
   }
   ```

4. **创建样式文件** `app/your-page-name/styles.css`
   ```css
   /* 页面专属样式 */
   .your-container {
     /* 你的样式 */
   }
   ```

### 方法二：使用脚本（快速创建）

```bash
# 运行创建页面脚本（如果有的话）
pnpm run create-page your-page-name
```

## 🎨 样式隔离说明

### 全局样式
- `app/globals.css` - 包含 CSS 变量、Tailwind 配置、通用工具类
- 这些样式在所有页面都会加载

### 页面专属样式
- 每个页面目录下的 CSS 文件只在该页面加载
- 通过在 `layout.tsx` 中导入：`import "./styles.css"`
- **注意：** CSS 模块会被 Next.js 自动处理，但全局类名需要注意命名避免冲突

### 推荐做法
1. 使用 BEM 命名或添加页面前缀，如 `.demo-container`、`.about-section` 等
2. 或使用 CSS Modules：将文件命名为 `styles.module.css`

## 📦 JavaScript/TypeScript 按需加载

Next.js 会自动进行代码分割：
- 每个 `page.tsx` 都是一个独立的入口点
- 组件按需导入时使用动态导入：
  ```tsx
  import dynamic from 'next/dynamic'
  
  const HeavyComponent = dynamic(() => import('@/components/heavy-component'), {
    loading: () => <p>Loading...</p>,
  })
  ```

## 🔗 路由说明

- `/` - 首页（来自 `app/(home)/page.tsx`）
- `/demo` - 示例页面
- `/your-page` - 你创建的页面会自动对应到 `/your-page` 路径
- 嵌套路由：`app/blog/post/page.tsx` → `/blog/post`

### 路由组（Route Groups）
- 使用 `(folder-name)` 创建路由组，不影响 URL
- 首页使用 `(home)` 路由组，保持 URL 为 `/`
- 可用于组织代码结构而不改变路由

## 💡 最佳实践

1. **保持页面独立性**
   - 每个页面都应该能独立运行
   - 避免在页面间共享大量状态

2. **合理使用共享组件**
   - 通用组件放在 `components/` 目录
   - 页面特定组件可以放在页面目录下的 `components/` 子目录

3. **性能优化**
   - 使用 `next/image` 优化图片
   - 使用 `next/font` 优化字体加载
   - 大型组件使用动态导入

4. **元数据管理**
   - 每个页面都应该设置 `metadata`
   - 可以使用 `generateMetadata` 动态生成

## 🛠️ 开发命令

```bash
# 开发模式
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# 代码检查
pnpm lint
```

## 📝 示例参考

查看以下示例页面了解更多：
- 首页：[app/(home)/page.tsx](app/(home)/page.tsx)
- Demo 页面：[app/demo/page.tsx](app/demo/page.tsx)

## 🎯 路由配置

本项目配置为静态导出（`output: 'export'`），适合部署到：
- GitHub Pages
- Vercel
- Netlify
- 任何静态托管服务

访问页面：
- 开发环境：`http://localhost:3000/your-page`
- 生产环境：`https://your-domain.com/your-page`
