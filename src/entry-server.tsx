import { StrictMode, Suspense } from 'react'
import { renderToString } from 'react-dom/server'
import { pages, routesToPrerender } from './generated/pages'

export { routesToPrerender }

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
