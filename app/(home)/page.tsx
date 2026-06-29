import './home.css'
import { lazy, Suspense } from "react"
import { ProfileCard } from "@/components/profile-card"
import { FloatingShapes } from "@/components/floating-shapes"

const GamesSection = lazy(() => import("@/components/games-section").then((mod) => ({ default: mod.GamesSection })))
const BottomDecoration = lazy(() => import("@/components/bottom-decoration").then((mod) => ({ default: mod.BottomDecoration })))

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <FloatingShapes />
      <div className="relative z-10 flex min-h-screen flex-col p-8 md:p-16 pb-32">
        <ProfileCard />
        <Suspense fallback={null}>
          <GamesSection />
          <BottomDecoration />
        </Suspense>
      </div>
    </main>
  )
}
