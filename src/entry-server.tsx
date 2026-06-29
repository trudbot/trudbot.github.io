import { StrictMode, Suspense, type ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import HomePage from '@/app/(home)/page'
import JsonPage from '@/app/json/page'
import SharePage from '@/app/share/page'
import ReceivePage from '@/app/share/r/page'
import ColorsPage from '@/app/colors/page'
import BlueLinkPage from '@/app/bluelink/page'
import { routesToPrerender } from './route-list'

export { routesToPrerender }

const pages: Record<string, ComponentType> = {
  '/': HomePage,
  '/json': JsonPage,
  '/share': SharePage,
  '/share/r': ReceivePage,
  '/colors': ColorsPage,
  '/bluelink': BlueLinkPage,
}

export function render(url: string): string {
  const Page = pages[url]
  if (!Page) throw new Error(`Unknown prerender route: ${url}`)

  return renderToString(
    <StrictMode>
      <Suspense fallback={null}>
        <Page />
      </Suspense>
    </StrictMode>,
  )
}
