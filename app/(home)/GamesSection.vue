<script setup vapor lang="ts">
import { favoriteGames } from "@/config/games";
import { trackClick } from "@/lib/analytics";

const STEAM_URL = "https://steamcommunity.com/id/trudboot/";
</script>

<template>
  <section class="relative mx-auto mt-24 max-w-7xl px-4 md:mt-32 w-full">
    <div class="gs-section">
      <div class="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="flex items-center justify-center md:justify-start gap-4">
          <span
            class="inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border border-primary/50 px-4 py-1 text-sm font-medium text-[#00703a] md:text-base dark:text-primary"
          >
            Interests
          </span>
          <div class="inline-block relative">
            <h2
              class="text-3xl font-bold tracking-tight text-foreground md:text-4xl font-sans whitespace-nowrap"
            >
              我最爱的游戏
            </h2>
            <div
              class="absolute -bottom-2 -right-4 h-4 w-12 bg-accent/30 -rotate-6 rounded-full blur-[2px]"
            />
          </div>
        </div>

        <div class="flex justify-center md:justify-end">
          <a
            :href="STEAM_URL"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-primary/30 bg-background px-3 py-2 font-sans text-sm font-medium shadow-xs outline-none transition-all hover:border-primary/60 hover:bg-primary/5 hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50 [&_svg]:pointer-events-none [&_svg]:shrink-0"
            @click="trackClick('steam_profile', { href: STEAM_URL })"
          >
            <!-- lucide: gamepad-2 -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-gamepad2 h-4 w-4 text-primary"
            >
              <line x1="6" x2="10" y1="11" y2="11" />
              <line x1="8" x2="8" y1="9" y2="13" />
              <line x1="15" x2="15.01" y1="12" y2="12" />
              <line x1="18" x2="18.01" y1="10" y2="10" />
              <path
                d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"
              />
            </svg>
            我的 Steam
            <!-- lucide: external-link -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-external-link size-4 opacity-50"
            >
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
          </a>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="(game, i) in favoriteGames"
          :key="game.id"
          class="gs-card"
          :style="{ '--gs-delay': `${i * 0.1}s`, '--gs-rotate': i % 2 === 0 ? '1deg' : '-1deg' }"
        >
          <div
            class="group relative flex h-full flex-col gap-6 overflow-hidden rounded-3xl border-2 border-primary/10 bg-card p-4 text-card-foreground shadow-sm transition-all duration-300 hover:border-primary/50"
          >
            <div
              class="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-muted group-hover:shadow-2xl transition-all duration-300"
            >
              <img
                :src="game.coverUrl"
                :alt="game.name"
                crossorigin="anonymous"
                loading="lazy"
                class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div
                class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4"
              >
                <p
                  class="text-white text-sm font-handwriting leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 translate-y-4 group-hover:translate-y-0"
                >
                  {{ game.review }}
                </p>
              </div>
            </div>

            <div class="mt-5 flex flex-col flex-grow">
              <h3
                class="text-lg font-bold font-sans line-clamp-2 leading-tight group-hover:text-primary transition-colors"
              >
                {{ game.name }}
              </h3>
            </div>

            <!-- Decoration shapes -->
            <div
              class="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-accent/20 blur-xl group-hover:bg-primary/20 transition-colors"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
