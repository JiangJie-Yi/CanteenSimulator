/**
 * How the fire sounds (scene/fireAmbience plays it): the charcoal's crackle grows with how hot it's burning, and the sizzle of fat on the
 * coals with how much food is over them, each piece adding less as more are on (a full fire's sizzle is a roar, not sixteen times one).
 * Both 0..1. No fire, no sound, whatever's on it.
 */
export function fireSound(fire: number, onFire: number) {
  const heat = Math.max(0, Math.min(1, fire))
  if (heat <= 0.02) return { crackle: 0, sizzle: 0 }
  const crackle = 0.15 + 0.85 * heat
  const food = 1 - Math.exp(-Math.max(0, onFire) / 3)
  const sizzle = food * (0.35 + 0.65 * heat)
  return { crackle, sizzle }
}

/** the room's murmur while the shop's open (scene's crowd ambience plays it): the talk of those at the bar, 0..1; empty, quiet; it grows
 * with each one sat down, less with each more (a full bar is a busy hum, not a din) */
export function murmur(seated: number) {
  return seated <= 0 ? 0 : Math.min(1, 1 - Math.exp(-seated / 5))
}
