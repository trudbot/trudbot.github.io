"use client"

import { motion } from "framer-motion"
import Image from "next/image"

const socialLinks = [
  {
    href: "https://github.com/trudbot",
    name: "GitHub",
    icon: "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/202407191658446.png",
    bgColor: "bg-gray-100", // 黑色图标配浅灰背景
  },
  {
    href: "https://trudbot.cn/Blog",
    name: "Blog",
    icon: "https://trudbot-pic.oss-cn-hangzhou.aliyuncs.com/20240110214815285776-7322466096995979814-3.webp",
    bgColor: "bg-emerald-100", // 绿色图标配淡绿背景
  },
  {
    href: "https://www.zhihu.com/people/qu-ge-sha-ming-hao-ni-30",
    name: "知乎",
    icon: "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/202407191656864.png",
    bgColor: "bg-blue-100", // 蓝色图标配淡蓝背景
  },
  {
    href: "https://www.npmjs.com/org/trudbot",
    name: "npm",
    icon: "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/202407191651233.png",
    bgColor: "bg-red-100", // 红色图标配淡红背景
  },
]

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 20, rotate: -5 },
  show: { opacity: 1, y: 0, rotate: 0 },
}

export function SocialLinks() {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {socialLinks.map((link, index) => {
        // 为每个链接创建不同的形状
        const shapes = [
          "clip-none", // 正方形
          "clip-triangle", // 三角形
          "clip-diamond", // 菱形
          "clip-none", // 正方形
        ]

        return (
          <motion.a
            key={link.name}
            variants={item}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`group relative flex h-20 w-20 items-center justify-center transition-all duration-300 focus-visible:outline-none ${link.bgColor} ${shapes[index]}`}
            whileHover={{ scale: 1.15, rotate: index % 2 === 0 ? 5 : -5 }}
            whileTap={{ scale: 0.9 }}
          >
            <div className="relative z-10 h-8 w-8 transition-transform duration-300 group-hover:scale-110">
              <Image
                src={link.icon || "/placeholder.svg"}
                alt={link.name}
                fill
                className="object-contain"
                unoptimized
                crossOrigin="anonymous"
              />
            </div>
            <span className="sr-only">{link.name}</span>
          </motion.a>
        )
      })}
    </motion.div>
  )
}
