import "./home.css";
import { BottomDecoration } from "@/components/bottom-decoration";
import { FloatingShapes } from "@/components/floating-shapes";
import { GamesSection } from "@/components/games-section";
import { ProfileCard } from "@/components/profile-card";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <FloatingShapes />
      <div className="relative z-10 flex min-h-screen flex-col p-8 md:p-16 pb-32">
        <ProfileCard />
        <GamesSection />
        <BottomDecoration />
      </div>
    </main>
  );
}
