import Delaunator from "delaunator"
import type { VoronoiCell, VoronoiEdge, VoronoiResult } from "./types"

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

  // Generate seed points using jittered grid for even distribution
  const seeds = generateSeeds(count, width, height)

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
  const edges = extractEdges(circumcenters, delaunay, width, height, ox, oy)

  // Filter out cells that are too small or degenerate
  const validCells = cells.filter((c) => c.vertices.length >= 3 && polygonArea(c.vertices) > 100)

  // Sort edges by distance from origin for crack animation
  edges.sort((a, b) => a.distanceFromOrigin - b.distanceFromOrigin)

  return { cells: validCells, edges }
}

function generateSeeds(count: number, width: number, height: number): [number, number][] {
  const seeds: [number, number][] = []
  const cols = Math.ceil(Math.sqrt(count * (width / height)))
  const rows = Math.ceil(count / cols)
  const cellW = width / cols
  const cellH = height / rows

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (seeds.length >= count) break
      const x = (c + 0.1 + Math.random() * 0.8) * cellW
      const y = (r + 0.1 + Math.random() * 0.8) * cellH
      seeds.push([x, y])
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
