import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Caveat } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"
// mobile.css 已移除，页面特定样式应在各自页面目录中导入

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
})

export const metadata: Metadata = {
  title: "trudbot here!",
  description: `trdubot的网络索引.
            zhihu: https://www.zhihu.com/people/qu-ge-sha-ming-hao-ni-30,
            blog: https://blog.trudbot.cn,
            github: https://github.com/trudbot`,
  icons: 'https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/202407082112768.jpg',
  authors: [{ name: "trudbot", url: "https://trudbot.cn" }],
  generator: "Next.js",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} ${caveat.variable}`}>
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  )
}