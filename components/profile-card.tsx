"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SocialLinks } from "@/components/social-links"
import { motion } from "framer-motion"
import { useState } from "react"

export function ProfileCard() {
  const [isAvatarHovered, setIsAvatarHovered] = useState(false)

  return (
    <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
      {/* 左侧：头像区域 - 不规则位置 */}
      <motion.div
        initial={{ opacity: 0, x: -50, rotate: -5 }}
        animate={{ opacity: 1, x: 0, rotate: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="md:col-span-5 md:col-start-1 md:row-start-1"
      >
        <div className="relative inline-block">
          {/* 装饰性几何形状 */}
          <motion.div
            animate={{
              rotate: isAvatarHovered ? [0, 180] : [0, 5, -5, 0],
              scale: isAvatarHovered ? 1.2 : [1, 1.05, 0.95, 1],
              x: isAvatarHovered ? -20 : 0,
              y: isAvatarHovered ? -20 : 0,
            }}
            transition={{
              duration: isAvatarHovered ? 0.6 : 8,
              repeat: isAvatarHovered ? 0 : Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
            className="absolute -left-8 -top-8 h-32 w-32 border-4 border-primary/30"
            style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
          />

          <motion.div
            animate={{
              rotate: isAvatarHovered ? [0, -180] : [0, -5, 5, 0],
              scale: isAvatarHovered ? 1.3 : 1,
              x: isAvatarHovered ? 20 : 0,
              y: isAvatarHovered ? 20 : 0,
            }}
            transition={{
              duration: isAvatarHovered ? 0.6 : 6,
              repeat: isAvatarHovered ? 0 : Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
            className="absolute -bottom-6 -right-6 h-24 w-24 bg-accent/20"
            style={{ clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" }}
          />

          <motion.div
            onHoverStart={() => setIsAvatarHovered(true)}
            onHoverEnd={() => setIsAvatarHovered(false)}
            animate={{
              rotate: isAvatarHovered ? [0, -5, 5, -5, 0] : 0,
              scale: isAvatarHovered ? 1.1 : 1,
            }}
            transition={{
              duration: 0.5,
              ease: "easeOut",
            }}
            className="relative cursor-pointer"
          >
            {/* 悬停时出现的彩色光环 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: isAvatarHovered ? [0, 0.6, 0] : 0,
                scale: isAvatarHovered ? [0.8, 1.3, 1.5] : 0.8,
              }}
              transition={{
                duration: 1.2,
                repeat: isAvatarHovered ? Number.POSITIVE_INFINITY : 0,
                ease: "easeOut",
              }}
              className="absolute inset-0 rounded-full"
              style={{
                background: "conic-gradient(from 0deg, #00d4ff, #ff00ff, #ffff00, #00ff00, #00d4ff)",
                filter: "blur(20px)",
              }}
            />

            {/* 旋转的彩色边框 */}
            <motion.div
              animate={{
                rotate: isAvatarHovered ? 360 : 0,
              }}
              transition={{
                duration: 2,
                repeat: isAvatarHovered ? Number.POSITIVE_INFINITY : 0,
                ease: "linear",
              }}
              className="absolute -inset-2 rounded-full opacity-0"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, #00d4ff 90deg, transparent 180deg, #ff00ff 270deg, transparent 360deg)",
                opacity: isAvatarHovered ? 0.8 : 0,
              }}
            />

            <Avatar
              className="relative h-48 w-48 border-8 border-background shadow-2xl transition-shadow duration-300 md:h-64 md:w-64"
              style={{
                boxShadow: isAvatarHovered
                  ? "0 0 60px rgba(0, 212, 255, 0.6), 0 0 100px rgba(255, 0, 255, 0.4)"
                  : undefined,
              }}
            >
              <AvatarImage src="/images/design-mode/202407082112768.jpg" alt="trudbot" />
              <AvatarFallback className="bg-primary text-6xl text-primary-foreground">T</AvatarFallback>
            </Avatar>

            {/* 悬停时出现的粒子效果 */}
            {isAvatarHovered && (
              <>
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0],
                      x: Math.cos((i * Math.PI * 2) / 8) * 150,
                      y: Math.sin((i * Math.PI * 2) / 8) * 150,
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Number.POSITIVE_INFINITY,
                      delay: i * 0.1,
                    }}
                    className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      background: ["#00d4ff", "#ff00ff", "#ffff00", "#00ff00"][i % 4],
                    }}
                  />
                ))}
              </>
            )}
          </motion.div>

          {/* 彩色装饰线条 */}
          <div className="absolute -right-12 top-1/4 flex flex-col gap-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: isAvatarHovered ? "6rem" : "4rem",
              }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="h-1 bg-primary"
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: isAvatarHovered ? "8rem" : "6rem",
              }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="h-1 bg-accent"
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: isAvatarHovered ? "5rem" : "3rem",
              }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="h-1 bg-secondary"
            />
          </div>
        </div>
      </motion.div>

      {/* 右侧：用户名和信息 - 错位排列 */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="md:col-span-7 md:col-start-6 md:row-start-1 md:pt-12"
      >
        <div className="relative mb-8">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="absolute -left-4 top-0 h-full w-2 bg-gradient-to-b from-cyan-400 via-teal-400 to-blue-400"
          />

          <h1 className="font-handwriting text-6xl font-bold leading-tight tracking-tight text-foreground md:text-7xl lg:text-8xl">
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              @trudbot
            </motion.span>
          </h1>

          {/* 装饰性色块 */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="absolute -right-8 top-1/3 h-16 w-16 bg-highlight/30"
          />
        </div>

        {/* 简介 - 倾斜的文字块 */}
        <motion.div
          initial={{ opacity: 0, rotate: -2 }}
          animate={{ opacity: 1, rotate: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="relative mb-12 border-l-4 border-accent pl-6"
        >
          <p className="text-pretty text-xl leading-relaxed text-muted-foreground md:text-2xl">Fontend Developer</p>

          {/* 装饰性小方块 */}
          <div className="mt-4 flex gap-2">
            <div className="h-3 w-3 bg-primary" />
            <div className="h-3 w-3 bg-accent" />
            <div className="h-3 w-3 bg-secondary" />
            <div className="h-3 w-3 bg-highlight" />
          </div>
        </motion.div>

        {/* 社交链接 - 不规则排列 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.6 }}
        >
          <SocialLinks />
        </motion.div>
      </motion.div>

      {/* 底部装饰性文字 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3, duration: 0.8 }}
        className="md:col-span-12 md:row-start-2"
      >
        <div className="flex items-center justify-center gap-8 pt-12 md:justify-end md:pt-0">
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-border to-transparent" />
          <p className="font-mono text-sm text-muted-foreground">CREATIVE MIND</p>
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
      </motion.div>
    </div>
  )
}
