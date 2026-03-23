export interface ShatterOptions {
  /** Number of Voronoi seed points (default: 100) */
  fragmentCount?: number
  /** Duration of crack spread phase in ms (default: 300) */
  crackDuration?: number
  /** Duration of fragment fall phase in ms (default: 2000) */
  fallDuration?: number
  /** Fragment extrusion depth in pixels (default: 3) */
  thickness?: number
  /** Gravity acceleration in px/s^2 (default: 2500) */
  gravity?: number
  /** Impact origin in viewport-relative coords (default: center) */
  origin?: { x: number; y: number }
}

export interface VoronoiCell {
  /** Seed point in pixel coordinates */
  seed: [number, number]
  /** Polygon vertices in pixel coordinates, clockwise order */
  vertices: [number, number][]
  /** Centroid of the polygon in pixel coordinates */
  centroid: [number, number]
}

export interface VoronoiEdge {
  /** Start point in pixel coordinates */
  from: [number, number]
  /** End point in pixel coordinates */
  to: [number, number]
  /** Distance from impact origin */
  distanceFromOrigin: number
}

export interface FragmentState {
  /** Velocity vector [vx, vy, vz] in px/s */
  velocity: [number, number, number]
  /** Angular velocity [rx, ry, rz] in rad/s */
  angularVelocity: [number, number, number]
  /** Delay before this fragment starts moving (seconds) */
  delay: number
}

export interface VoronoiResult {
  cells: VoronoiCell[]
  edges: VoronoiEdge[]
}
