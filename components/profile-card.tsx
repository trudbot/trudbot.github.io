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
        <div
          className="absolute -left-4 top-0 h-full w-2 origin-left bg-gradient-to-b from-primary via-accent to-secondary pc-entry"
          style={{ animation: 'pc-scale-x 0.8s ease-out 0.5s both' }}
        />

        <h1 className="font-handwriting text-6xl font-bold leading-tight tracking-tight text-foreground md:text-7xl lg:text-8xl">
          <span
            className="inline-block pc-entry"
            style={{ animation: 'pc-text-left 0.5s ease-out 0.6s both' }}
          >
            @trudbot
          </span>
        </h1>

        <div
          className="absolute -right-8 top-1/3 h-16 w-16 bg-highlight/30 pc-entry"
          style={{ animation: 'pc-pop 0.5s ease-out 1s both' }}
        />
      </div>

      <div
        className="relative mb-12 border-l-4 border-accent pl-6 pc-entry"
        style={{ animation: 'pc-tilt-in 0.6s ease-out 0.9s both' }}
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
        <div className="h-3 w-3 bg-primary" />
        <div className="h-3 w-3 bg-accent" />
        <div className="h-3 w-3 bg-secondary" />
        <div className="h-3 w-3 bg-highlight" />
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
