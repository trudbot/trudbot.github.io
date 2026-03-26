import Delaunator from "delaunator"
import type { VoronoiCell, VoronoiEdge, VoronoiResult, CrackSegment } from "./types"

/**
 * Generate Voronoi tessellation for glass shatter effect.
 * Uses Delaunator for Delaunay triangulation, then extracts dual Voronoi diagram.
 */
export function generateVoronoiCells(
  count: number,
  width: number,
  height: number,
  origin?: { x: number; y: number },
): VoronoiResult {
  const ox = origin?.x ?? width / 2
  const oy = origin?.y ?? height / 2

  // Generate seed points with radial density falloff around impact
  const seeds = generateSeeds(count, width, height, ox, oy)

  // Add boundary points to ensure full coverage
  addBoundaryPoints(seeds, width, height)

  // Flatten for Delaunator
  const coords = new Float64Array(seeds.length * 2)
  for (let i = 0; i < seeds.length; i++) {
    coords[i * 2] = seeds[i][0]
    coords[i * 2 + 1] = seeds[i][1]
  }

  const delaunay = new Delaunator(coords)

  // Extract Voronoi cells and edges
  const circumcenters = computeCircumcenters(delaunay, coords)
  const cells = extractCells(delaunay, coords, circumcenters, seeds.length, width, height)

  // Secondary fracture: split some cells into triangles for angular look
  const fracturedCells = applySecondaryFracture(cells, ox, oy, width, height)

  const edges = extractEdges(circumcenters, delaunay, width, height, ox, oy)

  // Add edges from secondary fracture splits
  for (const cell of fracturedCells) {
    if (cell._splitEdge) {
      edges.push(cell._splitEdge)
    }
  }

  // Filter out cells that are too small or degenerate
  const validCells = fracturedCells.filter(
    (c) => c.vertices.length >= 3 && polygonArea(c.vertices) > 50,
  )

  // Sort edges by distance from origin for crack animation
  edges.sort((a, b) => a.distanceFromOrigin - b.distanceFromOrigin)

  return { cells: validCells, edges }
}

function generateSeeds(
  count: number,
  width: number,
  height: number,
  ox?: number,
  oy?: number,
): [number, number][] {
  const seeds: [number, number][] = []
  const cx = ox ?? width / 2
  const cy = oy ?? height / 2
  const maxDist = Math.hypot(width, height)

  // Radial density falloff: more seeds near impact, fewer far away.
  // Use rejection sampling with density ∝ 1/(1 + k*r)^2
  const k = 3 / maxDist
  for (let i = 0; i < count; i++) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const x = Math.random() * width
      const y = Math.random() * height
      const r = Math.hypot(x - cx, y - cy)
      const density = 1 / (1 + k * r) ** 2
      if (Math.random() < density) {
        seeds.push([x, y])
        break
      }
    }
  }

  return seeds
}

function addBoundaryPoints(seeds: [number, number][], width: number, height: number) {
  const margin = -50 // Slightly outside viewport
  // Corners
  seeds.push([margin, margin], [width - margin, margin], [width - margin, height - margin], [margin, height - margin])
  // Edge midpoints
  const edgeCount = 3
  for (let i = 1; i <= edgeCount; i++) {
    const t = i / (edgeCount + 1)
    seeds.push([t * width, margin]) // top
    seeds.push([t * width, height - margin]) // bottom
    seeds.push([margin, t * height]) // left
    seeds.push([width - margin, t * height]) // right
  }
}

function computeCircumcenters(delaunay: Delaunator<Float64Array>, coords: Float64Array): [number, number][] {
  const triangleCount = delaunay.triangles.length / 3
  const centers: [number, number][] = []

  for (let t = 0; t < triangleCount; t++) {
    const i0 = delaunay.triangles[t * 3]
    const i1 = delaunay.triangles[t * 3 + 1]
    const i2 = delaunay.triangles[t * 3 + 2]

    const ax = coords[i0 * 2], ay = coords[i0 * 2 + 1]
    const bx = coords[i1 * 2], by = coords[i1 * 2 + 1]
    const cx = coords[i2 * 2], cy = coords[i2 * 2 + 1]

    const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))

    if (Math.abs(D) < 1e-10) {
      // Degenerate triangle, use centroid instead
      centers.push([(ax + bx + cx) / 3, (ay + by + cy) / 3])
    } else {
      const ux =
        ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D
      const uy =
        ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D
      centers.push([ux, uy])
    }
  }

  return centers
}

