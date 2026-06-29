import type React from "react"
import type { Metadata } from "next"
import "./styles.css"

export const metadata: Metadata = {
  title: "JSON 格式化实验室 - trudbot",
  description: "在线 JSON 格式化工具",
}

export default function JsonFormatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
