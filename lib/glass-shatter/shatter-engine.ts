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
  thickness: 5,
  gravity: 2500,
  origin: { x: 0, y: 0 },
}

/**
 * Run the crack animation phase using Canvas2D overlay.
 * Progressively draws Voronoi edges from center outward with a glass-like effect.
 */
export function runCrackPhase(
  edges: VoronoiEdge[],
  width: number,
  height: number,
  duration: number,
  origin?: { x: number; y: number },
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

    const ox = origin?.x ?? width / 2
    const oy = origin?.y ?? height / 2
    const maxDist = edges.length > 0 ? edges[edges.length - 1].distanceFromOrigin : 1
    const startTime = performance.now()

    // Pre-compute stable jitter per edge so cracks don't flicker
    const edgeJitter = edges.map(() => ({
      mx: (Math.random() - 0.5) * 3,
      my: (Math.random() - 0.5) * 3,
    }))

    function drawFrame() {
      const elapsed = performance.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      ctx.clearRect(0, 0, width, height)

      const targetDist = progress * maxDist

      // Impact flash — radial burst at origin, fades quickly
      const flashIntensity = Math.max(0, 1 - progress * 3)
      if (flashIntensity > 0) {
        const gradient = ctx.createRadialGradient(ox, oy, 0, ox, oy, maxDist * 0.35)
        gradient.addColorStop(0, `rgba(255, 255, 255, ${0.7 * flashIntensity})`)
        gradient.addColorStop(0.25, `rgba(210, 235, 255, ${0.35 * flashIntensity})`)
        gradient.addColorStop(1, "rgba(180, 220, 255, 0)")
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)
      }

      // Layer 1: Wide outer glow (soft cyan)
      ctx.save()
      ctx.strokeStyle = "rgba(120, 190, 255, 0.12)"
      ctx.shadowColor = "rgba(80, 160, 255, 0.5)"
      ctx.shadowBlur = 16
      ctx.lineWidth = 5
      for (const edge of edges) {
        if (edge.distanceFromOrigin > targetDist) break
        ctx.beginPath()
        ctx.moveTo(edge.from[0], edge.from[1])
        ctx.lineTo(edge.to[0], edge.to[1])
        ctx.stroke()
      }
      ctx.restore()

      // Layer 2: Blue-white mid glow
      ctx.save()
      ctx.strokeStyle = "rgba(200, 230, 255, 0.55)"
      ctx.shadowColor = "rgba(160, 210, 255, 0.7)"
      ctx.shadowBlur = 6
      ctx.lineWidth = 2
      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i]
        if (edge.distanceFromOrigin > targetDist) break
        const j = edgeJitter[i]
        const midX = (edge.from[0] + edge.to[0]) / 2 + j.mx
        const midY = (edge.from[1] + edge.to[1]) / 2 + j.my
        ctx.beginPath()
        ctx.moveTo(edge.from[0], edge.from[1])
        ctx.lineTo(midX, midY)
        ctx.lineTo(edge.to[0], edge.to[1])
        ctx.stroke()
      }
      ctx.restore()

      // Layer 3: Bright white core (thin, sharp)
      ctx.save()
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)"
      ctx.shadowColor = "rgba(255, 255, 255, 0.6)"
      ctx.shadowBlur = 2
      ctx.lineWidth = 0.8
      for (const edge of edges) {
        if (edge.distanceFromOrigin > targetDist) break
        ctx.beginPath()
        ctx.moveTo(edge.from[0], edge.from[1])
        ctx.lineTo(edge.to[0], edge.to[1])
        ctx.stroke()
      }
      ctx.restore()

      // Sparkle points at crack vertices
      ctx.save()
      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i]
        if (edge.distanceFromOrigin > targetDist) break
        // Only sparkle near the crack front for a spreading-light feel
        if (edge.distanceFromOrigin > targetDist * 0.85) {
          const sx = edge.to[0]
          const sy = edge.to[1]
          const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 4)
          sg.addColorStop(0, "rgba(255, 255, 255, 0.9)")
          sg.addColorStop(0.5, "rgba(200, 230, 255, 0.4)")
          sg.addColorStop(1, "rgba(160, 210, 255, 0)")
          ctx.fillStyle = sg
          ctx.fillRect(sx - 4, sy - 4, 8, 8)
        }
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

