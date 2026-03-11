"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SocialLinks } from "@/components/social-links"
import { motion, useAnimation, useReducedMotion } from "framer-motion"
import { useState, useRef, useEffect, useCallback } from "react"

// ─── Constants ───────────────────────────────────────────────────────────────
const AVATAR_IMAGE_URL =
  "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/202407082112768.jpg"

const PARTICLE_COUNT = 8
const PARTICLE_RADIUS = 150
const PARTICLE_DURATION = 1.5
const PARTICLE_STAGGER = 0.1
const BURST_TIMEOUT_MS = 3000
const MOUSE_SETTLE_MS = 150
const MOUSE_SETTLE_THRESHOLD_SQ = 400 // 20px²
// 入场动画最大时长：最晚 delay(1.3s) + duration(0.8s)
const ENTRY_ANIMATION_MS = 2100

const EFFECT_COLORS = [
  "var(--effect-cyan)",
  "var(--effect-magenta)",
  "var(--effect-yellow)",
  "var(--effect-green)",
]

const GLOW_GRADIENT = `conic-gradient(from 0deg, ${EFFECT_COLORS.join(", ")}, ${EFFECT_COLORS[0]})`
const BORDER_GRADIENT = `conic-gradient(from 0deg, transparent 0deg, ${EFFECT_COLORS[0]} 90deg, transparent 180deg, ${EFFECT_COLORS[1]} 270deg, transparent 360deg)`

// 预计算粒子扩散方向（固定 8 方向，避免每帧重复 cos/sin）
const PARTICLE_DIRECTIONS = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const angle = (i * Math.PI * 2) / PARTICLE_COUNT
  return { dx: Math.cos(angle) * PARTICLE_RADIUS, dy: Math.sin(angle) * PARTICLE_RADIUS }
})

