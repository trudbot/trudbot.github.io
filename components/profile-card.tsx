import { SocialLinks } from "@/components/social-links"
import { AvatarInteractive } from "@/components/avatar-interactive"

// ─── ProfileInfo ─────────────────────────────────────────────────────────────
function ProfileInfo() {
  return (
    <div
      className="md:col-span-7 md:col-start-6 md:row-start-1 md:pt-12 pc-entry"
      style={{ animation: 'pc-fade-up 0.8s ease-out 0.3s both' }}
    >
      <div className="relative mb-8">
        <h1 className="font-handwriting text-6xl font-bold leading-tight tracking-tight text-foreground md:text-7xl lg:text-8xl">
          <span
            className="inline-block pc-entry"
            style={{ animation: 'pc-text-left 0.5s ease-out 0.6s both' }}
          >
            @trudbot
          </span>
        </h1>

        {/* 名字下方的蜡笔色条 — 童趣梦境感 */}
        <div
          className="mt-3 flex items-center gap-1.5 pc-entry"
          style={{ animation: 'pc-scale-x 0.6s ease-out 0.8s both', transformOrigin: 'left' }}
        >
          <div className="h-2 w-16 rounded-full" style={{ background: '#5CE0D8' }} />
          <div className="h-2 w-10 rounded-full" style={{ background: '#FF8FAB' }} />
          <div className="h-2 w-6 rounded-full" style={{ background: '#FFD166' }} />
          <div className="h-2 w-2 rounded-full" style={{ background: '#A78BFA' }} />
        </div>

        <div
          className="absolute -right-8 top-1/3 h-16 w-16 rounded-full pc-entry"
          style={{ animation: 'pc-pop 0.5s ease-out 1s both', background: '#FFD16620' }}
        />
      </div>

      <div
        className="relative mb-12 pl-6 pc-entry"
        style={{
          animation: 'pc-tilt-in 0.6s ease-out 0.9s both',
          borderLeft: '4px solid #5CE0D860',
        }}
      >
        <BioContent />
      </div>

      <div
        className="pc-entry"
        style={{ animation: 'pc-fade-up-sm 0.6s ease-out 1.1s both' }}
      >
        <SocialLinks />
      </div>
    </div>
  )
}

function BioContent() {
  return (
    <>
      <p className="text-pretty text-xl leading-relaxed text-muted-foreground md:text-2xl">Frontend Developer</p>
      <div className="mt-4 flex gap-2">
        <div className="h-3 w-3 rounded-full" style={{ background: '#5CE0D8' }} />
        <div className="h-3 w-3 rounded-full" style={{ background: '#FF8FAB' }} />
        <div className="h-3 w-3 rounded-full" style={{ background: '#FFD166' }} />
        <div className="h-3 w-3 rounded-full" style={{ background: '#A78BFA' }} />
      </div>
    </>
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

// ─── ProfileCard (Server Component) ──────────────────────────────────────────
export function ProfileCard() {
  return (
    <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
      {/* 左侧：头像区域（Client Component） */}
      <div
        className="md:col-span-5 md:col-start-1 md:row-start-1 pc-entry"
        style={{ animation: 'pc-slide-left 0.8s ease-out both' }}
      >
        <AvatarInteractive />
      </div>

      <ProfileInfo />

      {/* 底部装饰性文字 */}
      <div
        className="md:col-span-12 md:row-start-2 pc-entry"
        style={{ animation: 'pc-fade-in 0.8s ease-out 1.3s both' }}
      >
        <BottomTagline />
      </div>
    </div>
  )
}
