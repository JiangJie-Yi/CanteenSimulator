// The sliding door at the way in (item 410, the owner's, 2026-11-20: 「玄關試著做和式拉門」「客人進來的時候會先開拉門再脫鞋」): when it's
// wanted open, and how far open it shows as it runs. Pure rules; the door itself and who's about it are the shop's (GuestBar3D's
// GenkanDoor, in the doorway's own frame: x along the front, + toward the north wall; z out to the street, the leaves' line at DOOR_ZONE.line).

/** someone about the door, in the doorway's frame: where, how fast they're going out (z a second: + out, - in), and how long they've been
 * seen (s: one just put in at the door, coming in through it, is new) */
export type DoorWalker = { x: number; z: number; dz: number; age: number }

/** where it matters (the doorway's frame): across the way through it (x from..to); the leaves' line; out to the step's end (`out`); in to
 * where one walking out toward it is seen coming (`inside`); just in from it where one put in at the door shows (`near`) */
export const DOOR_ZONE = { x: [-0.36, 0.5] as [number, number], line: 0.39, out: 1.05, inside: -0.9, near: -0.15 }
/** how long one just put in at the door counts as come in through it (s); how long one out at it stands there before it's slid open for
 * them (s: shown there, they stand a moment, then it opens; one walking in from out past it has it open at once) */
export const DOOR_NEW_S = 0.6, DOOR_SEEN_S = 0.3
/** how quickly it runs open and shut (s for the whole way), and how long it's left open once no one wants it */
export const DOOR_OPEN_S = 0.42, DOOR_SHUT_S = 0.62, DOOR_HOLD_S = 0.4

/** whether anyone wants the door open: one out past it, walking in or stood there a moment; one walking out toward it; one just come in
 * at it */
export function doorWanted(ws: readonly DoorWalker[]): boolean {
  const { x, line, out, inside, near } = DOOR_ZONE
  return ws.some((w) => w.x > x[0] && w.x < x[1] && (
    (w.z > line && w.z < out && (w.dz < -0.3 || w.age >= DOOR_SEEN_S))
    || (w.dz > 0.05 && w.z > inside && w.z < out)
    || (w.age < DOOR_NEW_S && w.z > near && w.z <= line)))
}

/** the door's run: `k` how far along it is (0 shut, 1 open), `opening` which way it's going, `idle` how long it's been unwanted (s) */
export type DoorState = { k: number; opening: boolean; idle: number }
export const doorShut = (): DoorState => ({ k: 0, opening: false, idle: 0 })

/** a step of the door's run over `dt` s, wanted or not: open at once when wanted, shut once unwanted for DOOR_HOLD_S */
export function doorStep(st: DoorState, wanted: boolean, dt: number): DoorState {
  const idle = wanted ? 0 : st.idle + dt
  const opening = wanted || (st.opening && idle < DOOR_HOLD_S)
  const k = opening ? Math.min(1, st.k + dt / DOOR_OPEN_S) : Math.max(0, st.k - dt / DOOR_SHUT_S)
  return { k, opening, idle }
}

/** how far open it shows at `k` along its run (0 shut, 1 open): opening, a beat as the hand takes it, then rolled quickly and slowing to its
 * stop; shutting, run in and knocked against the jamb a little before the end, a small rebound out, and home. Never past shut */
export function doorShown(k: number, opening: boolean): number {
  const t = Math.min(1, Math.max(0, k))
  if (opening) {
    if (t < 0.06) return 0
    const u = (t - 0.06) / 0.94
    return 1 - (1 - u) ** 3
  }
  const KNOCK = 0.15
  if (t > KNOCK) { const u = (t - KNOCK) / (1 - KNOCK); return u * u * (3 - 2 * u) }
  return 0.018 * Math.sin((Math.PI * t) / KNOCK)
}
