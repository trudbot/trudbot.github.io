import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import HomePage from '@/app/(home)/page'
import JsonPage from '@/app/json/page'
import SharePage from '@/app/share/page'
import ReceivePage from '@/app/share/r/page'
import ColorsPage from '@/app/colors/page'
import BlueLinkPage from '@/app/bluelink/page'

const GlobalScripts = lazy(() => import('@/components/scripts/global-scripts'))

export const routesToPrerender = ['/', '/json', '/share', '/share/r', '/colors', '/bluelink']

export function AppRoutes({ includeClientRuntime = true }: { includeClientRuntime?: boolean }) {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/json" element={<JsonPage />} />
        <Route path="/share" element={<SharePage />} />
        <Route path="/share/r" element={<ReceivePage />} />
        <Route path="/colors" element={<ColorsPage />} />
        <Route path="/bluelink" element={<BlueLinkPage />} />
      </Routes>
      {includeClientRuntime && (
        <Suspense fallback={null}>
          <GlobalScripts />
        </Suspense>
      )}
    </>
  )
}