function extractCells(
  delaunay: Delaunator<Float64Array>,
  coords: Float64Array,
  circumcenters: [number, number][],
  pointCount: number,
  width: number,
  height: number,
): VoronoiCell[] {
  const cells: VoronoiCell[] = []

  // Build point-to-incoming-halfedge index
  const pointToHalfedge = new Int32Array(pointCount).fill(-1)
  for (let e = 0; e < delaunay.triangles.length; e++) {
    const p = delaunay.triangles[e]
    if (pointToHalfedge[p] === -1 || delaunay.halfedges[e] === -1) {
      pointToHalfedge[p] = e
    }
  }

  for (let p = 0; p < pointCount; p++) {
    const startEdge = pointToHalfedge[p]
    if (startEdge === -1) continue

    const vertices: [number, number][] = []
    let e = startEdge
    let iterations = 0

    do {
      const tri = Math.floor(e / 3)
      vertices.push(circumcenters[tri])

      // Move to next edge around point
      const next = nextHalfedge(e)
      const opp = delaunay.halfedges[next]
      if (opp === -1) break // Hit boundary
      e = opp
      iterations++
    } while (e !== startEdge && iterations < 50)

    if (vertices.length < 3) continue

    // Clip to viewport
    const clipped = clipPolygon(vertices, width, height)
    if (clipped.length < 3) continue

    const centroid = computeCentroid(clipped)
    const seed: [number, number] = [coords[p * 2], coords[p * 2 + 1]]

    cells.push({ seed, vertices: clipped, centroid })
  }

  return cells
}

function extractEdges(
  circumcenters: [number, number][],
  delaunay: Delaunator<Float64Array>,
  width: number,
  height: number,
  ox: number,
  oy: number,
): VoronoiEdge[] {
  const edges: VoronoiEdge[] = []
  const seen = new Set<string>()

  for (let e = 0; e < delaunay.halfedges.length; e++) {
    const opp = delaunay.halfedges[e]
    if (opp === -1) continue

    const t1 = Math.floor(e / 3)
    const t2 = Math.floor(opp / 3)

    const key = t1 < t2 ? `${t1}-${t2}` : `${t2}-${t1}`
    if (seen.has(key)) continue
    seen.add(key)

    const from = circumcenters[t1]
    const to = circumcenters[t2]

    // Skip edges entirely outside viewport
    if (
      (from[0] < -50 && to[0] < -50) ||
      (from[0] > width + 50 && to[0] > width + 50) ||
      (from[1] < -50 && to[1] < -50) ||
      (from[1] > height + 50 && to[1] > height + 50)
    ) {
      continue
    }

    // Clamp to viewport
    const clampedFrom: [number, number] = [clamp(from[0], 0, width), clamp(from[1], 0, height)]
    const clampedTo: [number, number] = [clamp(to[0], 0, width), clamp(to[1], 0, height)]

    const midX = (clampedFrom[0] + clampedTo[0]) / 2
    const midY = (clampedFrom[1] + clampedTo[1]) / 2
    const dist = Math.hypot(midX - ox, midY - oy)

    edges.push({ from: clampedFrom, to: clampedTo, distanceFromOrigin: dist })
  }

  return edges
}

