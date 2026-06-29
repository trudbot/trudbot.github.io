import { StrictMode, type ComponentType } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import GlobalScripts from '@/components/scripts/global-scripts'

import '@/app/globals.css'

export function mountPage(Page: ComponentType) {
  const root = document.getElementById('root')!
  const app = (
    <StrictMode>
      <Page />
      <GlobalScripts />
    </StrictMode>
  )

  if (root.childElementCount > 0) {
    hydrateRoot(root, app)
  } else {
    createRoot(root).render(app)
  }
}
