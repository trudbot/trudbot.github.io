import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { discoverPages } from './scripts/discover-pages.mjs'

function chunkName(id: string) {
  if (id.includes('/node_modules/react-json-view/')) return 'react-json-view'
  if (id.includes('/node_modules/json5/')) return 'json5'
  if (id.includes('/node_modules/jsonrepair/')) return 'jsonrepair'
  if (id.includes('/node_modules/framer-motion/') || id.includes('/node_modules/motion-dom/') || id.includes('/node_modules/motion-utils/')) return 'framer-motion'
  if (id.includes('/node_modules/sonner/')) return 'sonner'
  if (id.includes('/node_modules/lucide-react/') || id.includes('/node_modules/lucide/')) return 'lucide-react'
  if (id.includes('/node_modules/@radix-ui/') || id.includes('/node_modules/class-variance-authority/') || id.includes('/node_modules/clsx/') || id.includes('/node_modules/tailwind-merge/')) return 'ui-utils'
  if (id.includes('/node_modules/@zumer/snapdom/')) return 'snapdom'
  if (id.includes('/node_modules/three/')) return 'three'
  if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) return 'react'
  if (id.includes('/node_modules/lz-string/') || id.includes('/node_modules/qrcode-generator/') || id.includes('/app/share/styles.css')) return 'share-common'
}

const pages = discoverPages({ root: __dirname })
const input = Object.fromEntries(pages.map((page) => [page.entryName, path.resolve(__dirname, page.entryFile)]))
const routeEntries = Object.fromEntries(pages.map((page) => [page.route, page.entryFile]))

function devPageEntries(): Plugin {
  return {
    name: 'dev-page-entries',
    apply: 'serve',
    transformIndexHtml(html, context) {
      const requestPath = context.originalUrl ?? context.path
      const pathname = requestPath.split('?')[0].replace(/\/$/, '') || '/'
      const entryFile = routeEntries[pathname]
      if (!entryFile) return html

      return html.replace(
        '<!--page-assets-->',
        `<script type="module" src="/${entryFile}"></script>`,
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), devPageEntries()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    outDir: 'out',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input,
      output: {
        manualChunks: chunkName,
      },
    },
  },
})