/** Sutherland-Hodgman polygon clipping against viewport rectangle */
function clipPolygon(vertices: [number, number][], width: number, height: number): [number, number][] {
  let output = vertices

  // Clip against each edge: left, right, top, bottom
  const clipEdges: { inside: (p: [number, number]) => boolean; intersect: (a: [number, number], b: [number, number]) => [number, number] }[] = [
    {
      inside: (p) => p[0] >= 0,
      intersect: (a, b) => [0, a[1] + ((0 - a[0]) / (b[0] - a[0])) * (b[1] - a[1])] as [number, number],
    },
    {
      inside: (p) => p[0] <= width,
      intersect: (a, b) => [width, a[1] + ((width - a[0]) / (b[0] - a[0])) * (b[1] - a[1])] as [number, number],
    },
    {
      inside: (p) => p[1] >= 0,
      intersect: (a, b) => [a[0] + ((0 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), 0] as [number, number],
    },
    {
      inside: (p) => p[1] <= height,
      intersect: (a, b) => [a[0] + ((height - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), height] as [number, number],
    },
  ]

  for (const { inside, intersect } of clipEdges) {
    if (output.length === 0) return []
    const input = output
    output = []

    for (let i = 0; i < input.length; i++) {
      const current = input[i]
      const prev = input[(i + input.length - 1) % input.length]

      if (inside(current)) {
        if (!inside(prev)) {
          output.push(intersect(prev, current))
        }
        output.push(current)
      } else if (inside(prev)) {
        output.push(intersect(prev, current))
      }
    }
  }

  return output
}

function computeCentroid(vertices: [number, number][]): [number, number] {
  let cx = 0, cy = 0
  for (const [x, y] of vertices) {
    cx += x
    cy += y
  }
  return [cx / vertices.length, cy / vertices.length]
}

function polygonArea(vertices: [number, number][]): number {
  let area = 0
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length
    area += vertices[i][0] * vertices[j][1]
    area -= vertices[j][0] * vertices[i][1]
  }
  return Math.abs(area) / 2
}

function nextHalfedge(e: number): number {
  return e % 3 === 2 ? e - 2 : e + 1
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

interface FracturedCell extends VoronoiCell {
  _splitEdge?: VoronoiEdge
}

/**
 * Split some Voronoi cells along a diagonal to create triangular fragments.
 * Cells closer to the impact origin have a higher chance of being split,
 * producing the dense, angular fracture pattern seen in real glass.
 */
function applySecondaryFracture(
  cells: VoronoiCell[],
  ox: number,
  oy: number,
  width: number,
  height: number,
): FracturedCell[] {
  const maxDist = Math.hypot(width, height)
  const result: FracturedCell[] = []

  for (const cell of cells) {
    const dist = Math.hypot(cell.centroid[0] - ox, cell.centroid[1] - oy)
    const normalizedDist = dist / maxDist

    // Split probability: ~60% near impact, ~10% at edges
    const splitChance = 0.6 - normalizedDist * 0.5
    const shouldSplit =
      Math.random() < splitChance && cell.vertices.length >= 4

    if (!shouldSplit) {
      result.push(cell)
      continue
    }

    const verts = cell.vertices
    const n = verts.length

    // Pick two non-adjacent vertices to form the split diagonal
    const i = Math.floor(Math.random() * n)
    // Offset by 2 so we skip adjacent vertices (which would produce degenerate splits)
    const j = (i + 2 + Math.floor(Math.random() * (n - 3))) % n

    // Build two sub-polygons from the split
    const poly1: [number, number][] = []
    const poly2: [number, number][] = []

    // Walk from i to j (inclusive) → poly1
    for (let k = i; ; k = (k + 1) % n) {
      poly1.push(verts[k])
      if (k === j) break
    }
    // Walk from j to i (inclusive) → poly2
    for (let k = j; ; k = (k + 1) % n) {
      poly2.push(verts[k])
      if (k === i) break
    }

    if (poly1.length >= 3 && poly2.length >= 3) {
      const c1 = computeCentroid(poly1)
      const c2 = computeCentroid(poly2)

      const splitFrom = verts[i]
      const splitTo = verts[j]
      const midX = (splitFrom[0] + splitTo[0]) / 2
      const midY = (splitFrom[1] + splitTo[1]) / 2
      const edgeDist = Math.hypot(midX - ox, midY - oy)

      result.push(
        { seed: cell.seed, vertices: poly1, centroid: c1 },
        {
          seed: cell.seed,
          vertices: poly2,
          centroid: c2,
          _splitEdge: {
            from: splitFrom,
            to: splitTo,
            distanceFromOrigin: edgeDist,
          },
        },
      )
    } else {
      result.push(cell)
    }
  }

  return result
}

/**
 * Generate a tree-like branching crack pattern from the impact origin.
 * Produces radial main branches that fork into sub-branches,
 * with micro-cracks clustered at the impact point.
 */
export function generateCrackTree(
  width: number,
  height: number,
  ox: number,
  oy: number,
): CrackSegment[] {
  const segments: CrackSegment[] = []

  // maxRadius must reach the farthest corner so cracks cover entire viewport
  const maxRadius =
    Math.max(
      Math.hypot(ox, oy),
      Math.hypot(width - ox, oy),
      Math.hypot(ox, height - oy),
      Math.hypot(width - ox, height - oy),
    ) * 1.15

  // --- Micro-cracks at impact point (the "nail hit" cluster) ---
  const microCount = 15 + Math.floor(Math.random() * 10)
  for (let i = 0; i < microCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const startR = 2 + Math.random() * 8
    const len = 4 + Math.random() * 18
    const sx = ox + Math.cos(angle) * startR
    const sy = oy + Math.sin(angle) * startR
    const ea = angle + (Math.random() - 0.5) * 0.6
    const ex = sx + Math.cos(ea) * len
    const ey = sy + Math.sin(ea) * len
    segments.push({
      from: [sx, sy],
      to: [ex, ey],
      depth: 3,
      distanceFromOrigin: Math.hypot((sx + ex) / 2 - ox, (sy + ey) / 2 - oy),
    })
  }

  // --- Main radial branches ---
  const numBranches = 7 + Math.floor(Math.random() * 4)
  const baseAngle = Math.random() * Math.PI * 2

  for (let i = 0; i < numBranches; i++) {
    const sectorSize = (Math.PI * 2) / numBranches
    const angle = baseAngle + i * sectorSize + (Math.random() - 0.5) * sectorSize * 0.5
    growBranch(ox, oy, angle, 0, maxRadius, segments, ox, oy, width, height)
  }

  segments.sort((a, b) => a.distanceFromOrigin - b.distanceFromOrigin)
  return segments
}

function growBranch(
  x: number,
  y: number,
  angle: number,
  depth: number,
  remainingLen: number,
  segments: CrackSegment[],
  ox: number,
  oy: number,
  width: number,
  height: number,
) {
  if (depth > 5 || remainingLen < 8) return

  const distFromCenter = Math.hypot(x - ox, y - oy)
  const maxDist = Math.hypot(width, height)

  // Segment length: shorter near center (fine detail), longer far out
  const nearFactor = 0.6 + (distFromCenter / maxDist) * 0.8
  const baseSeg = depth === 0 ? 20 + Math.random() * 25 : 12 + Math.random() * 18
  const segLen = baseSeg * nearFactor

  // Curvature: main branches are straighter, sub-branches wobble more
  const curvature = depth === 0 ? 0.15 : 0.2 + depth * 0.08
  const newAngle = angle + (Math.random() - 0.5) * curvature

  const ex = x + Math.cos(newAngle) * segLen
  const ey = y + Math.sin(newAngle) * segLen

  if (ex < -50 || ex > width + 50 || ey < -50 || ey > height + 50) return

  const midDist = Math.hypot((x + ex) / 2 - ox, (y + ey) / 2 - oy)
  segments.push({ from: [x, y], to: [ex, ey], depth, distanceFromOrigin: midDist })

  // Continue the branch
  growBranch(ex, ey, newAngle, depth, remainingLen - segLen, segments, ox, oy, width, height)

  // Fork probability: high for main branches, decreasing with depth
  const forkChance =
    depth === 0 ? 0.38 : depth === 1 ? 0.28 : depth === 2 ? 0.18 : 0.08
  if (Math.random() < forkChance) {
    const dir = Math.random() > 0.5 ? 1 : -1
    const forkAngle = newAngle + dir * (0.35 + Math.random() * 0.7)
    growBranch(ex, ey, forkAngle, depth + 1, remainingLen * 0.55, segments, ox, oy, width, height)
  }

  // Rare double-fork on main branches for dramatic Y-splits
  if (depth === 0 && Math.random() < 0.08) {
    const dir = Math.random() > 0.5 ? 1 : -1
    const forkAngle = newAngle + dir * (0.5 + Math.random() * 0.5)
    growBranch(ex, ey, forkAngle, depth + 1, remainingLen * 0.4, segments, ox, oy, width, height)
  }
}
