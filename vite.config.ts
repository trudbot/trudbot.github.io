import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
        manualChunks(id) {
          if (id.includes('/app/share/styles.css') || id.includes('/node_modules/lz-string/')) {
            return 'share-common'
          }
        },
      },
    },
  },
})
