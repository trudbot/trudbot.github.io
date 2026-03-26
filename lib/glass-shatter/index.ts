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
    const scale = Math.min(window.devicePixelRatio, 2)

    // Dynamic imports — all loaded in parallel
    const [snapdomModule, voronoiModule, engineModule] = await Promise.all([
      import("@zumer/snapdom"),
      import("./voronoi"),
      import("./shatter-engine"),
    ])

    // Capture page screenshot using snapdom
    const fullScreenshot = await snapdomModule.snapdom.toCanvas(document.body, {
      scale,
      fast: true,
      placeholders: true,
      filter: (el: Element) =>
        el.id !== "shatter-overlay" && el.id !== "shatter-crack-overlay",
    })

    // Crop to viewport only — snapdom captures the full body which may be
    // taller than the viewport, causing UV mapping to sample blank areas.
    // Use the actual canvas size vs body size to derive the real scale,
    // because snapdom may use a different internal DPI than our `scale`.
    const bodyW = document.body.scrollWidth
    const bodyH = document.body.scrollHeight
    const realScaleX = fullScreenshot.width / bodyW
    const realScaleY = fullScreenshot.height / bodyH

    const croppedCanvas = document.createElement("canvas")
    croppedCanvas.width = Math.round(width * realScaleX)
    croppedCanvas.height = Math.round(height * realScaleY)
    const cropCtx = croppedCanvas.getContext("2d")!
    cropCtx.drawImage(
      fullScreenshot,
      0, Math.round(window.scrollY * realScaleY),
      Math.round(width * realScaleX), Math.round(height * realScaleY),
      0, 0,
      croppedCanvas.width, croppedCanvas.height,
    )

    // Freeze the page: overlay the static screenshot so that ongoing CSS
    // animations (e.g. FloatingShapes) don't cause a visual jump when
    // transitioning from the crack phase to the shatter phase.
    const freezeLayer = document.createElement("canvas")
    freezeLayer.id = "shatter-freeze-layer"
    freezeLayer.width = croppedCanvas.width
    freezeLayer.height = croppedCanvas.height
    freezeLayer.style.cssText = "position:fixed;inset:0;z-index:99997;width:100vw;height:100vh;"
    freezeLayer.getContext("2d")!.drawImage(croppedCanvas, 0, 0)
    document.body.appendChild(freezeLayer)

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
      origin,
    )

    // Create Three.js canvas overlay
    const { CanvasTexture, LinearFilter } = await import("three")
    const texture = new CanvasTexture(croppedCanvas)
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter

    const glCanvas = document.createElement("canvas")
    glCanvas.id = "shatter-overlay"
    glCanvas.style.cssText = "position:fixed;inset:0;z-index:99999;pointer-events:none;"
    document.body.appendChild(glCanvas)

    // Phase 2: Shatter animation (removes crack canvas internally)
    crackCanvas.remove()
    freezeLayer.remove()
    await engineModule.runShatterPhase(glCanvas, texture, cells, {
      ...options,
      origin,
    })
  } finally {
    isRunning = false
  }
}