// ─── DecorativeShapes ────────────────────────────────────────────────────────
function DecorativeShapes({ isActive, reducedMotion }: { isActive: boolean; reducedMotion: boolean }) {
  if (reducedMotion) {
    return (
      <>
        <div
          className="absolute -left-8 -top-8 h-32 w-32 border-4 border-primary/30 clip-diamond"
        />
        <div
          className="absolute -bottom-6 -right-6 h-24 w-24 bg-accent/20 clip-triangle"
        />
      </>
    )
  }

  return (
    <>
      <motion.div
        animate={
          isActive
            ? { rotate: [0, 180], scale: 1.2, x: -20, y: -20 }
            : { rotate: 5, scale: 1.05, x: 0, y: 0 }
        }
        transition={
          isActive
            ? { duration: 0.6, ease: "easeInOut" }
            : { duration: 4, repeat: Number.POSITIVE_INFINITY, repeatType: "mirror", ease: "easeInOut" }
        }
        className="absolute -left-8 -top-8 h-32 w-32 border-4 border-primary/30 clip-diamond"
      />
      <motion.div
        animate={
          isActive
            ? { rotate: [0, -180], scale: 1.3, x: 20, y: 20 }
            : { rotate: [0, -5, 5, 0], scale: 1, x: 0, y: 0 }
        }
        transition={
          isActive
            ? { duration: 0.6, ease: "easeInOut" }
            : { duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
        }
        className="absolute -bottom-6 -right-6 h-24 w-24 bg-accent/20 clip-triangle"
      />
    </>
  )
}

// ─── GlowEffects ─────────────────────────────────────────────────────────────
function GlowEffects({ isActive }: { isActive: boolean }) {
  return (
    <>
      {/* 彩色光环 — idle 时不渲染，避免 blur(20px) 空耗 GPU 合成层 */}
      {isActive && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{
            opacity: [0, 0.6, 0],
            scale: [0.8, 1.3, 1.5],
          }}
          transition={{
            duration: 2.5,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeOut",
          }}
          className="absolute inset-0 rounded-full"
          style={{
            background: GLOW_GRADIENT,
            filter: "blur(20px)",
          }}
        />
      )}
      {/* 旋转的彩色边框 */}
      <motion.div
        animate={{
          rotate: isActive ? [0, 360] : 0,
          opacity: isActive ? 0.8 : 0,
        }}
        transition={{
          rotate: {
            duration: 2,
            repeat: isActive ? Number.POSITIVE_INFINITY : 0,
            ease: "linear",
          },
          opacity: { duration: 0.3, ease: "easeOut" },
        }}
        className="absolute -inset-2 rounded-full"
        style={{ background: BORDER_GRADIENT }}
      />
      {/* 发光阴影 — 用 opacity 控制预设阴影，避免每帧重绘 boxShadow */}
      <div className="relative rounded-full">
        <motion.div
          animate={{ opacity: isActive ? 1 : 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 60px ${EFFECT_COLORS[0]}99, 0 0 100px ${EFFECT_COLORS[1]}66`,
          }}
        />
        <Avatar className="relative h-48 w-48 border-8 border-background shadow-2xl md:h-64 md:w-64">
          <AvatarImage src={AVATAR_IMAGE_URL} alt="trudbot" />
          <AvatarFallback className="flex h-full w-full items-center justify-center bg-background/5 backdrop-blur-xl">
            <AvatarFallbackSvg />
          </AvatarFallback>
        </Avatar>
      </div>
    </>
  )
}

// ─── AvatarFallbackSvg ───────────────────────────────────────────────────────
function AvatarFallbackSvg() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-full w-full p-8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g className="animate-[pulse_4s_ease-in-out_infinite]">
        <path d="M20 30 Q35 25 48 30 L48 45 Q35 50 20 45 Z" className="fill-primary" />
        <rect x="52" y="26" width="28" height="18" rx="9" className="fill-secondary" transform="rotate(-4 66 35)" />
        <rect x="42" y="52" width="16" height="32" rx="6" className="fill-accent" transform="rotate(2 50 68)" />
      </g>
      <circle cx="28" cy="72" r="3" className="fill-primary/60 animate-[bounce_3s_infinite]" />
      <circle cx="78" cy="62" r="4" className="fill-secondary/50 animate-[pulse_2s_infinite]" />
      <circle cx="22" cy="22" r="2.5" className="fill-accent/60 animate-[ping_4s_infinite]" />
    </svg>
  )
}

// ─── Particles ───────────────────────────────────────────────────────────────
function Particles({
  isActive,
  controls,
}: {
  isActive: boolean
  controls: ReturnType<typeof useAnimation>
}) {
  if (!isActive) return null

  return (
    <>
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
        <motion.div
          key={i}
          custom={i}
          initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
          animate={controls}
          className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: EFFECT_COLORS[i % EFFECT_COLORS.length] }}
        />
      ))}
    </>
  )
}

// ─── ColorBars ───────────────────────────────────────────────────────────────
function ColorBars({ isActive, hasEntered }: { isActive: boolean; hasEntered: boolean }) {
  const bars = [
    { active: "6rem", idle: "4rem", delay: 0.5, color: "bg-primary" },
    { active: "8rem", idle: "6rem", delay: 0.7, color: "bg-accent" },
    { active: "5rem", idle: "3rem", delay: 0.9, color: "bg-secondary" },
  ]
  return (
    <div className="absolute -right-12 top-1/4 flex flex-col gap-2">
      {bars.map((bar) => (
        <motion.div
          key={bar.color}
          initial={{ width: 0 }}
          animate={{ width: isActive ? bar.active : bar.idle }}
          transition={{ delay: hasEntered ? 0 : bar.delay, duration: 0.6 }}
          className={`h-1 ${bar.color}`}
        />
      ))}
    </div>
  )
}

// ─── ProfileInfo ─────────────────────────────────────────────────────────────
function ProfileInfo({ reducedMotion }: { reducedMotion: boolean }) {
  const Wrapper = reducedMotion ? "div" : motion.div
  const Span = reducedMotion ? "span" : motion.span

  return (
    <Wrapper
      {...(!reducedMotion && {
        initial: { opacity: 0, y: 30 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: 0.3, duration: 0.8 },
      })}
      className="md:col-span-7 md:col-start-6 md:row-start-1 md:pt-12"
    >
      <div className="relative mb-8">
        {!reducedMotion ? (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="absolute -left-4 top-0 h-full w-2 bg-gradient-to-b from-primary via-accent to-secondary"
          />
        ) : (
          <div className="absolute -left-4 top-0 h-full w-2 bg-gradient-to-b from-primary via-accent to-secondary" />
        )}

        <h1 className="font-handwriting text-6xl font-bold leading-tight tracking-tight text-foreground md:text-7xl lg:text-8xl">
          <Span
            {...(!reducedMotion && {
              initial: { opacity: 0, x: -20 },
              animate: { opacity: 1, x: 0 },
              transition: { delay: 0.6, duration: 0.5 },
            })}
          >
            @trudbot
          </Span>
        </h1>

        {!reducedMotion ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="absolute -right-8 top-1/3 h-16 w-16 bg-highlight/30"
          />
        ) : (
          <div className="absolute -right-8 top-1/3 h-16 w-16 bg-highlight/30" />
        )}
      </div>

      {!reducedMotion ? (
        <motion.div
          initial={{ opacity: 0, rotate: -2 }}
          animate={{ opacity: 1, rotate: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="relative mb-12 border-l-4 border-accent pl-6"
        >
          <BioContent />
        </motion.div>
      ) : (
        <div className="relative mb-12 border-l-4 border-accent pl-6">
          <BioContent />
        </div>
      )}

      {!reducedMotion ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.6 }}
        >
          <SocialLinks />
        </motion.div>
      ) : (
        <SocialLinks />
      )}
    </Wrapper>
  )
}

function BioContent() {
  return (
    <>
      <p className="text-pretty text-xl leading-relaxed text-muted-foreground md:text-2xl">Frontend Developer</p>
      <div className="mt-4 flex gap-2">
        <div className="h-3 w-3 bg-primary" />
        <div className="h-3 w-3 bg-accent" />
        <div className="h-3 w-3 bg-secondary" />
        <div className="h-3 w-3 bg-highlight" />
      </div>
    </>
  )
}

// ─── ProfileCard (main) ──────────────────────────────────────────────────────
export function ProfileCard() {
  const reducedMotion = useReducedMotion() ?? false
  const [isAvatarHovered, setIsAvatarHovered] = useState(false)
  const [isBursting, setIsBursting] = useState(false)
  const [isMouseSettled, setIsMouseSettled] = useState(false)
  const [hasEntered, setHasEntered] = useState(false)
  const burstTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mouseStopTimerRef = useRef<NodeJS.Timeout | null>(null)
  const mousePos = useRef({ x: 0, y: 0 })
  const settledPos = useRef({ x: 0, y: 0 })
  const particleControls = useAnimation()
  const avatarRef = useRef<HTMLDivElement>(null)

  const isActive = isAvatarHovered || isBursting
  const isParticleActive = (isAvatarHovered && isMouseSettled) || isBursting

  const handleTap = useCallback((_: unknown, info: { point: { x: number; y: number } }) => {
    if (avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      mousePos.current = {
        x: info.point.x - centerX,
        y: info.point.y - centerY,
      }
    }

    setIsBursting(true)

    if (burstTimeoutRef.current) {
      clearTimeout(burstTimeoutRef.current)
    }
    burstTimeoutRef.current = setTimeout(() => {
      setIsBursting(false)
    }, BURST_TIMEOUT_MS)
  }, [])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current)
      if (mouseStopTimerRef.current) clearTimeout(mouseStopTimerRef.current)
    }
  }, [])

  // 入场动画完成标记
  useEffect(() => {
    const timer = setTimeout(() => setHasEntered(true), ENTRY_ANIMATION_MS)
    return () => clearTimeout(timer)
  }, [])

  // 粒子动画循环（后台标签页自动暂停）
  useEffect(() => {
    if (reducedMotion) return

    let isMounted = true

    const runParticles = async () => {
      if (!isParticleActive) {
        particleControls.stop()
        particleControls.set({ opacity: 0, scale: 0, x: 0, y: 0 })
        return
      }

      while (isMounted && isParticleActive) {
        // 标签页不可见时暂停，避免后台空耗
        if (document.hidden) {
          await new Promise<void>((resolve) => {
            const onVisible = () => {
              document.removeEventListener("visibilitychange", onVisible)
              resolve()
            }
            document.addEventListener("visibilitychange", onVisible)
          })
          if (!isMounted) break
        }

        try {
          const { x, y } = mousePos.current
          particleControls.set(() => ({ opacity: 0, scale: 0, x, y }))

          await particleControls.start((i: number) => {
            const { dx, dy } = PARTICLE_DIRECTIONS[i]
            return {
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
              x: [x, x + dx],
              y: [y, y + dy],
              transition: {
                duration: PARTICLE_DURATION,
                delay: i * PARTICLE_STAGGER,
                ease: "easeOut",
              },
            }
          })
        } catch {
          break
        }
      }
    }

    runParticles()
    return () => { isMounted = false }
  }, [isParticleActive, particleControls, reducedMotion])

  // 缓存头像区域 rect，避免 pointerMove 每帧触发同步布局
  const cachedRectRef = useRef<DOMRect | null>(null)
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return

    if (!cachedRectRef.current) {
      cachedRectRef.current = e.currentTarget.getBoundingClientRect()
    }
    const rect = cachedRectRef.current
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    mousePos.current = {
      x: e.clientX - centerX,
      y: e.clientY - centerY,
    }

    const dx = mousePos.current.x - settledPos.current.x
    const dy = mousePos.current.y - settledPos.current.y
    if (mouseStopTimerRef.current === null && dx * dx + dy * dy < MOUSE_SETTLE_THRESHOLD_SQ) {
      return
    }

    setIsMouseSettled(false)
    if (mouseStopTimerRef.current) {
      clearTimeout(mouseStopTimerRef.current)
    }
    mouseStopTimerRef.current = setTimeout(() => {
      settledPos.current = { ...mousePos.current }
      mouseStopTimerRef.current = null
      setIsMouseSettled(true)
    }, MOUSE_SETTLE_MS)
  }, [])

  const handleHoverEnd = useCallback(() => {
    setIsAvatarHovered(false)
    setIsMouseSettled(false)
    if (mouseStopTimerRef.current) {
      clearTimeout(mouseStopTimerRef.current)
      mouseStopTimerRef.current = null
    }
    mousePos.current = { x: 0, y: 0 }
    cachedRectRef.current = null // hover 离开时清除缓存，下次 hover 重新计算
  }, [])

  // ─── Reduced motion: static layout ──────────────────────────────────────
  if (reducedMotion) {
    return (
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
        <div className="md:col-span-5 md:col-start-1 md:row-start-1">
          <div className="relative inline-block">
            <DecorativeShapes isActive={false} reducedMotion />
            <div className="relative">
              <Avatar className="relative h-48 w-48 border-8 border-background shadow-2xl md:h-64 md:w-64">
                <AvatarImage src={AVATAR_IMAGE_URL} alt="trudbot" />
                <AvatarFallback className="flex h-full w-full items-center justify-center bg-background/5 backdrop-blur-xl">
                  <AvatarFallbackSvg />
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
        <ProfileInfo reducedMotion />
        <div className="md:col-span-12 md:row-start-2">
          <BottomTagline />
        </div>
      </div>
    )
  }

  // ─── Full animated layout ───────────────────────────────────────────────
  return (
    <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
      {/* 左侧：头像区域 */}
      <motion.div
        initial={{ opacity: 0, x: -50, rotate: -5 }}
        animate={{ opacity: 1, x: 0, rotate: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="md:col-span-5 md:col-start-1 md:row-start-1"
      >
        <div className="relative inline-block">
          <DecorativeShapes isActive={isActive} reducedMotion={false} />

          <motion.div
            ref={avatarRef}
            onHoverStart={() => setIsAvatarHovered(true)}
            onHoverEnd={handleHoverEnd}
            onPointerMove={handlePointerMove}
            onTap={handleTap}
            animate={{
              rotate: isActive ? [0, -5, 5, -5, 0] : 0,
              scale: isActive ? 1.1 : 1,
            }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative cursor-pointer"
          >
            <GlowEffects isActive={isActive} />
            <Particles isActive={isParticleActive} controls={particleControls} />
          </motion.div>

          <ColorBars isActive={isActive} hasEntered={hasEntered} />
        </div>
      </motion.div>

      <ProfileInfo reducedMotion={false} />

      {/* 底部装饰性文字 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3, duration: 0.8 }}
        className="md:col-span-12 md:row-start-2"
      >
        <BottomTagline />
      </motion.div>
    </div>
  )
}

// ─── BottomTagline ───────────────────────────────────────────────────────────
function BottomTagline() {
  return (
    <div className="flex items-center justify-center gap-8 pt-12 md:justify-end md:pt-0">
      <div className="h-px w-24 bg-gradient-to-r from-transparent via-border to-transparent" />
      <p className="font-mono text-sm text-muted-foreground">CREATIVE MIND</p>
      <div className="h-px w-24 bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  )
}
