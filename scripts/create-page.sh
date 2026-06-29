#!/bin/bash

# 快速创建 Vite MPA 页面
# 使用方法: ./scripts/create-page.sh page-name

if [ -z "$1" ]; then
  echo "错误: 请提供页面名称"
  echo "使用方法: ./scripts/create-page.sh page-name"
  exit 1
fi

PAGE_NAME=$1
PAGE_DIR="app/$PAGE_NAME"

if [ -d "$PAGE_DIR" ]; then
  echo "错误: 页面 '$PAGE_NAME' 已存在"
  exit 1
fi

PAGE_TITLE=$(echo "$PAGE_NAME" | sed -e 's/-/ /g' -e 's/\b\(.\)/\u\1/g')
COMPONENT_NAME=$(echo "$PAGE_NAME" | sed -e 's/-\(.\)/\u\1/g' -e 's/^\(.\)/\u\1/g')

mkdir -p "$PAGE_DIR"

cat > "$PAGE_DIR/page.tsx" << EOF
import './styles.css'

export default function ${COMPONENT_NAME}Page() {
  return (
    <main className="${PAGE_NAME}-container">
      <div className="${PAGE_NAME}-content">
        <h1>$PAGE_TITLE</h1>
        <p>欢迎来到 $PAGE_TITLE 页面</p>
        <a href="/" className="${PAGE_NAME}-link">
          返回首页
        </a>
      </div>
    </main>
  )
}
EOF

cat > "$PAGE_DIR/styles.css" << EOF
.${PAGE_NAME}-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.${PAGE_NAME}-content {
  max-width: 800px;
  text-align: center;
}

.${PAGE_NAME}-content h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.${PAGE_NAME}-content p {
  font-size: 1.25rem;
  margin-bottom: 2rem;
}

.${PAGE_NAME}-link {
  display: inline-block;
  padding: 1rem 2rem;
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  border-radius: 0.5rem;
  text-decoration: none;
  font-weight: 600;
  transition: opacity 0.3s ease;
}

.${PAGE_NAME}-link:hover {
  opacity: 0.9;
}
EOF

echo "页面创建成功"
echo "创建的文件:"
echo "- $PAGE_DIR/page.tsx"
echo "- $PAGE_DIR/styles.css"
echo ""
echo "下一步:"
echo "1. 编辑 $PAGE_DIR/page.tsx 添加页面内容"
echo "2. 编辑 $PAGE_DIR/styles.css 自定义样式"
echo "3. 运行 'pnpm dev' 查看效果；路由会自动从 app/**/page.tsx 生成"
