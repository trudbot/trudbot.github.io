"use client"

import { motion } from "framer-motion"

export function BottomDecoration() {
  return (
    <div className="mt-auto pt-24 md:pt-32">
      {/* 装饰性几何图案区域 */}
      <div className="relative mx-auto max-w-7xl">
        {/* 大型装饰文字 */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="mb-16 overflow-hidden"
        >
          <h2 className="font-mono text-[8rem] font-bold leading-none tracking-tighter text-muted/5 md:text-[12rem] lg:text-[16rem]">
            CREATIVE
          </h2>
        </motion.div>

        {/* 几何装饰网格 */}
        <div className="grid grid-cols-3 gap-4 md:grid-cols-6 md:gap-6">
          {[
            { delay: 1.6, color: "bg-primary/20", shape: "square" },
            { delay: 1.7, color: "bg-accent/20", shape: "circle" },
            { delay: 1.8, color: "bg-secondary/20", shape: "triangle" },
            { delay: 1.9, color: "bg-highlight/20", shape: "diamond" },
            { delay: 2.0, color: "bg-primary/10", shape: "square" },
            { delay: 2.1, color: "bg-accent/10", shape: "circle" },
          ].map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: item.delay, duration: 0.5 }}
              className="relative aspect-square"
            >
              <div
                className={`h-full w-full ${item.color}`}
                style={{
                  clipPath:
                    item.shape === "circle"
                      ? "circle(50%)"
                      : item.shape === "triangle"
                        ? "polygon(50% 0%, 100% 100%, 0% 100%)"
                        : item.shape === "diamond"
                          ? "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)"
                          : "none",
                }}
              />
            </motion.div>
          ))}
        </div>

        {/* 底部信息栏 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2, duration: 0.8 }}
          className="mt-16 flex flex-col items-center justify-between gap-6 border-t border-border pt-8 md:flex-row"
        >
          <div className="flex items-center gap-4">
            <div className="h-2 w-2 animate-pulse bg-primary" />
            <p className="font-mono text-sm text-muted-foreground">Available for creative projects</p>
          </div>

          <div className="flex items-center gap-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                duration: 20,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
              className="h-8 w-8 border-2 border-accent"
              style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
            />
            <p className="font-mono text-sm text-muted-foreground">© 2025 trudbot</p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
