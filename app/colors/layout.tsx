import type React from "react"
import type { Metadata } from "next"
import "./colors.css"

export const metadata: Metadata = {
  title: "收藏的颜色 - trudbot",
  description: "我收藏的那些清新、童趣、梦境般的颜色",
}

export default function ColorsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