interface FragmentData {
  group: THREE.Group
  frontMaterial: THREE.MeshBasicMaterial
  sideMaterial: THREE.MeshBasicMaterial
  edgeMaterial: THREE.LineBasicMaterial
  state: FragmentState
}

/**
 * Build Three.js fragment meshes from Voronoi cells with glass-like materials.
 */
function buildFragments(
  cells: VoronoiCell[],
  texture: THREE.Texture,
  width: number,
  height: number,
  config: ShatterConfig,
): FragmentData[] {
  const fragments: FragmentData[] = []

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
      const px = posAttr.getX(i) + centroid[0]
      const py = -posAttr.getY(i) + centroid[1]
      uvAttr.setX(i, px / width)
      uvAttr.setY(i, 1 - py / height)
    }
    uvAttr.needsUpdate = true

    // Glass-like materials
    const frontMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    const sideMaterial = new THREE.MeshBasicMaterial({
      color: 0x9ecfff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })

    const mesh = new THREE.Mesh(geometry, [frontMaterial, sideMaterial])

    // Glass edge highlight — bright lines along fragment edges
    const edgeGeometry = new THREE.EdgesGeometry(geometry)
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xddeeff,
      transparent: true,
      opacity: 0.5,
      linewidth: 1,
    })
    const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial)

    // Group mesh + edge lines so they transform together
    const group = new THREE.Group()
    group.add(mesh)
    group.add(edgeLines)
    group.position.set(centroid[0], -centroid[1], 0)
    mesh.position.set(0, 0, 0)

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

    fragments.push({ group, frontMaterial, sideMaterial, edgeMaterial, state })
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
    for (const { group } of fragments) {
      scene.add(group)
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
      const elapsed = (now - startTime) / 1000
      let allDone = true

      for (const frag of fragments) {
        const { group, frontMaterial, sideMaterial, edgeMaterial, state } = frag
        if (!group.visible) continue

        const t = elapsed - state.delay
        if (t < 0) {
          allDone = false
          continue
        }

        const dt = 1 / 60

        // Apply gravity
        state.velocity[1] -= config.gravity * dt

        // Update position
        group.position.x += state.velocity[0] * dt
        group.position.y += state.velocity[1] * dt
        group.position.z += state.velocity[2] * dt

        // Update rotation
        group.rotation.x += state.angularVelocity[0] * dt
        group.rotation.y += state.angularVelocity[1] * dt
        group.rotation.z += state.angularVelocity[2] * dt

        // Glass glint — brief brightness boost when fragment faces camera
        const facingFactor = Math.abs(Math.cos(group.rotation.x) * Math.cos(group.rotation.y))
        const glint = Math.pow(facingFactor, 6)
        edgeMaterial.opacity = 0.3 + glint * 0.5
        sideMaterial.opacity = 0.4 + glint * 0.35

        // Fade out: start after 50% of fall duration
        const fadeStart = config.fallDuration * 0.5 / 1000
        const fadeDuration = config.fallDuration * 0.5 / 1000
        if (t > fadeStart) {
          const opacity = Math.max(0, 1 - (t - fadeStart) / fadeDuration)
          frontMaterial.opacity = opacity
          sideMaterial.opacity = (0.4 + glint * 0.35) * opacity
          edgeMaterial.opacity = (0.3 + glint * 0.5) * opacity

          if (opacity <= 0) {
            group.visible = false
            completedCount++
            continue
          }
        }

        // Remove if way off screen
        if (group.position.y < -(height + 500) || Math.abs(group.position.x) > width * 3) {
          group.visible = false
          completedCount++
          continue
        }

        allDone = false
      }

      renderer.render(scene, camera)

      if (allDone || completedCount >= totalFragments) {
        cancelAnimationFrame(animFrameId)
        cleanup(scene, renderer, texture, glCanvas)
        resolve()
      } else {
        animFrameId = requestAnimationFrame(animate)
      }
    }

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
      for (const mat of materials) mat.dispose()
    }
    if (obj instanceof THREE.LineSegments) {
      obj.geometry.dispose()
      ;(obj.material as THREE.Material).dispose()
    }
  })

  texture.dispose()
  renderer.dispose()
  renderer.forceContextLoss()
  canvas.remove()
}
