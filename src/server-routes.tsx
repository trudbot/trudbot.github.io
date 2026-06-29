import { Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import HomePage from '@/app/(home)/page'
import JsonPage from '@/app/json/page'
import SharePage from '@/app/share/page'
import ReceivePage from '@/app/share/r/page'
import ColorsPage from '@/app/colors/page'
import BlueLinkPage from '@/app/bluelink/page'

export function StaticAppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/json" element={<JsonPage />} />
        <Route path="/share" element={<SharePage />} />
        <Route path="/share/r" element={<ReceivePage />} />
        <Route path="/colors" element={<ColorsPage />} />
        <Route path="/bluelink" element={<BlueLinkPage />} />
      </Routes>
    </Suspense>
  )
}
