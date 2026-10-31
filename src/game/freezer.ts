/** The ingredient freezer's thermostat: its setting, stepped a degree at a time within a freezer's range, and the cavity's own temperature
 * drifting toward it (warming while the lid's up). */
export const FREEZER_MIN = -25
export const FREEZER_MAX = -15
export const FREEZER_DEFAULT = -20

/** the setting after one press of up (+1) or down (-1), kept in range */
export const stepTemp = (set: number, dir: 1 | -1) => Math.min(FREEZER_MAX, Math.max(FREEZER_MIN, Math.round(set) + dir))

/** the cavity's temperature after dt seconds: with the lid up it warms toward the room (slowly, never past -2), shut it cools back to the setting */
export function driftTemp(t: number, set: number, open: boolean, dt: number) {
  if (open) return Math.min(-2, t + 0.4 * dt)
  return t + (set - t) * (1 - Math.exp(-dt / 12))
}
