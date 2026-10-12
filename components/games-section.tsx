"use client";
import { favoriteGames } from "@/config/games";
import { trackClick } from "@/lib/analytics";
import { Gamepad2, ExternalLink } from "lucide-react";

export function GamesSection() {
  return (
    <section className="relative mx-auto mt-24 max-w-7xl px-4 md:mt-32 w-full">
      <div className="gs-section">
        <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center justify-center md:justify-start gap-4">
            <span className="inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border border-primary/50 px-4 py-1 text-sm font-medium text-[#00703a] md:text-base dark:text-primary">
              Interests
            </span>
            <div className="inline-block relative">
              <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl font-sans whitespace-nowrap">
                我最爱的游戏
              </h2>
              <div className="absolute -bottom-2 -right-4 h-4 w-12 bg-accent/30 -rotate-6 rounded-full blur-[2px]" />
            </div>
          </div>

          <div className="flex justify-center md:justify-end">
            <a
              href="https://steamcommunity.com/id/trudboot/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackClick("steam_profile", {
                  href: "https://steamcommunity.com/id/trudboot/",
                })
              }
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-primary/30 bg-background px-3 py-2 font-sans text-sm font-medium shadow-xs outline-none transition-all hover:border-primary/60 hover:bg-primary/5 hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50 [&_svg]:pointer-events-none [&_svg]:shrink-0"
            >
              <Gamepad2 className="h-4 w-4 text-primary" />
              我的 Steam
              <ExternalLink className="size-4 opacity-50" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {favoriteGames.map((game, i) => (
            <div
              key={game.id}
              className="gs-card"
              style={
                {
                  "--gs-delay": `${i * 0.1}s`,
                  "--gs-rotate": i % 2 === 0 ? "1deg" : "-1deg",
                } as React.CSSProperties
              }
            >
              <div className="group relative flex h-full flex-col gap-6 overflow-hidden rounded-3xl border-2 border-primary/10 bg-card p-4 text-card-foreground shadow-sm transition-all duration-300 hover:border-primary/50">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-muted group-hover:shadow-2xl transition-all duration-300">
                  <img
                    src={game.coverUrl}
                    alt={game.name}
                    crossOrigin="anonymous"
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <p className="text-white text-sm font-handwriting leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 translate-y-4 group-hover:translate-y-0">
                      {game.review}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col flex-grow">
                  <h3 className="text-lg font-bold font-sans line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                    {game.name}
                  </h3>
                </div>

                {/* Decoration shapes */}
                <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-accent/20 blur-xl group-hover:bg-primary/20 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
