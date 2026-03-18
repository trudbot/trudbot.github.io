import { Suspense } from 'react'
import ReceiveClient from './receive-client'

// Static export compatible - client-side params parsing
export default function ReceivePage() {
  return (
    <Suspense fallback={<div className="text-share-container"><div className="text-share-card">加载中...</div></div>}>
      <ReceiveClient />
    </Suspense>
  )
}
