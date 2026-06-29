import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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

export default defineConfig({
  plugins: [react()],
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
      input: {
        home: path.resolve(__dirname, 'src/entries/home.tsx'),
        json: path.resolve(__dirname, 'src/entries/json.tsx'),
        share: path.resolve(__dirname, 'src/entries/share.tsx'),
        'share-r': path.resolve(__dirname, 'src/entries/share-r.tsx'),
        colors: path.resolve(__dirname, 'src/entries/colors.tsx'),
        bluelink: path.resolve(__dirname, 'src/entries/bluelink.tsx'),
      },
      output: {
        manualChunks: chunkName,
      },
    },
  },
})
