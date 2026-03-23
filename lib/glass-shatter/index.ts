import type { ShatterOptions } from "./types"

export type { ShatterOptions }

let isRunning = false

/**
 * Trigger the glass shatter effect on the current page.
 * All heavy dependencies (Three.js, html2canvas) are dynamically imported on first call.
 *
 * @example
 * ```ts
 * import { triggerShatter } from "@/lib/glass-shatter"
 * await triggerShatter()
 * ```
 */
export async function triggerShatter(options?: ShatterOptions): Promise<void> {
  if (isRunning) return
  isRunning = true

  try {
    const width = window.innerWidth
    const height = window.innerHeight
    const origin = options?.origin ?? { x: width / 2, y: height / 2 }
    const fragmentCount = options?.fragmentCount ?? 100

    // Dynamic imports — all loaded in parallel
    const [snapdomModule, voronoiModule, engineModule] = await Promise.all([
      import("@zumer/snapdom"),
      import("./voronoi"),
      import("./shatter-engine"),
    ])

    // Capture page screenshot using snapdom
    const screenshot = await snapdomModule.snapdom.toCanvas(document.body, {
      scale: Math.min(window.devicePixelRatio, 2),
      fast: true,
      placeholders: true,
      filter: (el: Element) =>
        el.id !== "shatter-overlay" && el.id !== "shatter-crack-overlay",
    })

    // Generate Voronoi tessellation
    const { cells, edges } = voronoiModule.generateVoronoiCells(
      fragmentCount,
      width,
      height,
      origin,
    )

    // Phase 1: Crack animation
    const crackCanvas = await engineModule.runCrackPhase(
      edges,
      width,
      height,
      options?.crackDuration ?? 300,
    )

    // Create Three.js canvas overlay
    const { CanvasTexture, LinearFilter } = await import("three")
    const texture = new CanvasTexture(screenshot)
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter

    const glCanvas = document.createElement("canvas")
    glCanvas.id = "shatter-overlay"
    glCanvas.style.cssText = "position:fixed;inset:0;z-index:99999;pointer-events:none;"
    document.body.appendChild(glCanvas)

    // Phase 2: Shatter animation (removes crack canvas internally)
    crackCanvas.remove()
    await engineModule.runShatterPhase(glCanvas, texture, cells, {
      ...options,
      origin,
    })
  } finally {
    isRunning = false
  }
}
