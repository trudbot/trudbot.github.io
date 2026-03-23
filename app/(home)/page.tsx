import { ProfileCard } from "@/components/profile-card"
import { FloatingShapes } from "@/components/floating-shapes"
import dynamic from "next/dynamic"

const GamesSection = dynamic(
  () => import("@/components/games-section").then((mod) => mod.GamesSection),
)
const BottomDecoration = dynamic(
  () => import("@/components/bottom-decoration").then((mod) => mod.BottomDecoration),
)
const ShatterButton = dynamic(
  () => import("@/components/shatter-button").then((mod) => mod.ShatterButton),
)

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <FloatingShapes />
      <div className="relative z-10 flex min-h-screen flex-col p-8 md:p-16 pb-32">
        <ProfileCard />
        <GamesSection />
        <BottomDecoration />
      </div>
      <ShatterButton />
    </main>
  )
}
