import * as THREE from "three"
import type { VoronoiCell, FragmentState, ShatterOptions, CrackSegment } from "./types"

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

export interface CrackPhaseOptions {
  origin: { x: number; y: number }
  /** Duration of initial impact crack near center (ms) */
  impactDuration: number
  /** Duration of the dramatic pause after impact (ms) */
  pauseDuration: number
  /** Duration of the rapid crack spread outward (ms) */
  spreadDuration: number
  /** Radius of the initial impact crack zone (px) */
  impactRadius: number
}

/**
 * Run the crack animation in three dramatic phases:
 *   1. Impact — small cracks appear at center (like a nail hit)
 *   2. Pause  — tension builds, cracks hold still with subtle pulse
 *   3. Spread — cracks explode outward in a branching tree pattern
 */
export function runCrackPhase(
  segments: CrackSegment[],
  width: number,
  height: number,
  options: CrackPhaseOptions,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const dpr = Math.min(window.devicePixelRatio, 2)
    const canvas = document.createElement("canvas")
    canvas.id = "shatter-crack-overlay"
    canvas.style.cssText =
      "position:fixed;inset:0;z-index:99998;pointer-events:none;"
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = width + "px"
    canvas.style.height = height + "px"
    document.body.appendChild(canvas)

    const ctx = canvas.getContext("2d")!
    ctx.scale(dpr, dpr)

    const { origin, impactDuration, pauseDuration, spreadDuration, impactRadius } = options
    const ox = origin.x
    const oy = origin.y
    const totalDuration = impactDuration + pauseDuration + spreadDuration

    // Partition segments
    const impactSegs = segments.filter((s) => s.distanceFromOrigin <= impactRadius)
    const spreadSegs = segments.filter((s) => s.distanceFromOrigin > impactRadius)
    const maxSpreadDist =
      spreadSegs.length > 0
        ? spreadSegs[spreadSegs.length - 1].distanceFromOrigin
        : 1

    // Pre-compute stable jitter per segment for mid-point wobble
    const jitter = new Map<CrackSegment, { mx: number; my: number }>()
    for (const seg of segments) {
      jitter.set(seg, {
        mx: (Math.random() - 0.5) * 3,
        my: (Math.random() - 0.5) * 3,
      })
    }

    const startTime = performance.now()

    /** Draw a set of crack segments with the three-layer glass-crack look. */
    function drawSegs(segs: CrackSegment[], alpha: number = 1) {
      if (segs.length === 0) return

      // Layer 1 — wide outer glow (soft cyan)
      ctx.save()
      ctx.strokeStyle = `rgba(120,190,255,${0.12 * alpha})`
      ctx.shadowColor = `rgba(80,160,255,${0.5 * alpha})`
      ctx.shadowBlur = 16
      for (const seg of segs) {
        ctx.lineWidth = seg.depth === 0 ? 6 : seg.depth === 1 ? 4 : 3
        ctx.beginPath()
        ctx.moveTo(seg.from[0], seg.from[1])
        ctx.lineTo(seg.to[0], seg.to[1])
        ctx.stroke()
      }
      ctx.restore()

      // Layer 2 — blue-white mid glow with jitter
      ctx.save()
      ctx.strokeStyle = `rgba(200,230,255,${0.55 * alpha})`
      ctx.shadowColor = `rgba(160,210,255,${0.7 * alpha})`
      ctx.shadowBlur = 6
      for (const seg of segs) {
        ctx.lineWidth = seg.depth === 0 ? 2.5 : seg.depth === 1 ? 1.8 : 1.2
        const j = jitter.get(seg)!
        const midX = (seg.from[0] + seg.to[0]) / 2 + j.mx
        const midY = (seg.from[1] + seg.to[1]) / 2 + j.my
        ctx.beginPath()
        ctx.moveTo(seg.from[0], seg.from[1])
        ctx.lineTo(midX, midY)
        ctx.lineTo(seg.to[0], seg.to[1])
        ctx.stroke()
      }
      ctx.restore()

      // Layer 3 — bright white core
      ctx.save()
      ctx.strokeStyle = `rgba(255,255,255,${0.95 * alpha})`
      ctx.shadowColor = `rgba(255,255,255,${0.6 * alpha})`
      ctx.shadowBlur = 2
      for (const seg of segs) {
        ctx.lineWidth = seg.depth === 0 ? 1.0 : seg.depth === 1 ? 0.7 : 0.5
        ctx.beginPath()
        ctx.moveTo(seg.from[0], seg.from[1])
        ctx.lineTo(seg.to[0], seg.to[1])
        ctx.stroke()
      }
      ctx.restore()
    }

    function drawFrame() {
      const elapsed = performance.now() - startTime
      ctx.clearRect(0, 0, width, height)

      if (elapsed <= impactDuration) {
        // ── Phase 1: Impact ──
        const p = Math.min(elapsed / impactDuration, 1)
        const currentR = p * impactRadius
        const visible = impactSegs.filter((s) => s.distanceFromOrigin <= currentR)

        // Impact flash — radial burst
        const flash = Math.max(0, 1 - p * 2)
        if (flash > 0) {
          const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, impactRadius * 0.6)
          g.addColorStop(0, `rgba(255,255,255,${0.85 * flash})`)
          g.addColorStop(0.3, `rgba(210,235,255,${0.4 * flash})`)
          g.addColorStop(1, "rgba(180,220,255,0)")
          ctx.fillStyle = g
          ctx.fillRect(0, 0, width, height)
        }

        drawSegs(visible)
      } else if (elapsed <= impactDuration + pauseDuration) {
        // ── Phase 2: Tension pause — cracks hold completely still ──
        drawSegs(impactSegs)
      } else {
        // ── Phase 3: Rapid spread ──
        const spreadT = (elapsed - impactDuration - pauseDuration) / spreadDuration
        const p = Math.min(spreadT, 1)
        // Ease-out: fast start, slight deceleration
        const eased = 1 - (1 - p) * (1 - p)

        const currentDist = eased * maxSpreadDist
        const visibleSpread = spreadSegs.filter(
          (s) => s.distanceFromOrigin <= currentDist,
        )

        // Draw impact + revealed spread
        drawSegs(impactSegs)
        drawSegs(visibleSpread)

        // Sparkles at the crack front
        ctx.save()
        for (const seg of visibleSpread) {
          if (seg.distanceFromOrigin > currentDist * 0.88) {
            const sx = seg.to[0]
            const sy = seg.to[1]
            const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 5)
            sg.addColorStop(0, "rgba(255,255,255,0.9)")
            sg.addColorStop(0.4, "rgba(200,230,255,0.4)")
            sg.addColorStop(1, "rgba(160,210,255,0)")
            ctx.fillStyle = sg
            ctx.fillRect(sx - 5, sy - 5, 10, 10)
          }
        }
        ctx.restore()
      }

      if (elapsed < totalDuration) {
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
