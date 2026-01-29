import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "助手蓝链生成器 - trudbot",
  description: "快速生成助手蓝链代码",
}

export default function ubluelinkLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
