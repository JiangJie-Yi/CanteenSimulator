// A small thermal model of the hot pot so the steam behaves like real soup: light the burner and the broth
// takes a while to come up to temperature before it starts steaming; turn it off and it keeps steaming,
// fading as it cools.

const ROOM = 25
const BOIL = 100
/** °C per second the burner adds at full flame (a full pot of broth, so it's not instant). */
const HEAT_RATE = 3.5
/** Newton cooling: fraction of the gap to room temperature lost per second (losing heat is slower). */
const COOL_RATE = 0.012
/** Steam starts to show at this temperature and is fully going at the boil. */
const STEAM_FROM = 72

/** Temperature the pot settles at for a given flame, capped at boiling. Used to start the scene warm. */
export function equilibriumTemp(heat: number) {
  if (heat <= 0) return ROOM
  return Math.min(BOIL, ROOM + (HEAT_RATE * heat) / 100 / COOL_RATE)
}

/** Advance the broth temperature by dt seconds at the given flame (0..100). */
export function stepTemp(temp: number, heat: number, dt: number) {
  const next = temp + ((HEAT_RATE * heat) / 100 - COOL_RATE * (temp - ROOM)) * dt
  return Math.min(BOIL, Math.max(ROOM, next))
}

/**
 * How much steam (0..1): wisps from STEAM_FROM, rising to a full head at the boil. A rolling boil on a big
 * flame makes more steam than a bare simmer, but a pot that has just been turned off still steams on its heat.
 */
export function steamAmount(temp: number, heat: number) {
  const t = Math.min(1, Math.max(0, (temp - STEAM_FROM) / (BOIL - STEAM_FROM)))
  const fromTemp = t * t * (3 - 2 * t)
  const boiling = temp >= BOIL - 0.5 ? 0.75 + 0.25 * Math.min(1, heat / 60) : 0.75
  return fromTemp * boiling
}
