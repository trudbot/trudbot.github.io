"use client"

import { motion } from "framer-motion"
import { favoriteGames } from "@/config/games"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Gamepad2, ExternalLink } from "lucide-react"

export function GamesSection() {
  return (
    <section className="relative mx-auto mt-24 max-w-7xl px-4 md:mt-32 w-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
      >
        <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center justify-center md:justify-start gap-4">
            <Badge variant="outline" className="text-primary border-primary/50 text-sm md:text-base px-4 py-1">
              Interests
            </Badge>
            <div className="inline-block relative">
              <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl font-sans whitespace-nowrap">
                我最爱的游戏
              </h2>
              <div className="absolute -bottom-2 -right-4 h-4 w-12 bg-accent/30 -rotate-6 rounded-full blur-[2px]" />
            </div>
          </div>
          
          <div className="flex justify-center md:justify-end">
            <Button asChild variant="outline" className="rounded-full border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all text-sm font-sans gap-2">
              <a href="https://steamcommunity.com/id/trudboot/" target="_blank" rel="noopener noreferrer">
                <Gamepad2 className="h-4 w-4 text-primary" />
                我的 Steam
                <ExternalLink className="h-3 w-3 opacity-50" />
              </a>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {favoriteGames.map((game, i) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
              whileHover={{ y: -10, rotate: i % 2 === 0 ? 1 : -1 }}
            >
              <Card className="group relative h-full overflow-hidden border-2 border-primary/10 bg-card hover:border-primary/50 transition-all duration-300 rounded-3xl p-4 flex flex-col">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-muted group-hover:shadow-2xl transition-all duration-300">
                  <motion.img
                    src={game.coverUrl}
                    alt={game.name}
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
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
