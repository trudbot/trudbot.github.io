import * as THREE from "three"
import type { VoronoiCell, VoronoiEdge, FragmentState, ShatterOptions } from "./types"

interface ShatterConfig {
  crackDuration: number
  fallDuration: number
  thickness: number
  gravity: number
  origin: { x: number; y: number }
}

const DEFAULT_CONFIG: ShatterConfig = {
  crackDuration: 300,
  fallDuration: 2000,
  thickness: 3,
  gravity: 2500,
  origin: { x: 0, y: 0 },
}

/**
 * Run the crack animation phase using Canvas2D overlay.
 * Progressively draws Voronoi edges from center outward.
 */
export function runCrackPhase(
  edges: VoronoiEdge[],
  width: number,
  height: number,
  duration: number,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const dpr = Math.min(window.devicePixelRatio, 2)
    const canvas = document.createElement("canvas")
    canvas.style.cssText = "position:fixed;inset:0;z-index:99998;pointer-events:none;"
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = width + "px"
    canvas.style.height = height + "px"
    document.body.appendChild(canvas)

    const ctx = canvas.getContext("2d")!
    ctx.scale(dpr, dpr)

    const maxDist = edges.length > 0 ? edges[edges.length - 1].distanceFromOrigin : 1
    const startTime = performance.now()

    function drawFrame() {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      ctx.clearRect(0, 0, width, height)

      // Draw cracks with glow
      ctx.save()
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)"
      ctx.shadowColor = "rgba(255, 255, 255, 0.9)"
      ctx.shadowBlur = 4
      ctx.lineWidth = 1.5

      const targetDist = progress * maxDist

      for (const edge of edges) {
        if (edge.distanceFromOrigin > targetDist) break

        // Jitter edge for natural crack look
        const midX = (edge.from[0] + edge.to[0]) / 2 + (Math.random() - 0.5) * 3
        const midY = (edge.from[1] + edge.to[1]) / 2 + (Math.random() - 0.5) * 3

        ctx.beginPath()
        ctx.moveTo(edge.from[0], edge.from[1])
        ctx.lineTo(midX, midY)
        ctx.lineTo(edge.to[0], edge.to[1])
        ctx.stroke()
      }

      // Secondary finer cracks
      ctx.strokeStyle = "rgba(200, 220, 255, 0.3)"
      ctx.shadowBlur = 2
      ctx.lineWidth = 0.5
      for (const edge of edges) {
        if (edge.distanceFromOrigin > targetDist) break
        ctx.beginPath()
        ctx.moveTo(edge.from[0], edge.from[1])
        ctx.lineTo(edge.to[0], edge.to[1])
        ctx.stroke()
      }

      ctx.restore()

      if (progress < 1) {
        requestAnimationFrame(drawFrame)
      } else {
        resolve(canvas)
      }
    }

    requestAnimationFrame(drawFrame)
  })
}

/**
 * Build Three.js fragment meshes from Voronoi cells.
 */
function buildFragments(
  cells: VoronoiCell[],
  texture: THREE.Texture,
  width: number,
  height: number,
  config: ShatterConfig,
): { mesh: THREE.Mesh; state: FragmentState }[] {
  const fragments: { mesh: THREE.Mesh; state: FragmentState }[] = []

  for (const cell of cells) {
    const { vertices, centroid } = cell

    // Create shape from polygon vertices, relative to centroid
    const shape = new THREE.Shape()
    const relVerts = vertices.map(
      ([x, y]) => [x - centroid[0], y - centroid[1]] as [number, number],
    )

    shape.moveTo(relVerts[0][0], -relVerts[0][1])
    for (let i = 1; i < relVerts.length; i++) {
      shape.lineTo(relVerts[i][0], -relVerts[i][1])
    }
    shape.closePath()

    // Create extruded geometry for 3D thickness
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: config.thickness,
      bevelEnabled: false,
    })

    // Fix UV mapping to sample correct part of page texture
    const uvAttr = geometry.getAttribute("uv")
    const posAttr = geometry.getAttribute("position")
    for (let i = 0; i < uvAttr.count; i++) {
      // Position is relative to centroid, convert back to absolute pixel coords
      const px = posAttr.getX(i) + centroid[0]
      const py = -posAttr.getY(i) + centroid[1] // flip Y back
      uvAttr.setX(i, px / width)
      uvAttr.setY(i, 1 - py / height)
    }
    uvAttr.needsUpdate = true

    // Materials: front/back with texture, sides with dark color
    const frontMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    const sideMaterial = new THREE.MeshBasicMaterial({
      color: 0x1a1a2e,
      transparent: true,
      depthWrite: false,
    })

    const mesh = new THREE.Mesh(geometry, [frontMaterial, sideMaterial])
    mesh.position.set(centroid[0], -centroid[1], 0)

    // Compute physics state
    const dx = centroid[0] - config.origin.x
    const dy = centroid[1] - config.origin.y
    const dist = Math.hypot(dx, dy)
    const angle = Math.atan2(dy, dx)

    const speed = 200 + Math.random() * 400
    const state: FragmentState = {
      velocity: [
        Math.cos(angle) * speed * (0.5 + Math.random()),
        -(Math.sin(angle) * speed * (0.5 + Math.random())) - (100 + Math.random() * 200),
        (Math.random() - 0.5) * 300,
      ],
      angularVelocity: [
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 8,
      ],
      delay: dist * 0.0003 + Math.random() * 0.05,
    }

    fragments.push({ mesh, state })
  }

  return fragments
}

