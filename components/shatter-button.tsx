"use client"

import { Button } from "@/components/ui/button"
import { useState } from "react"

export function ShatterButton() {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (loading) return
    setLoading(true)
    try {
      const { triggerShatter } = await import("@/lib/glass-shatter")
      await triggerShatter()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant="outline"
      size="sm"
      className="fixed bottom-4 right-4 z-50 opacity-60 hover:opacity-100 transition-opacity"
    >
      {loading ? "Shattering..." : "Shatter!"}
    </Button>
  )
}
