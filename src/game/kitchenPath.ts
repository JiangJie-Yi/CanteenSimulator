// A way across the kitchen's floor round what stands on it (the cook's table, the rice tub, the freezer, the racks, the sink): the floor
// laid out as a grid, the shortest way along it found (A*), then pulled straight wherever the way between two points is clear, so it's a
// few corners and not a staircase. In any flat frame: x and z, the things in it as rectangles along its axes.

export type Rect = { x0: number; z0: number; x1: number; z1: number }
type P = [number, number]

const inside = (r: Rect, x: number, z: number) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1

/** whether the straight way from a to b keeps clear of every block (looked at every `step` along it) */
function clear(a: P, b: P, blocks: Rect[], step: number) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (step / 2)))
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t
    if (blocks.some((r) => inside(r, x, z))) return false
  }
  return true
}

/** a place standing inside a block (in the room left round it for passers-by, say: someone stepped up to it) stepped out of it the
 * shortest way, past its nearest edge (and on out of any it comes into then) */
function stepOut(p: P, blocks: Rect[], cell: number): P {
  let q = p
  for (let n = 0; n < 4; n++) {
    const r = blocks.find((b) => inside(b, q[0], q[1]))
    if (!r) break
    const d = [q[0] - r.x0, r.x1 - q[0], q[1] - r.z0, r.z1 - q[1]], m = Math.min(...d), e = cell * 0.25
    q = m === d[0] ? [r.x0 - e, q[1]] : m === d[1] ? [r.x1 + e, q[1]] : m === d[2] ? [q[0], r.z0 - e] : [q[0], r.z1 + e]
  }
  return q
}

/**
 * The way from `from` to `to` inside `room`, round the `blocks` (each already grown by how much room a person walking by needs): the
 * corners along it, from and to included; the straight line if nothing's in the way; null if there's no way at all. (`from` and `to`
 * themselves may stand a little inside a block: whoever's there stepped up to it.)
 */
export function kitchenPath(from: P, to: P, room: Rect, blocks: Rect[], cell = 0.1): P[] | null {
  // (an end standing inside a block steps out of it first, and the way is found between where they step out to)
  const a0 = stepOut(from, blocks, cell), b0 = stepOut(to, blocks, cell)
  const ends = (mid: P[]): P[] => [from, ...(a0 !== from ? [a0] : []), ...mid, ...(b0 !== to ? [b0] : []), to]
  const way = wayBetween(a0, b0, room, blocks, cell)
  return way ? ends(way.slice(1, -1)) : null
}

/** the corners of the way from a to b, both included (both standing clear of the blocks), or null */
function wayBetween(from: P, to: P, room: Rect, blocks: Rect[], cell: number): P[] | null {
  if (clear(from, to, blocks, cell)) return [from, to]
  const nx = Math.max(1, Math.ceil((room.x1 - room.x0) / cell)), nz = Math.max(1, Math.ceil((room.z1 - room.z0) / cell))
  const idx = (i: number, j: number) => j * nx + i
  const cx = (i: number) => room.x0 + (i + 0.5) * cell, cz = (j: number) => room.z0 + (j + 0.5) * cell
  const cellOf = (p: P): [number, number] => [Math.min(nx - 1, Math.max(0, Math.floor((p[0] - room.x0) / cell))), Math.min(nz - 1, Math.max(0, Math.floor((p[1] - room.z0) / cell)))]
  const [si, sj] = cellOf(from), [ti, tj] = cellOf(to)
  const free = new Uint8Array(nx * nz)
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) free[idx(i, j)] = blocks.some((r) => inside(r, cx(i), cz(j))) ? 0 : 1
  free[idx(si, sj)] = 1
  free[idx(ti, tj)] = 1
  // (A* over the grid, eight ways round each cell; a diagonal only where both cells beside it are free, so it never cuts a corner)
  const g = new Float32Array(nx * nz).fill(Infinity)
  const came = new Int32Array(nx * nz).fill(-1)
  const open: number[] = [idx(si, sj)]
  const inOpen = new Uint8Array(nx * nz)
  const done = new Uint8Array(nx * nz)
  g[idx(si, sj)] = 0
  inOpen[idx(si, sj)] = 1
  const h = (k: number) => Math.hypot((k % nx) - ti, Math.floor(k / nx) - tj)
  const goal = idx(ti, tj)
  while (open.length) {
    let best = 0
    for (let k = 1; k < open.length; k++) if (g[open[k]] + h(open[k]) < g[open[best]] + h(open[best])) best = k
    const cur = open[best]
    open.splice(best, 1)
    inOpen[cur] = 0
    if (cur === goal) break
    done[cur] = 1
    const i = cur % nx, j = Math.floor(cur / nx)
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue
      const ni = i + di, nj = j + dj
      if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue
      const k = idx(ni, nj)
      if (!free[k] || done[k]) continue
      if (di && dj && (!free[idx(i + di, j)] || !free[idx(i, j + dj)])) continue
      const ng = g[cur] + (di && dj ? Math.SQRT2 : 1)
      if (ng < g[k]) {
        g[k] = ng
        came[k] = cur
        if (!inOpen[k]) { open.push(k); inOpen[k] = 1 }
      }
    }
  }
  if (came[goal] < 0 && goal !== idx(si, sj)) return null
  // (back from the goal to the start, cell by cell; then only the corners kept where the straight way to the next one is clear)
  const cells: P[] = []
  for (let k = goal; k >= 0 && k !== idx(si, sj); k = came[k]) cells.push([cx(k % nx), cz(Math.floor(k / nx))])
  cells.reverse()
  const pts: P[] = [from, ...cells.slice(0, -1), to]
  const out: P[] = [from]
  let a = 0
  while (a < pts.length - 1) {
    let b = pts.length - 1
    while (b > a + 1 && !clear(pts[a], pts[b], blocks, cell)) b--
    out.push(pts[b])
    a = b
  }
  return out
}
