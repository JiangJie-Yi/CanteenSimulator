// The washroom basin's water (the owner's, 2026-11-10: the bowl stood empty under the running tap, the water straight down its drain): how
// full it is (0 empty .. 1 full to its safe line, 3 cm under the rim) and its pop-up stopper, down (plugged) or up (draining). Pure: the
// washstand steps it each frame with whether its tap is running.

/** seconds to fill from empty with the tap on and the stopper down; to drain from full with the stopper up */
export const FILL_S = 3.5
export const DRAIN_S = 2.4
/** with the tap running and the stopper up, a thin film stands round the drain, the water running on into it (how full that is) */
export const FILM = 0.06

export type Basin = { level: number; plugged: boolean }
export const emptyBasin = (): Basin => ({ level: 0, plugged: false })

/**
 * The level a moment (`dt` seconds) later. Stopper down: rising while the tap runs, held at full once it's there (the overflow takes the
 * rest), standing still once it's off. Stopper up: falling to the film while the tap runs (the drain takes more than the tap gives), to
 * nothing once it's off; a film not there yet rises to it.
 */
export function basinStep(b: Basin, running: boolean, dt: number): number {
  if (b.plugged) return running ? Math.min(1, b.level + dt / FILL_S) : b.level
  const film = running ? FILM : 0
  if (b.level > film) return Math.max(film, b.level - dt / DRAIN_S)
  return Math.min(film, b.level + dt / FILL_S)
}

/** whether it's draining away (the stopper up and more in it than the film it keeps): a swirl over the drain, a gurgle */
export const draining = (b: Basin, running: boolean) => !b.plugged && b.level > (running ? FILM : 0) + 0.01
