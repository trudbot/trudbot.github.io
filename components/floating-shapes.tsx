"use client"

import { motion } from "framer-motion"

const shapes = [
  {
    id: 1,
    size: "h-32 w-32",
    color: "bg-primary/10",
    position: "top-[10%] left-[5%]",
    duration: 20,
  },
  {
    id: 2,
    size: "h-24 w-24",
    color: "bg-secondary/10",
    position: "top-[60%] left-[10%]",
    duration: 25,
  },
  {
    id: 3,
    size: "h-40 w-40",
    color: "bg-accent/10",
    position: "top-[20%] right-[8%]",
    duration: 30,
  },
  {
    id: 4,
    size: "h-28 w-28",
    color: "bg-highlight/10",
    position: "bottom-[15%] right-[12%]",
    duration: 22,
  },
  {
    id: 5,
    size: "h-36 w-36",
    color: "bg-primary/8",
    position: "bottom-[40%] left-[15%]",
    duration: 28,
  },
]

export function FloatingShapes() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {shapes.map((shape) => (
        <motion.div
          key={shape.id}
          className={`absolute ${shape.size} ${shape.color} ${shape.position} rounded-full blur-3xl`}
          animate={{
            y: [0, -30, 0],
            x: [0, 20, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: shape.duration,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}