/**
 * Run the main shatter animation with Three.js.
 */
export function runShatterPhase(
  glCanvas: HTMLCanvasElement,
  texture: THREE.Texture,
  cells: VoronoiCell[],
  options: ShatterOptions,
): Promise<void> {
  return new Promise((resolve) => {
    const width = window.innerWidth
    const height = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio, 2)

    const config: ShatterConfig = {
      ...DEFAULT_CONFIG,
      ...options,
      origin: options.origin ?? { x: width / 2, y: height / 2 },
    }

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: glCanvas,
      alpha: true,
      antialias: true,
    })
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)

    // Orthographic camera matching viewport
    const camera = new THREE.OrthographicCamera(0, width, 0, -height, 0.1, 1000)
    camera.position.z = 500

    const scene = new THREE.Scene()

    // Build fragments
    const fragments = buildFragments(cells, texture, width, height, config)
    for (const { mesh } of fragments) {
      scene.add(mesh)
    }

    // Render initial frame (fragments in original positions)
    renderer.render(scene, camera)

    // Hide original page content
    const pageContent = document.querySelector("main") as HTMLElement | null
    if (pageContent) {
      pageContent.style.visibility = "hidden"
    }

    // Animation loop
    const startTime = performance.now()
    let completedCount = 0
    const totalFragments = fragments.length
    let animFrameId = 0

    function animate() {
      const now = performance.now()
      const elapsed = (now - startTime) / 1000 // seconds
      let allDone = true

      for (const { mesh, state } of fragments) {
        if (!mesh.visible) continue

        const t = elapsed - state.delay
        if (t < 0) {
          allDone = false
          continue
        }

        const dt = 1 / 60 // Fixed timestep for consistency

        // Apply gravity (positive Y is up in Three.js, but screen Y is down)
        state.velocity[1] -= config.gravity * dt

        // Update position
        mesh.position.x += state.velocity[0] * dt
        mesh.position.y += state.velocity[1] * dt
        mesh.position.z += state.velocity[2] * dt

        // Update rotation
        mesh.rotation.x += state.angularVelocity[0] * dt
        mesh.rotation.y += state.angularVelocity[1] * dt
        mesh.rotation.z += state.angularVelocity[2] * dt

        // Fade out: start after 50% of fall duration
        const fadeStart = config.fallDuration * 0.5 / 1000
        const fadeDuration = config.fallDuration * 0.5 / 1000
        if (t > fadeStart) {
          const opacity = Math.max(0, 1 - (t - fadeStart) / fadeDuration)
          const materials = mesh.material as THREE.MeshBasicMaterial[]
          for (const mat of materials) {
            mat.opacity = opacity
          }

          if (opacity <= 0) {
            mesh.visible = false
            completedCount++
            continue
          }
        }

        // Also remove if way off screen
        if (mesh.position.y < -(height + 500) || Math.abs(mesh.position.x) > width * 3) {
          mesh.visible = false
          completedCount++
          continue
        }

        allDone = false
      }

      renderer.render(scene, camera)

      if (allDone || completedCount >= totalFragments) {
        // Cleanup
        cancelAnimationFrame(animFrameId)
        cleanup(scene, renderer, texture, glCanvas)
        resolve()
      } else {
        animFrameId = requestAnimationFrame(animate)
      }
    }

    // Small delay to ensure the initial frame is visible before animation starts
    requestAnimationFrame(() => {
      animFrameId = requestAnimationFrame(animate)
    })
  })
}

function cleanup(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  texture: THREE.Texture,
  canvas: HTMLCanvasElement,
) {
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose()
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const mat of materials) {
        mat.dispose()
      }
    }
  })

  texture.dispose()
  renderer.dispose()
  renderer.forceContextLoss()
  canvas.remove()
}
