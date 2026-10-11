// A small thermal model of the hot pot so the steam behaves like real soup: light the burner and the broth
// takes a while to come up to temperature before it starts steaming; turn it off and it keeps steaming,
// fading as it cools.

const ROOM = 25
export const ROOM_TEMP = ROOM
const BOIL = 100
/** °C per second the burner adds at full flame: a cassette stove brings a small pot up in a couple of minutes. */
const HEAT_RATE = 0.8
/** Newton cooling: fraction of the gap to room temperature lost per second (losing heat is slower). */
const COOL_RATE = 0.004
/** Steam only shows close to the boil (faint wisps first), and is fully going once it boils. */
const STEAM_FROM = 88

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
 * How hard the soup is boiling (0..1), for the surface bubbles: nothing until it reaches the boil, then it
 * follows the flame (a simmer on low, a rolling boil at 100%). Once the flame is off it settles within a
 * moment, as the temperature drops below boiling.
 */
export function boilAmount(temp: number, heat: number) {
  if (temp < BOIL - 1) return 0
  const nearBoil = Math.min(1, (temp - (BOIL - 1)) / 1)
  return nearBoil * Math.max(0.12, heat / 100)
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
