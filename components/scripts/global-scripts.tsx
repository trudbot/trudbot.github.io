"use client"
import { useEffect } from 'react'

let initialized = false

export default function GlobalScripts() {
  useEffect(() => {
    if (initialized) return
    initialized = true
    const modelContext = (navigator as Navigator & { modelContext?: unknown }).modelContext
    if (modelContext) {
      import('@/web-mcp').then(({ registerWebMcp }) => registerWebMcp())
    }
  }, []);

  return null
}