# 快速开始 - 文件式路由

## 🎯 核心概念

本项目已配置为**文件式路由系统**，每个页面互不干扰，只加载必要的资源。

## 📂 当前页面

- `/` - 首页（来自 `app/(home)`）
- `/demo` - 示例页面
- `/json-format` - JSON 格式化实验室
- `/text-share` - 文本分享工具

## ⚡ 快速创建新页面

### 方式一：使用脚本（推荐）

```bash
pnpm create-page your-page-name
```

### 方式二：手动创建

```bash
mkdir -p app/your-page
cd app/your-page

# 创建三个文件：
# - page.tsx （页面内容）
# - layout.tsx （页面布局）
# - styles.css （页面样式）
```

## 🔍 查看详细文档

完整的页面开发指南请查看 [PAGES.md](./PAGES.md)

## 🎨 样式隔离

- ✅ 全局样式：`app/globals.css` （所有页面共享）
- ✅ 页面样式：`app/[page]/styles.css` （仅该页面加载）
- ✅ 自动代码分割：每个页面的 JS 独立打包

## 🚀 开发

```bash
# 启动开发服务器
pnpm dev

# 访问页面
# http://localhost:3000/        -> 首页
# http://localhost:3000/demo    -> Demo页面
# http://localhost:3000/新页面  -> 你创建的新页面
```

## 📦 构建部署

```bash
# 构建静态站点
pnpm build

# 输出目录：out/
# 可直接部署到 GitHub Pages, Vercel, Netlify 等
```
