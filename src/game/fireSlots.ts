/**
 * The hearth's places (the owner's, 2026-11-10: in a rush the fire was crowded with skewers standing anywhere round it, the board heaped,
 * the plating place piled up and spilling over): fixed places, so many and no more, and what waits when they're full.
 *
 * - Round the fire, RING_SLOTS places for skewers standing in the ash, each at its own bearing about the fire's middle (in the dish's own
 *   frame, degrees from +x toward +z), clear of the camera's line onto the fire and of where the plate stood (AVOID). A skewer goes on only
 *   into a free one; with all of them taken, none goes on and the cook at the board waits with what he's brought.
 * - On the board, BOARD_SLOTS raw skewers at most, side by side; the second cook brings no more than there's room for.
 * - The grill net's own three places are the net's (menu.ts netSpots).
 */

/** how many skewers stand round the fire at most */
export const RING_SLOTS = 8
/** how many raw skewers wait on the board at most */
export const BOARD_SLOTS = 4
/** the bearings kept clear round the fire (the camera's line onto it, the plate's old place), and by how much each side */
export const AVOID = [54, -40]
export const AVOID_BY = 26

/** the gap between two bearings, in degrees, 0..180 */
export const gapDeg = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180)

/**
 * The places' bearings: as evenly as they go over what's clear of AVOID, the larger stretch taking the more (the two stretches between the
 * two kept clear, each place a stretch's end or shared out along it)
 */
export const RING_AZ: readonly number[] = (() => {
  // (the clear stretches, each from one kept-clear bearing's edge round to the next's)
  const edges = [...AVOID].sort((a, b) => a - b)
  const runs: [number, number][] = edges.map((a, i) => {
    const b = edges[(i + 1) % edges.length] + (i + 1 === edges.length ? 360 : 0)
    return [a + AVOID_BY, b - AVOID_BY]
  })
  const total = runs.reduce((s, [a, b]) => s + Math.max(0, b - a), 0)
  // (shared out by length, each at least one; the rest by the largest leftover)
  const want = runs.map(([a, b]) => (Math.max(0, b - a) / total) * RING_SLOTS)
  const n = want.map((w) => Math.max(1, Math.floor(w)))
  while (n.reduce((s, x) => s + x, 0) < RING_SLOTS) {
    let best = 0
    for (let i = 1; i < runs.length; i++) if (want[i] - n[i] > want[best] - n[best]) best = i
    n[best]++
  }
  const out: number[] = []
  runs.forEach(([a, b], i) => {
    if (n[i] === 1) out.push((a + b) / 2)
    else for (let k = 0; k < n[i]; k++) out.push(a + ((b - a) * k) / (n[i] - 1))
  })
  return out.map((d) => ((d % 360) + 540) % 360 - 180)
})()

/** the first free place round the fire (by its number), or null: all taken */
export function freeRingSlot(taken: ReadonlySet<number>): number | null {
  for (let k = 0; k < RING_SLOTS; k++) if (!taken.has(k)) return k
  return null
}

/** how many more raw skewers the board has room for, with `onBoard` on it and `coming` on their way to it */
export const boardRoom = (onBoard: number, coming = 0) => Math.max(0, BOARD_SLOTS - onBoard - coming)
