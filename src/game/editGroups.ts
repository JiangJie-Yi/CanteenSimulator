// The edit mode's groups as a tree (a group can hold pieces and other groups: a view's area holds the till's own group, the shrine's), and
// which view's area each piece is in, from where the views' cameras stand and what they look at. Pure: no React, no three.

export type V3 = [number, number, number]
/** a group as far as the tree goes: what's in it (pieces, or other groups, by id) */
export type GroupLike = { members: string[] }

/** the group holding this piece (or group), if any */
export const parentOf = (groups: Record<string, GroupLike>, id: string): string | null =>
  Object.keys(groups).find((g) => groups[g].members.includes(id)) ?? null

/** the groups a piece (or group) is inside, from the one holding it outwards */
export function chainOf(groups: Record<string, GroupLike>, id: string): string[] {
  const out: string[] = []
  for (let g = parentOf(groups, id); g && !out.includes(g); g = parentOf(groups, g)) out.push(g)
  return out
}

/** whether `id` is `outer` itself or anywhere inside it */
export const within = (groups: Record<string, GroupLike>, id: string, outer: string) => id === outer || chainOf(groups, id).includes(outer)

/** the pieces under a group, however deep (a piece: itself) */
export function leavesOf(groups: Record<string, GroupLike>, id: string, seen = new Set<string>()): string[] {
  const g = groups[id]
  if (!g) return [id]
  if (seen.has(id)) return []
  seen.add(id)
  return g.members.flatMap((m) => leavesOf(groups, m, seen))
}

/** a group's own move, turn and size: about `pivot` (in the frame it's in), moved by `t`, turned by `r` (degrees about X, Y, Z, in that order,
 * or `yaw` alone about Y), sized by `s` */
export type GroupMove = { pivot: V3; t: V3; yaw: number; s: number; r?: V3 }

const turnOf = (g: GroupMove): V3 => g.r ?? [0, g.yaw, 0]
const D = Math.PI / 180
const rx = (v: V3, a: number): V3 => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)]
const ry = (v: V3, a: number): V3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)]
const rz = (v: V3, a: number): V3 => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]]

/** whether a group stands as it was made (not moved, turned or sized): it changes nothing for what's in it */
export const isStill = (g: GroupMove) => g.s === 1 && g.t.every((v) => v === 0) && turnOf(g).every((v) => v === 0)

/** a point inside the group, where the group's move, turn and size carry it (as three's Euler XYZ: X's turn last) */
export function applyGroup(g: GroupMove, v: V3): V3 {
  const r = turnOf(g)
  const w = rx(ry(rz([v[0] - g.pivot[0], v[1] - g.pivot[1], v[2] - g.pivot[2]], r[2] * D), r[1] * D), r[0] * D)
  return [g.pivot[0] + g.t[0] + w[0] * g.s, g.pivot[1] + g.t[1] + w[1] * g.s, g.pivot[2] + g.t[2] + w[2] * g.s]
}

/** where a point seen now stands inside the group, before its move, turn and size: what a pivot inside a moved group is kept as */
export function undoGroup(g: GroupMove, v: V3): V3 {
  const r = turnOf(g)
  const w: V3 = [(v[0] - g.pivot[0] - g.t[0]) / g.s, (v[1] - g.pivot[1] - g.t[1]) / g.s, (v[2] - g.pivot[2] - g.t[2]) / g.s]
  const u = rz(ry(rx(w, -r[0] * D), -r[1] * D), -r[2] * D)
  return [g.pivot[0] + u[0], g.pivot[1] + u[1], g.pivot[2] + u[2]]
}

/** a view's camera: where it stands, the point it looks at, and its lens (the vertical field of view in degrees, and the frame's width over its height);
 * and what it's a view of, where that's not the point it looks at (a view framed a little into the room, off the door it's of) */
export type ViewCam = { id: string; eye: V3; target: V3; fov: number; aspect: number; subject?: V3 }

/** how far across a camera's frame a point stands, by the floor plan alone (its height left out: a lantern hung high is over the part of the room
 * below it): 0 straight ahead, 1 at the frame's left or right edge; null behind the camera */
export function acrossFrame(cam: ViewCam, p: V3): number | null {
  const hx = cam.target[0] - cam.eye[0], hz = cam.target[2] - cam.eye[2]
  const hl = Math.hypot(hx, hz)
  if (hl < 1e-6) return null
  const ux = hx / hl, uz = hz / hl
  const vx = p[0] - cam.eye[0], vz = p[2] - cam.eye[2]
  const depth = vx * ux + vz * uz
  if (depth <= 1e-6) return null
  return Math.abs(vx * uz - vz * ux) / (depth * Math.tan((cam.fov * Math.PI) / 360) * cam.aspect)
}

/** a little past the frame's edge still counts as in sight (what stands at the edge of a view is part of it) */
export const EDGE_SLACK = 1.25
/** how far (on the floor plan) from what a view looks at a piece none of the cameras has in sight may be and still be put in its area */
export const AREA_REACH = 5

const flat = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[2] - b[2])

/**
 * The view whose area a point is in: of the views whose camera has it in sight, the one whose subject (what it's a view of) it's nearest, on the
 * floor plan; if none has it in sight, the nearest of them all, when it's no further than `reach`; else none.
 */
export function viewOf(p: V3, cams: ViewCam[], reach = AREA_REACH): string | null {
  const seen = cams.filter((c) => { const a = acrossFrame(c, p); return a !== null && a <= EDGE_SLACK })
  let best: ViewCam | null = null, bd = Infinity
  for (const c of seen.length ? seen : cams) {
    const d = flat(p, c.subject ?? c.target)
    if (d < bd) { bd = d; best = c }
  }
  return best && (seen.length || bd <= reach) ? best.id : null
}

/** each view's area: the things (pieces, or groups taken whole, by their middles) whose place falls in it; the views with nothing in them left out.
 * `fixed`: things a view is said to be of (by id, the view's id), whatever its camera has in sight */
export function areasOf(things: { id: string; at: V3 }[], cams: ViewCam[], reach = AREA_REACH, fixed: Record<string, string> = {}): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const t of things) {
    const v = cams.some((c) => c.id === fixed[t.id]) ? fixed[t.id] : viewOf(t.at, cams, reach)
    if (v) (out[v] ??= []).push(t.id)
  }
  return out
}
