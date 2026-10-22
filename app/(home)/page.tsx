import "./home.css";
import { BottomDecoration } from "@/components/bottom-decoration";
import { FloatingShapes } from "@/components/floating-shapes";
import { GamesSection } from "@/components/games-section";
import { HandwritingFont } from "@/components/handwriting-font";
import { ProfileCard } from "@/components/profile-card";
import { ShatterEasterEgg } from "@/components/shatter-easter-egg";

export default function Home() {
  return (
    // touch-manipulation：连点是破碎彩蛋的触发方式，不能被 iOS 双击缩放吃掉。
    <main className="relative min-h-screen touch-manipulation overflow-hidden bg-background">
      <HandwritingFont />
      <ShatterEasterEgg />
      <FloatingShapes />
      <div className="relative z-10 flex min-h-screen flex-col p-8 md:p-16 pb-32">
        <ProfileCard />
        <GamesSection />
        <BottomDecoration />
      </div>
    </main>
  );
}
