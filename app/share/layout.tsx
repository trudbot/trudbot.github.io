import type React from "react"
import type { Metadata } from "next"
import "./styles.css"

export const metadata: Metadata = {
  title: "文本分享 - trudbot",
  description: "快速分享长文本和链接",
}

export default function TextShareLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
